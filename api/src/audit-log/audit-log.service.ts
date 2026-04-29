import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditEventType } from './audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(params: {
    tenantId: string;
    eventType: AuditEventType;
    actorId: string | null;
    actorType: string | null;
    payload?: Record<string, unknown>;
  }): Promise<AuditLog> {
    const log = this.auditLogRepo.create(params);
    return this.auditLogRepo.save(log);
  }

  async findAll(tenantId: string, limit = 100): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
