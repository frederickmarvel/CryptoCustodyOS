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
import { Policy } from '../policy/policy.entity';
import { PolicyRule } from '../policy/policy-rule.entity';
import { DestinationAllowlist } from '../policy/destination-allowlist.entity';
import { AddressCooldown } from '../policy/address-cooldown.entity';
import { RequiredApproval } from '../policy/required-approval.entity';
import { Approval } from '../approval/approval.entity';
import { InitialMigration } from './migrations/InitialMigration';
import { AddressKeyMigration } from './migrations/AddressKeyMigration';
import { TransactionPayloadMigration } from './migrations/TransactionPayloadMigration';
import { PolicyApprovalMigration1745942400000 as PolicyApprovalMigration } from './migrations/PolicyApprovalMigration';
import { Phase5SignedPayloadMigration1777420800000 as Phase5SignedPayloadMigration } from './migrations/Phase5SignedPayloadMigration';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgres://localhost:5432/custodian',
  entities: [Tenant, User, Role, ApiKey, Wallet, TransactionRequest, AuditLog, Address, Key, Policy, PolicyRule, DestinationAllowlist, AddressCooldown, RequiredApproval, Approval],
  migrations: [InitialMigration, AddressKeyMigration, TransactionPayloadMigration, PolicyApprovalMigration, Phase5SignedPayloadMigration],
  migrationsTableName: 'migrations',
  synchronize: false,
  logging: process.env.NODE_ENV !== 'production',
});
