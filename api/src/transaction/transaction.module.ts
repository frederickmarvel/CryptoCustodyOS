import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionRequest } from './transaction.entity';
import { TransactionController } from './transaction.controller';
import { TransactionService } from './transaction.service';
import { AuditLog } from '../audit-log/audit-log.entity';
import { Wallet } from '../wallet/wallet.entity';
import { Address } from '../address/address.entity';
import { TransactionBuilderModule } from '../transaction-builder/transaction-builder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionRequest, AuditLog, Wallet, Address]),
    TransactionBuilderModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService],
})
export class TransactionModule {}