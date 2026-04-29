import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER } from '@nestjs/core/constants';
import { AppDataSource } from './database/data-source';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { RoleModule } from './role/role.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionModule } from './transaction/transaction.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AddressModule } from './address/address.module';
import { KeyModule } from './key/key.module';
import { PolicyModule } from './policy/policy.module';
import { ApprovalModule } from './approval/approval.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL || 'postgres://localhost:5432/custodian',
        entities: [],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsTableName: 'migrations',
        synchronize: false,
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),
    TenantModule,
    UserModule,
    RoleModule,
    ApiKeyModule,
    WalletModule,
    TransactionModule,
    AuditLogModule,
    AddressModule,
    KeyModule,
    PolicyModule,
    ApprovalModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
