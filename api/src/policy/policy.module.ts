import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from './policy.entity';
import { PolicyRule } from './policy-rule.entity';
import { DestinationAllowlist } from './destination-allowlist.entity';
import { AddressCooldown } from './address-cooldown.entity';
import { RequiredApproval } from './required-approval.entity';
import { TransactionRequest } from '../transaction/transaction.entity';
import { Wallet } from '../wallet/wallet.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Policy,
      PolicyRule,
      DestinationAllowlist,
      AddressCooldown,
      RequiredApproval,
      TransactionRequest,
      Wallet,
      AuditLog,
    ]),
  ],
  controllers: [PolicyController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
