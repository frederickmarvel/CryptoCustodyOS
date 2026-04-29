import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Policy } from './policy.entity';

@Entity('destination_allowlist')
export class DestinationAllowlist {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'policy_id', type: 'varchar', length: 36 })
  policyId: string;

  @Column({ name: 'chain_symbol', type: 'varchar', length: 20 })
  chainSymbol: string;

  @Column({ type: 'varchar', length: 50 })
  network: string;

  @Column({ name: 'address_pattern', type: 'varchar', length: 255 })
  addressPattern: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Policy, (policy) => policy.destinationAllowlist, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;
}
