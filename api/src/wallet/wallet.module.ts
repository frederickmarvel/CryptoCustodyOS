import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Wallet, AuditLog])],
  controllers: [WalletController],
  providers: [WalletService],
})
export class WalletModule {}
