import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey } from './api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = `ck_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 8);

    const apiKey = this.apiKeyRepo.create({
      tenantId: dto.tenantId,
      keyHash,
      keyPrefix,
      name: dto.name,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    const saved = await this.apiKeyRepo.save(apiKey);

    const audit = this.auditLogRepo.create({
      tenantId: saved.tenantId,
      eventType: AuditEventType.API_KEY_CREATED,
      actorId: null,
      actorType: 'system',
      payload: { apiKeyId: saved.id, name: saved.name, keyPrefix: saved.keyPrefix },
    });
    await this.auditLogRepo.save(audit);

    return { apiKey: saved, rawKey };
  }

  async validate(rawKey: string): Promise<ApiKey | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyRepo.findOne({ where: { keyHash } });
    if (!apiKey) return null;
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) return null;
    return apiKey;
  }

  async findById(id: string): Promise<ApiKey | null> {
    return this.apiKeyRepo.findOne({ where: { id } });
  }
}
