import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Policy } from './policy.entity';

export enum RuleType {
  DAILY_LIMIT = 'DAILY_LIMIT',
  PER_TRANSACTION_LIMIT = 'PER_TRANSACTION_LIMIT',
  DESTINATION_ALLOWLIST = 'DESTINATION_ALLOWLIST',
  ADDRESS_COOLDOWN = 'ADDRESS_COOLDOWN',
  APPROVAL_THRESHOLD = 'APPROVAL_THRESHOLD',
  WHitelIST_ONLY = 'WHITELIST_ONLY',
  BLOCKED_ADDRESS = 'BLOCKED_ADDRESS',
  MAX_TRANSACTIONS_PER_DAY = 'MAX_TRANSACTIONS_PER_DAY',
  SEPARATION_OF_DUTIES = 'SEPARATION_OF_DUTIES',
}

export interface DailyLimitConfig {
  amountSat: number;
  chainSymbol: string;
  network: string;
}

export interface PerTransactionLimitConfig {
  amountSat: number;
  chainSymbol: string;
  network: string;
}

export interface DestinationAllowlistConfig {
  chainSymbol: string;
  network: string;
  allowSelf: boolean;
}

export interface AddressCooldownConfig {
  chainSymbol: string;
  network: string;
  cooldownSeconds: number;
}

export interface ApprovalThresholdConfig {
  minApprovals: number;
  requireDifferentUsers: boolean;
  walletIds: string[];
  chainSymbols: string[];
}

export interface WhitelistOnlyConfig {
  chainSymbol: string;
  network: string;
}

export interface BlockedAddressConfig {
  chainSymbol: string;
  network: string;
  address: string;
}

export interface MaxTransactionsPerDayConfig {
  count: number;
  chainSymbol: string;
  network: string;
}

export interface SeparationOfDutiesConfig {
  creatorCannotApprove: boolean;
  rolesThatCannotApprove: string[];
}

export type RuleConfig =
  | DailyLimitConfig
  | PerTransactionLimitConfig
  | DestinationAllowlistConfig
  | AddressCooldownConfig
  | ApprovalThresholdConfig
  | WhitelistOnlyConfig
  | BlockedAddressConfig
  | MaxTransactionsPerDayConfig
  | SeparationOfDutiesConfig;

@Entity('policy_rules')
export class PolicyRule {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ name: 'policy_id', type: 'varchar', length: 36 })
  policyId: string;

  @Column({ name: 'rule_type', type: 'varchar', length: 50 })
  ruleType: RuleType;

  @Column({ name: 'rule_config', type: 'jsonb' })
  ruleConfig: RuleConfig;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Policy, (policy) => policy.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: Policy;
}
