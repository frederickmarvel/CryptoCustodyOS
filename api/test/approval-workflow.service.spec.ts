import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalWorkflowService } from '../src/approval/approval-workflow.service';
import { Approval, ApprovalDecision } from '../src/approval/approval.entity';
import { TransactionRequest, TransactionState, Asset, FeePolicy } from '../src/transaction/transaction.entity';
import { Policy } from '../src/policy/policy.entity';
import { RequiredApproval } from '../src/policy/required-approval.entity';
import { PolicyService } from '../src/policy/policy.service';
import { AuditLog } from '../src/audit-log/audit-log.entity';

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
    state: TransactionState.PENDING_APPROVAL,
    payloadHash: 'sha256:abc123',
    feePolicy: FeePolicy.MEDIUM,
    unsignedPayload: null,
    networkFee: '1000',
    utxoInputs: null,
    payloadLockedAt: null,
    btcPsbtBase64: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPayloadLocked: () => false,
    ...overrides,
  } as TransactionRequest;
}

describe('ApprovalWorkflowService', () => {
  let service: ApprovalWorkflowService;
  let approvalRepo: jest.Mocked<Repository<Approval>>;
  let txRepo: jest.Mocked<Repository<TransactionRequest>>;
  let requiredApprovalRepo: jest.Mocked<Repository<RequiredApproval>>;
  let auditLogRepo: jest.Mocked<Repository<AuditLog>>;
  let policyService: jest.Mocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalWorkflowService,
        { provide: getRepositoryToken(Approval), useValue: { create: jest.fn(), save: jest.fn(), findOne: jest.fn(), count: jest.fn(), find: jest.fn() } },
        { provide: getRepositoryToken(TransactionRequest), useValue: { findOne: jest.fn(), update: jest.fn() } },
        { provide: getRepositoryToken(Policy), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(RequiredApproval), useValue: { find: jest.fn() } },
        { provide: getRepositoryToken(AuditLog), useValue: { create: jest.fn(), save: jest.fn() } },
        { provide: PolicyService, useValue: { evaluateTransaction: jest.fn() } },
      ],
    }).compile();

    service = module.get<ApprovalWorkflowService>(ApprovalWorkflowService);
    approvalRepo = module.get(getRepositoryToken(Approval));
    txRepo = module.get(getRepositoryToken(TransactionRequest));
    requiredApprovalRepo = module.get(getRepositoryToken(RequiredApproval));
    auditLogRepo = module.get(getRepositoryToken(AuditLog));
    policyService = module.get(PolicyService);
  });

  describe('approve', () => {
    it('rejects transaction not in PENDING_APPROVAL state', async () => {
      const wrongStateTx = makeMockTx({ state: TransactionState.DRAFT });
      txRepo.findOne.mockResolvedValue(wrongStateTx);

      await expect(
        service.approve('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when transaction has no payload hash', async () => {
      const noHashTx = makeMockTx({ payloadHash: null });
      txRepo.findOne.mockResolvedValue(noHashTx);

      await expect(
        service.approve('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects self-approval (creator cannot approve)', async () => {
      txRepo.findOne.mockResolvedValue(makeMockTx());

      await expect(
        service.approve('tx-001', 'user-creator', 'USER', 'tenant-001'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects when approver already acted', async () => {
      txRepo.findOne.mockResolvedValue(makeMockTx());
      approvalRepo.findOne.mockResolvedValue({ id: 'existing' } as Approval);

      await expect(
        service.approve('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects when policy violations exist', async () => {
      txRepo.findOne.mockResolvedValue(makeMockTx());
      approvalRepo.findOne.mockResolvedValue(null);
      policyService.evaluateTransaction.mockResolvedValue([
        { ruleType: 'PER_TRANSACTION_LIMIT' as any, message: 'Amount exceeds limit', ruleId: 'rule-001' },
      ]);

      await expect(
        service.approve('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(BadRequestException);
    });

    it('approves and transitions to APPROVED when enough approvals collected', async () => {
      txRepo.findOne.mockResolvedValue(makeMockTx());
      approvalRepo.findOne.mockResolvedValue(null);
      let countCallCount = 0;
      approvalRepo.count.mockImplementation(() => {
        countCallCount++;
        return Promise.resolve(countCallCount === 2 ? 1 : 0);
      });
      policyService.evaluateTransaction.mockResolvedValue([]);
      requiredApprovalRepo.find.mockResolvedValue([]);
      approvalRepo.create.mockReturnValue({ id: 'approval-001' } as Approval);
      approvalRepo.save.mockResolvedValue({ id: 'approval-001' } as Approval);
      auditLogRepo.create.mockReturnValue({} as AuditLog);
      auditLogRepo.save.mockResolvedValue({} as AuditLog);

      await service.approve('tx-001', 'approver-001', 'USER', 'tenant-001', 'LGTM');

      expect(approvalRepo.save).toHaveBeenCalled();
      expect(txRepo.update).toHaveBeenCalledWith('tx-001', { state: TransactionState.APPROVED });
    });
  });

  describe('reject', () => {
    it('rejects and transitions state to REJECTED', async () => {
      txRepo.findOne.mockResolvedValue(makeMockTx());
      approvalRepo.create.mockReturnValue({ id: 'approval-rej' } as Approval);
      approvalRepo.save.mockResolvedValue({ id: 'approval-rej' } as Approval);
      auditLogRepo.create.mockReturnValue({} as AuditLog);
      auditLogRepo.save.mockResolvedValue({} as AuditLog);

      await service.reject('tx-001', 'approver-001', 'USER', 'tenant-001', 'Not enough info');

      expect(txRepo.update).toHaveBeenCalledWith('tx-001', { state: TransactionState.REJECTED });
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'WITHDRAWAL_REJECTED' }),
      );
    });

    it('throws if transaction already rejected', async () => {
      const rejectedTx = makeMockTx({ state: TransactionState.REJECTED });
      txRepo.findOne.mockResolvedValue(rejectedTx);

      await expect(
        service.reject('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws if transaction already signed', async () => {
      const signedTx = makeMockTx({ state: TransactionState.SIGNED });
      txRepo.findOne.mockResolvedValue(signedTx);

      await expect(
        service.reject('tx-001', 'approver-001', 'USER', 'tenant-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('cancels a DRAFT transaction', async () => {
      const draftTx = makeMockTx({ state: TransactionState.DRAFT });
      txRepo.findOne.mockResolvedValue(draftTx);
      txRepo.update.mockResolvedValue({} as any);
      txRepo.findOne.mockResolvedValue({ ...draftTx, state: TransactionState.CANCELLED } as TransactionRequest);
      auditLogRepo.create.mockReturnValue({} as AuditLog);
      auditLogRepo.save.mockResolvedValue({} as AuditLog);

      await service.cancel('tx-001', 'user-creator', 'tenant-001', 'Changed my mind');

      expect(txRepo.update).toHaveBeenCalledWith('tx-001', { state: TransactionState.CANCELLED });
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'WITHDRAWAL_CANCELLED' }),
      );
    });

    it('throws if transaction already broadcasted', async () => {
      const broadcastedTx = makeMockTx({ state: TransactionState.BROADCASTED });
      txRepo.findOne.mockResolvedValue(broadcastedTx);

      await expect(
        service.cancel('tx-001', 'user-creator', 'tenant-001'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
