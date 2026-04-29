import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('address_cooldowns')
export class AddressCooldown {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'chain_symbol', type: 'varchar', length: 20 })
  chainSymbol: string;

  @Column({ type: 'varchar', length: 50 })
  network: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  @Column({ name: 'cooldown_until', type: 'timestamp' })
  cooldownUntil: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
