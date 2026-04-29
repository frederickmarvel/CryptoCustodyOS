import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from './address.entity';
import { Key } from '../key/key.entity';
import { AddressController } from './address.controller';
import { AddressService } from './address.service';
import { Wallet } from '../wallet/wallet.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Address, Key, Wallet, AuditLog])],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}