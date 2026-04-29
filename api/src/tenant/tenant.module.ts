import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, AuditLog])],
  controllers: [TenantController],
  providers: [TenantService],
})
export class TenantModule {}
