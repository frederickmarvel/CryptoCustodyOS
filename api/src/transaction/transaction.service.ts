import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TransactionRequest,
  TransactionState,
  UnsignedPayload,
  TransactionSummary,
  UtxoInput,
} from './transaction.entity';
import { Wallet, WalletType } from '../wallet/wallet.entity';
import { Address } from '../address/address.entity';
import { CreateWithdrawDto } from './dto/create-withdraw.dto';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';
import { UtxoService } from '../transaction-builder/utxo.service';
import { FeeService } from '../transaction-builder/fee.service';
import { PsbtBuilderService } from '../transaction-builder/psbt-builder.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(TransactionRequest)
    private readonly txRepo: Repository<TransactionRequest>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Address)
    private readonly addressRepo: Repository<Address>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly utxoService: UtxoService,
    private readonly feeService: FeeService,
    private readonly psbtBuilder: PsbtBuilderService,
  ) {}

  async createWithdraw(dto: CreateWithdrawDto): Promise<TransactionRequest> {
    const tx = this.txRepo.create({
      tenantId: dto.tenantId,
      walletId: dto.walletId,
      createdBy: dto.creatorId,
      amount: dto.amount,
      asset: dto.asset,
      destination: dto.destination,
      state: TransactionState.DRAFT,
    });
    const saved = await this.txRepo.save(tx);

    const audit = this.auditLogRepo.create({
      tenantId: saved.tenantId,
      eventType: AuditEventType.WITHDRAWAL_CREATED,
      actorId: dto.creatorId,
      actorType: 'user',
      payload: {
        txRequestId: saved.id,
        walletId: saved.walletId,
        amount: saved.amount,
        asset: saved.asset,
        destination: saved.destination,
      },
    });
    await this.auditLogRepo.save(audit);

    return saved;
  }

  async findOne(id: string, tenantId: string): Promise<TransactionRequest | null> {
    return this.txRepo.findOne({ where: { id, tenantId } });
  }

  async findAll(tenantId: string): Promise<TransactionRequest[]> {
    return this.txRepo.find({ where: { tenantId } });
  }

  async generateUnsignedPayload(
    txRequestId: string,
    tenantId: string,
    feePolicy?: string,
    customFeeSatPerVb?: number,
    changeAddress?: string,
  ): Promise<TransactionRequest> {
    const tx = await this.txRepo.findOne({ where: { id: txRequestId, tenantId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.isPayloadLocked()) {
      throw new ConflictException('Payload is already locked and cannot be modified');
    }

    if (tx.state !== TransactionState.DRAFT) {
      throw new BadRequestException('Payload can only be generated for DRAFT transactions');
    }

    const wallet = await this.walletRepo.findOne({ where: { id: tx.walletId, tenantId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const addresses = await this.addressRepo.find({ where: { walletId: tx.walletId }, order: { derivationIndex: 'ASC' } });
    if (addresses.length === 0) {
      throw new BadRequestException('Wallet has no addresses — cannot build transaction');
    }

    const changeAddr = changeAddress ?? addresses[0].address;
    const network = this.chainToNetwork(tx.asset);
    const feeSatPerVb = customFeeSatPerVb ?? undefined;
    const policy = feePolicy as any ?? 'MEDIUM';

    const utxoEntries = await this.fetchMockUtxos(tx.walletId, addresses, network);
    const amountSats = Math.round(parseFloat(tx.amount) * 1e8);
    const { selected, change } = await this.utxoService.selectUtxos(utxoEntries, amountSats);

    const { totalFee, satPerVb } = await this.feeService.estimateFee(
      selected.length,
      2,
      policy,
      feeSatPerVb,
    );

    const utxoInputs: UtxoInput[] = selected.map((u) => ({
      txid: u.txid,
      vout: u.vout,
      satoshis: u.satoshis,
      address: u.address,
      derivationPath: u.derivationPath,
    }));

    let btcPsbtBase64: string | null = null;
    if (tx.asset === 'BTC' && wallet.type === WalletType.BTC_MULTISIG_2_OF_3) {
      btcPsbtBase64 = await this.psbtBuilder.buildBtcPsbt(
        utxoInputs,
        tx.destination,
        amountSats,
        changeAddr,
        network as 'bitcoin-testnet' | 'bitcoin-mainnet',
      );
    }

    const payload: UnsignedPayload = {
      version: '1.0',
      txRequestId: tx.id,
      tenantId: tx.tenantId,
      walletId: tx.walletId,
      asset: tx.asset,
      amount: tx.amount,
      destination: tx.destination,
      network,
      feePolicy: policy,
      networkFee: totalFee,
      utxoInputs,
      changeAddress: changeAddr,
      createdAt: new Date().toISOString(),
    };

    const payloadHash = this.psbtBuilder.computePayloadHash(payload);

    tx.unsignedPayload = payload;
    tx.payloadHash = payloadHash;
    tx.networkFee = totalFee;
    tx.feePolicy = policy;
    tx.utxoInputs = utxoInputs;
    tx.btcPsbtBase64 = btcPsbtBase64;

    const updated = await this.txRepo.save(tx);

    const audit = this.auditLogRepo.create({
      tenantId,
      eventType: AuditEventType.SIGNING_PAYLOAD_EXPORTED,
      actorId: tx.createdBy,
      actorType: 'user',
      payload: { txRequestId: tx.id, payloadHash, asset: tx.asset, amount: tx.amount },
    });
    await this.auditLogRepo.save(audit);

    return updated;
  }

  async getUnsignedPayload(txRequestId: string, tenantId: string): Promise<UnsignedPayload | null> {
    const tx = await this.txRepo.findOne({ where: { id: txRequestId, tenantId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx.unsignedPayload;
  }

  async getSummary(txRequestId: string, tenantId: string): Promise<TransactionSummary> {
    const tx = await this.txRepo.findOne({ where: { id: txRequestId, tenantId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    const wallet = await this.walletRepo.findOne({ where: { id: tx.walletId, tenantId } });

    return {
      txRequestId: tx.id,
      state: tx.state,
      asset: tx.asset,
      amount: tx.amount,
      destination: tx.destination,
      networkFee: tx.networkFee ?? '0',
      feePolicy: tx.feePolicy,
      walletId: tx.walletId,
      walletName: wallet?.name ?? 'Unknown',
      tenantId: tx.tenantId,
      utxoCount: tx.utxoInputs?.length ?? 0,
      payloadHash: tx.payloadHash,
      createdAt: tx.createdAt.toISOString(),
    };
  }

  async lockPayload(txRequestId: string, tenantId: string): Promise<TransactionRequest> {
    const tx = await this.txRepo.findOne({ where: { id: txRequestId, tenantId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (!tx.unsignedPayload) {
      throw new BadRequestException('Cannot lock a transaction with no unsigned payload');
    }

    tx.payloadLockedAt = new Date();
    return this.txRepo.save(tx);
  }

  private async fetchMockUtxos(walletId: string, addresses: Address[], network: string): Promise<any[]> {
    return addresses.map((addr, i) => ({
      txid: `mock${walletId}${i}`.repeat(16).slice(0, 64),
      vout: 0,
      satoshis: 100000000,
      address: addr.address,
      derivationPath: addr.derivationPath ?? null,
      confirmations: 6,
    }));
  }

  private chainToNetwork(asset: string): 'bitcoin-testnet' | 'bitcoin-mainnet' | string {
    if (asset === 'BTC') return 'bitcoin-testnet';
    return 'ethereum-mainnet';
  }
}