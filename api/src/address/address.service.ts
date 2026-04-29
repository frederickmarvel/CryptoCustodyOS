import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Address, AddressStatus } from './address.entity';
import { Key } from '../key/key.entity';
import { Wallet, WalletType } from '../wallet/wallet.entity';
import { CreateAddressDto, VerifyAddressDto } from './dto/address.dto';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';
import { Tenant } from '../tenant/tenant.entity';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(Key)
    private readonly keyRepo: Repository<Key>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(walletId: string, tenantId: string, dto: CreateAddressDto): Promise<Address> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId, tenantId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.type === WalletType.BTC_MULTISIG_2_OF_3) {
      await this.validateBtcTestnetAddress(dto.address, dto.derivationPath);
    }

    const existingCount = await this.addressRepo.count({ where: { walletId } });
    const derivationIndex = dto.derivationIndex ?? existingCount;

    const address = this.addressRepo.create({
      walletId,
      tenantId,
      address: dto.address,
      derivationPath: dto.derivationPath ?? null,
      derivationIndex,
      chainSymbol: dto.chainSymbol,
      network: dto.network,
      status: AddressStatus.ACTIVE,
    });
    const saved = await this.addressRepo.save(address);

    const audit = this.auditLogRepo.create({
      tenantId,
      eventType: AuditEventType.ADDRESS_CREATED,
      actorId: null,
      actorType: 'system',
      payload: { addressId: saved.id, walletId, address: saved.address, chain: dto.chainSymbol },
    });
    await this.auditLogRepo.save(audit);

    return saved;
  }

  async findAllByWallet(walletId: string, tenantId: string): Promise<Address[]> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId, tenantId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    return this.addressRepo.find({ where: { walletId }, order: { derivationIndex: 'ASC' } });
  }

  async verify(walletId: string, tenantId: string, dto: VerifyAddressDto): Promise<{ valid: boolean; reason?: string }> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId, tenantId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (wallet.type === WalletType.BTC_MULTISIG_2_OF_3) {
      return this.verifyBtcTestnetAddress(dto.address, dto.expectedDerivationPath);
    }

    if (!dto.address || dto.address.length < 10) {
      return { valid: false, reason: 'Malformed address' };
    }

    return { valid: true };
  }

  async registerKeys(
    walletId: string,
    tenantId: string,
    keys: Array<{ keyType: string; xpub: string; derivationPath?: string; keyIndex: number }>,
  ): Promise<Key[]> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId, tenantId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const savedKeys: Key[] = [];
    for (const k of keys) {
      const xpubHash = crypto.createHash('sha256').update(k.xpub).digest('hex');

      const key = this.keyRepo.create({
        walletId,
        tenantId,
        keyType: k.keyType,
        xpub: k.xpub,
        xpubHash,
        derivationPath: k.derivationPath ?? null,
        keyIndex: k.keyIndex,
        status: 'ACTIVE' as any,
      });
      savedKeys.push(await this.keyRepo.save(key));
    }

    return savedKeys;
  }

  private async validateBtcTestnetAddress(address: string, derivationPath?: string): Promise<void> {
    const bech32Pattern = /^tb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/;
    const testnetP2PKH = /^m[a-km-zA-HJ-NP-Z1-9]{33}$/;
    const testnetP2SH = /^2[a-km-zA-HJ-NP-Z1-9]{32,34}$/;

    if (!bech32Pattern.test(address) && !testnetP2PKH.test(address) && !testnetP2SH.test(address)) {
      throw new BadRequestException(
        'Invalid BTC testnet address format. Expected bech32 (bc1...), testnet P2PKH (m...), or testnet P2SH (2...)',
      );
    }

    if (derivationPath && !derivationPath.startsWith("m/48'")) {
      throw new BadRequestException(
        'BTC multisig derivation path must follow BIP-48: m/48\'/network\'/purpose\'/0\'/w\'',
      );
    }
  }

  private verifyBtcTestnetAddress(
    address: string,
    expectedDerivationPath?: string,
  ): { valid: boolean; reason?: string } {
    const bech32Pattern = /^tb1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,71}$/;
    const testnetP2PKH = /^m[a-km-zA-HJ-NP-Z1-9]{33}$/;
    const testnetP2SH = /^2[a-km-zA-HJ-NP-Z1-9]{32,34}$/;

    if (!bech32Pattern.test(address) && !testnetP2PKH.test(address) && !testnetP2SH.test(address)) {
      return { valid: false, reason: 'Invalid BTC testnet address format' };
    }

    if (expectedDerivationPath && !expectedDerivationPath.startsWith("m/48'")) {
      return { valid: false, reason: 'Derivation path does not follow BIP-48 for multisig' };
    }

    return { valid: true };
  }
}