import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Key } from './key.entity';
import { KeyService } from './key.service';
import { Wallet } from '../wallet/wallet.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Key, Wallet, AuditLog])],
  providers: [KeyService],
  exports: [KeyService],
})
export class KeyModule {}