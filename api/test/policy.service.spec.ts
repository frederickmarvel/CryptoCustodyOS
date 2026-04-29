import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PolicyService, PolicyViolation } from '../src/policy/policy.service';
import { Policy } from '../src/policy/policy.entity';
import { PolicyRule, RuleType } from '../src/policy/policy-rule.entity';
import { DestinationAllowlist } from '../src/policy/destination-allowlist.entity';
import { AddressCooldown } from '../src/policy/address-cooldown.entity';
import { RequiredApproval } from '../src/policy/required-approval.entity';
import { TransactionRequest, TransactionState, Asset, FeePolicy } from '../src/transaction/transaction.entity';
import { Wallet, WalletType, WalletStorageClass } from '../src/wallet/wallet.entity';
import { AuditLog } from '../src/audit-log/audit-log.entity';

function makeMockWallet(): Wallet {
  return {
    id: 'wallet-001',
    tenantId: 'tenant-001',
    tenant: null as any,
    name: 'Test BTC Wallet',
    type: WalletType.BTC_MULTISIG_2_OF_3,
    storageClass: WalletStorageClass.COLD,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Wallet;
}

function makeMockTx(overrides: Partial<TransactionRequest> = {}): TransactionRequest {
  return {
    id: 'tx-001',
    tenantId: 'tenant-001',
    walletId: 'wallet-001',
    createdBy: 'user-creator',
    amount: '0.1',
    asset: Asset.BTC,
    chainSymbol: 'BTC',
    network: 'bitcoin-testnet',
    destination: 'tb1qtestdest123456789abcdef',
    state: TransactionState.DRAFT,
    payloadHash: null,
    feePolicy: FeePolicy.MEDIUM,
    unsignedPayload: null,
    networkFee: null,
    utxoInputs: null,
    payloadLockedAt: null,
    btcPsbtBase64: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPayloadLocked: () => false,
    ...overrides,
  } as TransactionRequest;
}

describe('PolicyService', () => {
  let service: PolicyService;
  let policyRepo: jest.Mocked<Repository<Policy>>;
  let ruleRepo: jest.Mocked<Repository<PolicyRule>>;
  let txRepo: jest.Mocked<Repository<TransactionRequest>>;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        { provide: getRepositoryToken(Policy), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(PolicyRule), useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(DestinationAllowlist), useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(AddressCooldown), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn() } },
        { provide: getRepositoryToken(RequiredApproval), useValue: { create: jest.fn(), save: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(TransactionRequest), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(Wallet), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { create: jest.fn(), save: jest.fn() } },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    policyRepo = module.get(getRepositoryToken(Policy));
    ruleRepo = module.get(getRepositoryToken(PolicyRule));
    txRepo = module.get(getRepositoryToken(TransactionRequest));
    walletRepo = module.get(getRepositoryToken(Wallet));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
  });

  describe('evaluateTransaction', () => {
    it('returns empty violations when no policies exist', async () => {
      walletRepo.findOne.mockResolvedValue(makeMockWallet());
      txRepo.findOne.mockResolvedValue(makeMockTx());
      policyRepo.find.mockResolvedValue([]);

      const result = await service.evaluateTransaction('tx-001', 'tenant-001');
      expect(result).toEqual([]);
    });

    it('returns violation for BLOCKED_ADDRESS', async () => {
      const policy = {
        id: 'policy-001', tenantId: 'tenant-001', name: 'Block Policy', isActive: true,
        rules: [{ id: 'rule-001', policyId: 'policy-001', ruleType: RuleType.BLOCKED_ADDRESS, ruleConfig: { chainSymbol: 'BTC', network: 'bitcoin-testnet', address: 'tb1qtestdest123456789abcdef' }, policy: {} as Policy }],
      } as Policy;

      walletRepo.findOne.mockResolvedValue(makeMockWallet());
      txRepo.findOne.mockResolvedValue(makeMockTx());
      policyRepo.find.mockResolvedValue([policy]);

      const result = await service.evaluateTransaction('tx-001', 'tenant-001');
      expect(result.length).toBe(1);
      expect(result[0].ruleType).toBe(RuleType.BLOCKED_ADDRESS);
    });

    it('returns violation for MAX_TRANSACTIONS_PER_DAY', async () => {
      const policy = { id: 'policy-001', tenantId: 'tenant-001', name: 'Rate Limit Policy', isActive: true, rules: [{ id: 'rule-001', policyId: 'policy-001', ruleType: RuleType.MAX_TRANSACTIONS_PER_DAY, ruleConfig: { count: 3, chainSymbol: 'BTC', network: 'bitcoin-testnet' }, policy: {} as Policy }] } as Policy;

      walletRepo.findOne.mockResolvedValue(makeMockWallet());
      txRepo.findOne.mockResolvedValue(makeMockTx({ chainSymbol: 'BTC', network: 'bitcoin-testnet' }));
      policyRepo.find.mockResolvedValue([policy]);
      txRepo.count.mockResolvedValue(5);

      const result = await service.evaluateTransaction('tx-001', 'tenant-001');
      expect(result.length).toBe(1);
      expect(result[0].ruleType).toBe(RuleType.MAX_TRANSACTIONS_PER_DAY);
    });
  });

  describe('create', () => {
    it('creates a policy with audit log', async () => {
      const dto = {
        name: 'Test Policy',
        description: 'A test policy',
        priority: 1,
        rules: [{ ruleType: RuleType.PER_TRANSACTION_LIMIT, ruleConfig: { amountSat: 1000000, chainSymbol: 'BTC', network: 'bitcoin-testnet' } }],
      };

      policyRepo.create.mockReturnValue({ id: 'policy_abc', ...dto } as Policy);
      policyRepo.save.mockResolvedValue({ id: 'policy_abc', ...dto } as Policy);
      policyRepo.findOne.mockResolvedValue({ id: 'policy_abc', tenantId: 'tenant-001', name: 'Test Policy', isActive: true, rules: [], destinationAllowlist: [], requiredApprovals: [] } as Policy);
      ruleRepo.create.mockReturnValue({ id: 'rule_abc' } as PolicyRule);
      ruleRepo.save.mockResolvedValue({ id: 'rule_abc' } as PolicyRule);
      auditLogRepo.create.mockReturnValue({} as AuditLog);
      auditLogRepo.save.mockResolvedValue({} as AuditLog);

      const result = await service.create('tenant-001', dto);

      expect(policyRepo.save).toHaveBeenCalled();
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'POLICY_CREATED' }),
      );
    });
  });
});
