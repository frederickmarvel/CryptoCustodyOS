import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Approval } from './approval.entity';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { TransactionRequest } from '../transaction/transaction.entity';
import { Policy } from '../policy/policy.entity';
import { RequiredApproval } from '../policy/required-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Approval, TransactionRequest, Policy, RequiredApproval, AuditLog]),
    forwardRef(() => PolicyModule),
  ],
  providers: [ApprovalWorkflowService],
  exports: [ApprovalWorkflowService],
})
export class ApprovalModule {}
