import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Policy } from './policy.entity';
import { PolicyRule, RuleType } from './policy-rule.entity';
import { DestinationAllowlist } from './destination-allowlist.entity';
import { AddressCooldown } from './address-cooldown.entity';
import { RequiredApproval } from './required-approval.entity';
import { TransactionRequest, TransactionState } from '../transaction/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { AuditLog, AuditEventType } from '../audit-log/audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

export interface PolicyViolation {
  ruleType: RuleType;
  message: string;
  ruleId: string;
}

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
    @InjectRepository(PolicyRule)
    private ruleRepo: Repository<PolicyRule>,
    @InjectRepository(DestinationAllowlist)
    private destAllowlistRepo: Repository<DestinationAllowlist>,
    @InjectRepository(AddressCooldown)
    private cooldownRepo: Repository<AddressCooldown>,
    @InjectRepository(RequiredApproval)
    private requiredApprovalRepo: Repository<RequiredApproval>,
    @InjectRepository(TransactionRequest)
    private txRepo: Repository<TransactionRequest>,
    @InjectRepository(Wallet)
    private walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async create(tenantId: string, dto: {
    name: string;
    description?: string;
    priority?: number;
    rules?: Array<{ ruleType: RuleType; ruleConfig: Record<string, any> }>;
  }): Promise<Policy> {
    const id = `policy_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    const policy = this.policyRepo.create({
      id,
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      priority: dto.priority ?? 0,
      isActive: true,
    });
    await this.policyRepo.save(policy);

    if (dto.rules) {
      for (const r of dto.rules) {
        const rule = this.ruleRepo.create({
          id: `rule_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
          policyId: id,
          ruleType: r.ruleType,
          ruleConfig: r.ruleConfig,
        });
        await this.ruleRepo.save(rule);
      }
    }

    await this.auditLogRepo.save(this.auditLogRepo.create({
      id: `audit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      eventType: AuditEventType.POLICY_CREATED,
      actorId: tenantId,
      actorType: 'TENANT',
      payload: { policyId: id, policyName: dto.name },
    }));

    return this.findById(id, tenantId);
  }

  async findById(id: string, tenantId: string): Promise<Policy> {
    const policy = await this.policyRepo.findOne({
      where: { id, tenantId },
      relations: ['rules', 'destinationAllowlist', 'requiredApprovals'],
    });
    if (!policy) throw new NotFoundException(`Policy ${id} not found`);
    return policy;
  }

  async findAllByTenant(tenantId: string): Promise<Policy[]> {
    return this.policyRepo.find({
      where: { tenantId },
      relations: ['rules'],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async evaluateTransaction(txId: string, tenantId: string): Promise<PolicyViolation[]> {
    const tx = await this.txRepo.findOne({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);

    const wallet = await this.walletRepo.findOne({ where: { id: tx.walletId, tenantId } });
    if (!wallet) throw new NotFoundException(`Wallet ${tx.walletId} not found`);

    const activePolicies = await this.policyRepo.find({
      where: { tenantId, isActive: true },
      relations: ['rules'],
      order: { priority: 'DESC' },
    });

    const violations: PolicyViolation[] = [];

    for (const policy of activePolicies) {
      for (const rule of policy.rules) {
        const violation = await this.evaluateRule(tx, wallet, rule, tenantId);
        if (violation) {
          violations.push(violation);
        }
      }
    }

    return violations;
  }

  private async evaluateRule(
    tx: TransactionRequest,
    wallet: Wallet,
    rule: PolicyRule,
    tenantId: string,
  ): Promise<PolicyViolation | null> {
    const config = rule.ruleConfig as Record<string, any>;

    switch (rule.ruleType) {
      case RuleType.PER_TRANSACTION_LIMIT: {
        if (tx.chainSymbol === config.chainSymbol && tx.network === config.network) {
          if (Number(tx.amount) > config.amountSat) {
            return {
              ruleType: rule.ruleType,
              message: `Amount ${tx.amount} exceeds per-transaction limit ${config.amountSat} for ${config.chainSymbol}`,
              ruleId: rule.id,
            };
          }
        }
        return null;
      }

      case RuleType.DAILY_LIMIT: {
        const config = rule.ruleConfig as { amountSat: number; chainSymbol: string; network: string };
        if (tx.chainSymbol === config.chainSymbol && tx.network === config.network) {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const todayTxs = await this.txRepo
            .createQueryBuilder('tx')
            .where('tx.tenantId = :tenantId', { tenantId })
            .andWhere('tx.chainSymbol = :chainSymbol', { chainSymbol: config.chainSymbol })
            .andWhere('tx.network = :network', { network: config.network })
            .andWhere('tx.createdAt >= :startOfDay', { startOfDay })
            .getMany();
          const total = todayTxs.reduce((sum, t) => sum + Number(t.amount), 0);
          if (total + Number(tx.amount) > config.amountSat) {
            return {
              ruleType: rule.ruleType,
              message: `Daily limit ${config.amountSat} exceeded for ${config.chainSymbol}`,
              ruleId: rule.id,
            };
          }
        }
        return null;
      }

      case RuleType.DESTINATION_ALLOWLIST: {
        const config = rule.ruleConfig as { chainSymbol: string; network: string; allowSelf: boolean };
        if (tx.chainSymbol !== config.chainSymbol || tx.network !== config.network) return null;

        const entries = await this.destAllowlistRepo.find({
          where: { policyId: rule.policyId },
        });

        if (config.allowSelf) {
          const walletAddrs = await this.walletRepo
            .createQueryBuilder('w')
            .leftJoinAndSelect('w.addresses', 'addr')
            .where('w.id = :walletId', { walletId: tx.walletId })
            .getMany();
          const selfAddrs = walletAddrs.flatMap((w) => (w as any).addresses?.map((a: any) => a.address) ?? []);
          if (selfAddrs.includes(tx.destination)) return null;
        }

        const matched = entries.some((e) => {
          const regex = new RegExp(e.addressPattern);
          return regex.test(tx.destination);
        });

        if (!matched) {
          return {
            ruleType: rule.ruleType,
            message: `Destination ${tx.destination} not in allowlist for ${config.chainSymbol}`,
            ruleId: rule.id,
          };
        }
        return null;
      }

      case RuleType.ADDRESS_COOLDOWN: {
        const config = rule.ruleConfig as { chainSymbol: string; network: string; cooldownSeconds: number };
        if (tx.chainSymbol !== config.chainSymbol || tx.network !== config.network) return null;

        const cooldown = await this.cooldownRepo.findOne({
          where: { tenantId, address: tx.destination, chainSymbol: config.chainSymbol },
        });

        if (cooldown && cooldown.cooldownUntil > new Date()) {
          return {
            ruleType: rule.ruleType,
            message: `Destination address is in cooldown until ${cooldown.cooldownUntil.toISOString()}`,
            ruleId: rule.id,
          };
        }
        return null;
      }

      case RuleType.SEPARATION_OF_DUTIES: {
        const config = rule.ruleConfig as { creatorCannotApprove: boolean; rolesThatCannotApprove: string[] };
        if (!config.creatorCannotApprove) return null;
        // Check is done at approval time, not evaluation time
        return null;
      }

      case RuleType.WHITELIST_ONLY: {
        const config = rule.ruleConfig as { chainSymbol: string; network: string };
        if (tx.chainSymbol !== config.chainSymbol || tx.network !== config.network) return null;

        const entries = await this.destAllowlistRepo.find({
          where: { policyId: rule.policyId },
        });

        if (entries.length === 0) {
          return {
            ruleType: rule.ruleType,
            message: `Whitelist-only policy has no entries for ${config.chainSymbol}`,
            ruleId: rule.id,
          };
        }
        return null;
      }

      case RuleType.BLOCKED_ADDRESS: {
        const config = rule.ruleConfig as { chainSymbol: string; network: string; address: string };
        if (tx.chainSymbol === config.chainSymbol && tx.network === config.network &&
            tx.destination === config.address) {
          return {
            ruleType: rule.ruleType,
            message: `Destination address ${config.address} is blocked`,
            ruleId: rule.id,
          };
        }
        return null;
      }

      case RuleType.MAX_TRANSACTIONS_PER_DAY: {
        const config = rule.ruleConfig as { count: number; chainSymbol: string; network: string };
        if (tx.chainSymbol !== config.chainSymbol || tx.network !== config.network) return null;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const count = await this.txRepo.count({
          where: {
            tenantId,
            chainSymbol: config.chainSymbol,
            createdAt: startOfDay,
          },
        });

        if (count >= config.count) {
          return {
            ruleType: rule.ruleType,
            message: `Maximum ${config.count} transactions per day reached for ${config.chainSymbol}`,
            ruleId: rule.id,
          };
        }
        return null;
      }

      default:
        return null;
    }
  }

  async addRule(policyId: string, tenantId: string, dto: {
    ruleType: RuleType;
    ruleConfig: Record<string, any>;
  }): Promise<PolicyRule> {
    const policy = await this.findById(policyId, tenantId);
    const rule = this.ruleRepo.create({
      id: `rule_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      policyId: policy.id,
      ruleType: dto.ruleType,
      ruleConfig: dto.ruleConfig,
    });
    await this.ruleRepo.save(rule);

    await this.auditLogRepo.save(this.auditLogRepo.create({
      id: `audit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      eventType: AuditEventType.POLICY_UPDATED,
      actorId: tenantId,
      actorType: 'TENANT',
      payload: { policyId, ruleId: rule.id, ruleType: dto.ruleType },
    }));

    return rule;
  }

  async addDestinationAllowlist(policyId: string, tenantId: string, dto: {
    chainSymbol: string;
    network: string;
    addressPattern: string;
    label?: string;
  }): Promise<DestinationAllowlist> {
    await this.findById(policyId, tenantId);
    const entry = this.destAllowlistRepo.create({
      id: `dest_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      policyId,
      chainSymbol: dto.chainSymbol,
      network: dto.network,
      addressPattern: dto.addressPattern,
      label: dto.label ?? null,
    });
    return this.destAllowlistRepo.save(entry);
  }

  async addAddressCooldown(tenantId: string, dto: {
    chainSymbol: string;
    network: string;
    address: string;
    cooldownSeconds: number;
    reason?: string;
  }): Promise<AddressCooldown> {
    const cooldownUntil = new Date(Date.now() + dto.cooldownSeconds * 1000);
    const entry = this.cooldownRepo.create({
      id: `cool_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      chainSymbol: dto.chainSymbol,
      network: dto.network,
      address: dto.address,
      cooldownUntil,
      reason: dto.reason ?? null,
    });
    return this.cooldownRepo.save(entry);
  }
}
