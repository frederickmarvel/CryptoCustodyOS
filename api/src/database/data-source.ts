import { DataSource } from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { User } from '../user/user.entity';
import { Role } from '../role/role.entity';
import { ApiKey } from '../api-key/api-key.entity';
import { Wallet } from '../wallet/wallet.entity';
import { TransactionRequest } from '../transaction/transaction.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { Address } from '../address/address.entity';
import { Key } from '../key/key.entity';
import { InitialMigration } from './migrations/InitialMigration';
import { AddressKeyMigration } from './migrations/AddressKeyMigration';
import { TransactionPayloadMigration } from './migrations/TransactionPayloadMigration';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgres://localhost:5432/custodian',
  entities: [Tenant, User, Role, ApiKey, Wallet, TransactionRequest, AuditLog, Address, Key],
  migrations: [InitialMigration, AddressKeyMigration, TransactionPayloadMigration],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
