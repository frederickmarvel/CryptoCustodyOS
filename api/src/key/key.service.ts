import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { Key, KeyStatus } from './key.entity';
import { Wallet } from '../wallet/wallet.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Injectable()
export class KeyService {
  constructor(
    @InjectRepository(Key)
    private readonly keyRepo: Repository<Key>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async registerKeys(
    walletId: string,
    tenantId: string,
    keys: Array<{
      keyType: string;
      xpub: string;
      derivationPath?: string;
      keyIndex: number;
    }>,
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
        status: KeyStatus.ACTIVE,
      });
      savedKeys.push(await this.keyRepo.save(key));
    }

    return savedKeys;
  }

  async findByWallet(walletId: string, tenantId: string): Promise<Key[]> {
    return this.keyRepo.find({ where: { walletId, tenantId }, order: { keyIndex: 'ASC' } });
  }

  async revoke(keyId: string, tenantId: string): Promise<Key> {
    const key = await this.keyRepo.findOne({ where: { id: keyId, tenantId } });
    if (!key) {
      throw new NotFoundException('Key not found');
    }
    key.status = KeyStatus.REVOKED;
    return this.keyRepo.save(key);
  }
}