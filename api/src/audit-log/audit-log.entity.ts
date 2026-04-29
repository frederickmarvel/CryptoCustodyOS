import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

export enum AuditEventType {
  TENANT_CREATED = 'TENANT_CREATED',
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_ROTATED = 'API_KEY_ROTATED',
  WALLET_CREATED = 'WALLET_CREATED',
  ADDRESS_CREATED = 'ADDRESS_CREATED',
  POLICY_CREATED = 'POLICY_CREATED',
  POLICY_UPDATED = 'POLICY_UPDATED',
  WITHDRAWAL_CREATED = 'WITHDRAWAL_CREATED',
  WITHDRAWAL_APPROVED = 'WITHDRAWAL_APPROVED',
  WITHDRAWAL_REJECTED = 'WITHDRAWAL_REJECTED',
  WITHDRAWAL_CANCELLED = 'WITHDRAWAL_CANCELLED',
  SIGNING_PAYLOAD_EXPORTED = 'SIGNING_PAYLOAD_EXPORTED',
  SIGNED_PAYLOAD_IMPORTED = 'SIGNED_PAYLOAD_IMPORTED',
  TRANSACTION_BROADCASTED = 'TRANSACTION_BROADCASTED',
  TRANSACTION_CONFIRMED = 'TRANSACTION_CONFIRMED',
  EMERGENCY_FREEZE_ENABLED = 'EMERGENCY_FREEZE_ENABLED',
  EMERGENCY_FREEZE_DISABLED = 'EMERGENCY_FREEZE_DISABLED',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'event_type', type: 'enum', enum: AuditEventType })
  eventType: AuditEventType;

  @Column({ name: 'actor_id', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_type', nullable: true })
  actorType: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
