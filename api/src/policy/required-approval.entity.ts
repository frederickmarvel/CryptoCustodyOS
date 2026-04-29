import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Policy } from './policy.entity';

@Entity('required_approvals')
export class RequiredApproval {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'policy_id', type: 'varchar', length: 36 })
  policyId: string;

  @Column({ name: 'wallet_id', type: 'varchar', length: 36, nullable: true })
  walletId: string | null;

  @Column({ name: 'chain_symbol', type: 'varchar', length: 20, nullable: true })
  chainSymbol: string | null;

  @Column({ name: 'min_approvals', type: 'int' })
  minApprovals: number;

  @Column({ name: 'require_different_users', type: 'boolean', default: true })
  requireDifferentUsers: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Policy, (policy) => policy.requiredApprovals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;
}
