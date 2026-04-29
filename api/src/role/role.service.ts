import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';
import { CreateRoleDto } from './dto/create-role.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const role = this.roleRepo.create(dto);
    return this.roleRepo.save(role);
  }

  async findAll(tenantId: string): Promise<Role[]> {
    return this.roleRepo.find({ where: { tenantId } });
  }
}
