import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateWalletDto): Promise<Wallet> {
    const wallet = this.walletRepo.create(dto);
    const saved = await this.walletRepo.save(wallet);

    const audit = this.auditLogRepo.create({
      tenantId: saved.tenantId,
      eventType: AuditEventType.WALLET_CREATED,
      actorId: null,
      actorType: 'system',
      payload: { walletId: saved.id, name: saved.name, type: saved.type },
    });
    await this.auditLogRepo.save(audit);

    return saved;
  }

  async findAll(tenantId: string): Promise<Wallet[]> {
    return this.walletRepo.find({ where: { tenantId } });
  }

  async findOne(id: string, tenantId: string): Promise<Wallet | null> {
    return this.walletRepo.findOne({ where: { id, tenantId } });
  }
}
