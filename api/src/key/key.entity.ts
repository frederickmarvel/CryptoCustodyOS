import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Wallet } from '../wallet/wallet.entity';
import { Tenant } from '../tenant/tenant.entity';

export enum KeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  COMPROMISED = 'COMPROMISED',
}

@Entity('keys')
export class Key {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'key_type', type: 'varchar', length: 50 })
  keyType: string;

  @Column({ name: 'xpub', type: 'text', nullable: true })
  xpub: string | null;

  @Column({ name: 'xpub_hash', type: 'varchar', length: 64 })
  xpubHash: string;

  @Column({ name: 'derivation_path', type: 'varchar', length: 255, nullable: true })
  derivationPath: string | null;

  @Column({ name: 'key_index', type: 'int' })
  keyIndex: number;

  @Column({ type: 'enum', enum: KeyStatus, default: KeyStatus.ACTIVE })
  status: KeyStatus;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}