import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const tenant = this.tenantRepo.create({ name: dto.name });
    const saved = await this.tenantRepo.save(tenant);

    const audit = this.auditLogRepo.create({
      tenantId: saved.id,
      eventType: AuditEventType.TENANT_CREATED,
      actorId: null,
      actorType: 'system',
      payload: { tenantId: saved.id, name: saved.name },
    });
    await this.auditLogRepo.save(audit);

    return saved;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepo.find();
  }

  async findOne(id: string): Promise<Tenant | null> {
    return this.tenantRepo.findOne({ where: { id } });
  }
}
