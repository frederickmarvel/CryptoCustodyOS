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

export enum AddressStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  COMPROMISED = 'COMPROMISED',
}

@Entity('addresses')
export class Address {
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

  @Column({ type: 'text' })
  address: string;

  @Column({ name: 'derivation_path', type: 'varchar', length: 255, nullable: true })
  derivationPath: string | null;

  @Column({ name: 'derivation_index', type: 'int', default: 0 })
  derivationIndex: number;

  @Column({ name: 'chain_symbol', type: 'varchar', length: 20 })
  chainSymbol: string;

  @Column({ name: 'network', type: 'varchar', length: 50 })
  network: string;

  @Column({ type: 'enum', enum: AddressStatus, default: AddressStatus.ACTIVE })
  status: AddressStatus;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;
}