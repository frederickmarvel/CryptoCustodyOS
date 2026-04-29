import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

export enum WalletType {
  BTC_MULTISIG_2_OF_3 = 'BTC_MULTISIG_2_OF_3',
  EVM_SAFE = 'EVM_SAFE',
  EVM_TESTNET_EOA = 'EVM_TESTNET_EOA',
  TRON_MULTISIG = 'TRON_MULTISIG',
  SOLANA_MULTISIG = 'SOLANA_MULTISIG',
  MPC_FUTURE = 'MPC_FUTURE',
}

export enum WalletStorageClass {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
  OFFLINE_COLD = 'OFFLINE_COLD',
  HSM = 'HSM',
  MPC_SHARE = 'MPC_SHARE',
}

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: WalletType })
  type: WalletType;

  @Column({ name: 'storage_class', type: 'enum', enum: WalletStorageClass })
  storageClass: WalletStorageClass;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
