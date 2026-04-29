import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Approval, ApprovalDecision } from './approval.entity';
import { Policy } from '../policy/policy.entity';
import { RequiredApproval } from '../policy/required-approval.entity';
import { PolicyService } from '../policy/policy.service';
import { TransactionRequest, TransactionState } from '../transaction/transaction.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ApprovalWorkflowService {
  constructor(
    @InjectRepository(Approval)
    private approvalRepo: Repository<Approval>,
    @InjectRepository(TransactionRequest)
    private txRepo: Repository<TransactionRequest>,
    @InjectRepository(Policy)
    private policyRepo: Repository<Policy>,
    @InjectRepository(RequiredApproval)
    private requiredApprovalRepo: Repository<RequiredApproval>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private policyService: PolicyService,
  ) {}

  async approve(
    txId: string,
    approverId: string,
    approverType: string,
    tenantId: string,
    reason?: string,
  ): Promise<Approval> {
    const tx = await this.txRepo.findOne({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);

    if (tx.state !== TransactionState.PENDING_APPROVAL) {
      throw new ConflictException(`Transaction ${txId} is not in PENDING_APPROVAL state (current: ${tx.state})`);
    }

    if (!tx.payloadHash) {
      throw new BadRequestException(`Transaction ${txId} has no payload hash — unsigned payload must be generated first`);
    }

    // Check for existing approval by same approver
    const existing = await this.approvalRepo.findOne({
      where: { transactionRequestId: txId, approverId },
    });
    if (existing) {
      throw new ConflictException(`Approver ${approverId} has already acted on this transaction`);
    }

    // Separation of duties: creator cannot approve
    if (tx.createdBy === approverId) {
      throw new ForbiddenException('Transaction creator cannot also approve — separation of duties required');
    }

    // Evaluate policy violations
    const violations = await this.policyService.evaluateTransaction(txId, tenantId);
    if (violations.length > 0) {
      throw new BadRequestException({
        message: 'Policy violations prevent approval',
        violations: violations.map((v) => ({
          type: v.ruleType,
          reason: v.message,
        })),
      });
    }

    // Check required approvals config
    const requiredApprovals = await this.requiredApprovalRepo.find({
      where: { walletId: tx.walletId },
    });

    let effectiveMinApprovals = 1;
    let requireDifferentUsers = true;

    if (requiredApprovals.length > 0) {
      const match = requiredApprovals.find(
        (ra) => ra.walletId === tx.walletId && (!ra.chainSymbol || ra.chainSymbol === tx.chainSymbol),
      );
      if (match) {
        effectiveMinApprovals = match.minApprovals;
        requireDifferentUsers = match.requireDifferentUsers;
      }
    }

    // Count existing approvals
    const existingApprovals = await this.approvalRepo.count({
      where: { transactionRequestId: txId, decision: ApprovalDecision.APPROVED },
    });

    if (requireDifferentUsers && existingApprovals >= effectiveMinApprovals) {
      throw new ConflictException(`Required ${effectiveMinApprovals} approvals already collected`);
    }

    const approval = this.approvalRepo.create({
      id: `approval_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      transactionRequestId: txId,
      approverId,
      approverType,
      decision: ApprovalDecision.APPROVED,
      reason: reason ?? null,
      payloadHash: tx.payloadHash,
    });
    await this.approvalRepo.save(approval);

    // Reload to check if we now have enough approvals
    const currentApprovals = await this.approvalRepo.count({
      where: { transactionRequestId: txId, decision: ApprovalDecision.APPROVED },
    });

    if (currentApprovals >= effectiveMinApprovals) {
      await this.txRepo.update(txId, { state: TransactionState.APPROVED });
    } else {
      await this.txRepo.update(txId, { state: TransactionState.PARTIALLY_SIGNED });
    }

    await this.auditLogRepo.save(this.auditLogRepo.create({
      id: `audit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      eventType: 'WITHDRAWAL_APPROVED',
      actorId: approverId,
      actorType: approverType,
      payload: {
        transactionRequestId: txId,
        approvalId: approval.id,
        payloadHash: tx.payloadHash,
        approvalsCollected: currentApprovals,
        minRequired: effectiveMinApprovals,
      },
    }));

    return approval;
  }

  async reject(
    txId: string,
    rejecterId: string,
    rejecterType: string,
    tenantId: string,
    reason?: string,
  ): Promise<Approval> {
    const tx = await this.txRepo.findOne({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);

    if (tx.state === TransactionState.REJECTED || tx.state === TransactionState.CANCELLED) {
      throw new ConflictException(`Transaction ${txId} is already ${tx.state}`);
    }

    if (tx.state === TransactionState.SIGNED || tx.state === TransactionState.BROADCASTED || tx.state === TransactionState.CONFIRMED) {
      throw new BadRequestException(`Cannot reject transaction in ${tx.state} state`);
    }

    const approval = this.approvalRepo.create({
      id: `approval_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      transactionRequestId: txId,
      approverId: rejecterId,
      approverType: rejecterType,
      decision: ApprovalDecision.REJECTED,
      reason: reason ?? null,
      payloadHash: tx.payloadHash,
    });
    await this.approvalRepo.save(approval);

    await this.txRepo.update(txId, { state: TransactionState.REJECTED });

    await this.auditLogRepo.save(this.auditLogRepo.create({
      id: `audit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      eventType: 'WITHDRAWAL_REJECTED',
      actorId: rejecterId,
      actorType: rejecterType,
      payload: { transactionRequestId: txId, approvalId: approval.id, reason },
    }));

    return approval;
  }

  async cancel(txId: string, userId: string, tenantId: string, reason?: string): Promise<TransactionRequest> {
    const tx = await this.txRepo.findOne({ where: { id: txId, tenantId } });
    if (!tx) throw new NotFoundException(`Transaction ${txId} not found`);

    if (tx.state === TransactionState.SIGNED || tx.state === TransactionState.BROADCASTED || tx.state === TransactionState.CONFIRMED) {
      throw new BadRequestException(`Cannot cancel transaction in ${tx.state} state`);
    }

    await this.txRepo.update(txId, { state: TransactionState.CANCELLED });

    await this.auditLogRepo.save(this.auditLogRepo.create({
      id: `audit_${uuidv4().replace(/-/g, '').substring(0, 16)}`,
      tenantId,
      eventType: 'WITHDRAWAL_CANCELLED',
      actorId: userId,
      actorType: 'USER',
      payload: { transactionRequestId: txId, reason },
    }));

    return this.txRepo.findOne({ where: { id: txId } });
  }

  async getApprovalsForTransaction(txId: string, tenantId: string): Promise<Approval[]> {
    return this.approvalRepo.find({
      where: { transactionRequestId: txId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }
}
