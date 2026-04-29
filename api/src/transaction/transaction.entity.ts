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
import { Wallet } from '../wallet/wallet.entity';
import { User } from '../user/user.entity';

export enum TransactionState {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  SIGNING_PENDING = 'SIGNING_PENDING',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  SIGNED = 'SIGNED',
  BROADCASTED = 'BROADCASTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum Asset {
  BTC = 'BTC',
  ETH = 'ETH',
  ERC20 = 'ERC20',
  MATIC = 'MATIC',
  ARB = 'ARB',
  BNB = 'BNB',
  TRX = 'TRX',
  SOL = 'SOL',
}

export enum FeePolicy {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CUSTOM = 'CUSTOM',
}

export interface UtxoInput {
  txid: string;
  vout: number;
  satoshis: number;
  address: string;
  derivationPath?: string;
}

export interface UnsignedPayload {
  version: string;
  txRequestId: string;
  tenantId: string;
  walletId: string;
  asset: Asset;
  amount: string;
  destination: string;
  network: string;
  feePolicy: FeePolicy;
  networkFee: string;
  utxoInputs: UtxoInput[];
  changeAddress: string;
  createdAt: string;
}

export interface TransactionSummary {
  txRequestId: string;
  state: TransactionState;
  asset: Asset;
  amount: string;
  destination: string;
  networkFee: string;
  feePolicy: FeePolicy;
  walletId: string;
  walletName: string;
  tenantId: string;
  utxoCount: number;
  payloadHash: string | null;
  createdAt: string;
}

@Entity('transaction_requests')
export class TransactionRequest {
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

  @Column({ name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ type: 'enum', enum: TransactionState, default: TransactionState.DRAFT })
  state: TransactionState;

  @Column('decimal', { precision: 36, scale: 18 })
  amount: string;

  @Column({ type: 'enum', enum: Asset })
  asset: Asset;

  @Column({ name: 'chain_symbol', type: 'varchar', length: 20, nullable: true })
  chainSymbol: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  network: string | null;

  @Column()
  destination: string;

  @Column({ name: 'payload_hash', type: 'varchar', length: 64, nullable: true })
  payloadHash: string | null;

  @Column({ name: 'unsigned_payload', type: 'jsonb', nullable: true })
  unsignedPayload: UnsignedPayload | null;

  @Column({ name: 'fee_policy', type: 'varchar', length: 20, default: FeePolicy.MEDIUM })
  feePolicy: FeePolicy;

  @Column({ name: 'network_fee', type: 'decimal', precision: 18, scale: 8, nullable: true })
  networkFee: string | null;

  @Column({ name: 'utxo_inputs', type: 'jsonb', nullable: true })
  utxoInputs: UtxoInput[] | null;

  @Column({ name: 'payload_locked_at', type: 'timestamp', nullable: true })
  payloadLockedAt: Date | null;

  @Column({ name: 'btc_psbt_base64', type: 'text', nullable: true })
  btcPsbtBase64: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  isPayloadLocked(): boolean {
    return this.payloadLockedAt !== null;
  }
}