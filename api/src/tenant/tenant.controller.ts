import { Controller, Post, Body, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './tenant.entity';

@ApiTags('Tenants')
@Controller('v1/tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant' })
  create(@Body() dto: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  findAll(): Promise<Tenant[]> {
    return this.tenantService.findAll();
  }
}
