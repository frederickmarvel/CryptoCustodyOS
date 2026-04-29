import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TransactionRequest } from '../transaction/transaction.entity';

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('approvals')
export class Approval {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId: string;

  @Column({ name: 'transaction_request_id', type: 'varchar', length: 36 })
  transactionRequestId: string;

  @Column({ name: 'approver_id', type: 'varchar', length: 36 })
  approverId: string;

  @Column({ name: 'approver_type', type: 'varchar', length: 20 })
  approverType: string;

  @Column({ type: 'varchar', length: 20 })
  decision: ApprovalDecision;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'policy_id', type: 'varchar', length: 36, nullable: true })
  policyId: string | null;

  @Column({ name: 'payload_hash', type: 'varchar', length: 71, nullable: true })
  payloadHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => TransactionRequest, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transaction_request_id' })
  transactionRequest: TransactionRequest;
}
