import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PolicyRule } from './policy-rule.entity';
import { DestinationAllowlist } from './destination-allowlist.entity';
import { RequiredApproval } from './required-approval.entity';

@Entity('policies')
export class Policy {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => PolicyRule, (rule) => rule.policy)
  rules: PolicyRule[];

  @OneToMany(() => DestinationAllowlist, (entry) => entry.policy)
  destinationAllowlist: DestinationAllowlist[];

  @OneToMany(() => RequiredApproval, (ra) => ra.policy)
  requiredApprovals: RequiredApproval[];
}
