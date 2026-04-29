import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { Role } from './role.entity';

@ApiTags('Roles')
@Controller('v1/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new role' })
  create(@Body() dto: CreateRoleDto): Promise<Role> {
    return this.roleService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List roles for a tenant' })
  findAll(@Query('tenant_id') tenantId: string): Promise<Role[]> {
    return this.roleService.findAll(tenantId);
  }
}
