import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './audit-log.entity';

@ApiTags('Audit Logs')
@Controller('v1/audit-logs')
@ApiSecurity('X-API-Key')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs for a tenant' })
  findAll(@Query('tenant_id') tenantId: string, @Query('limit') limit?: number): Promise<AuditLog[]> {
    return this.auditLogService.findAll(tenantId, limit);
  }
}
