import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './api-key.entity';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyService } from './api-key.service';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey, AuditLog])],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
})
export class ApiKeyModule {}
