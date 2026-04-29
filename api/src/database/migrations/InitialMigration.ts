import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration implements MigrationInterface {
  name = 'InitialMigration';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE roles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        permissions JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        key_prefix VARCHAR(8) NOT NULL,
        name VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE wallet_type_enum AS ENUM (
        'BTC_MULTISIG_2_OF_3', 'EVM_SAFE', 'EVM_TESTNET_EOA',
        'TRON_MULTISIG', 'SOLANA_MULTISIG', 'MPC_FUTURE'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE wallet_storage_class_enum AS ENUM (
        'HOT', 'WARM', 'COLD', 'OFFLINE_COLD', 'HSM', 'MPC_SHARE'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE wallets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name VARCHAR(255) NOT NULL,
        type wallet_type_enum NOT NULL,
        storage_class wallet_storage_class_enum NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE transaction_state_enum AS ENUM (
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SIGNING_PENDING',
        'PARTIALLY_SIGNED', 'SIGNED', 'BROADCASTED', 'CONFIRMED',
        'REJECTED', 'FAILED', 'CANCELLED'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE asset_enum AS ENUM ('BTC', 'ETH', 'ERC20', 'MATIC', 'ARB', 'BNB', 'TRX', 'SOL')
    `);

    await queryRunner.query(`
      CREATE TABLE transaction_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        wallet_id UUID NOT NULL,
        created_by UUID NOT NULL,
        state transaction_state_enum NOT NULL DEFAULT 'DRAFT',
        amount DECIMAL(36, 18) NOT NULL,
        asset asset_enum NOT NULL,
        destination VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE audit_event_type_enum AS ENUM (
        'TENANT_CREATED', 'API_KEY_CREATED', 'API_KEY_ROTATED',
        'WALLET_CREATED', 'ADDRESS_CREATED', 'POLICY_CREATED', 'POLICY_UPDATED',
        'WITHDRAWAL_CREATED', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED',
        'WITHDRAWAL_CANCELLED', 'SIGNING_PAYLOAD_EXPORTED', 'SIGNED_PAYLOAD_IMPORTED',
        'TRANSACTION_BROADCASTED', 'TRANSACTION_CONFIRMED',
        'EMERGENCY_FREEZE_ENABLED', 'EMERGENCY_FREEZE_DISABLED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        event_type audit_event_type_enum NOT NULL,
        actor_id UUID,
        actor_type VARCHAR(50),
        payload JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`ALTER TABLE users ADD CONSTRAINT users_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE roles ADD CONSTRAINT roles_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE api_keys ADD CONSTRAINT api_keys_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE wallets ADD CONSTRAINT wallets_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE transaction_requests ADD CONSTRAINT tx_requests_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE transaction_requests ADD CONSTRAINT tx_requests_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallets(id)`);
    await queryRunner.query(`ALTER TABLE transaction_requests ADD CONSTRAINT tx_requests_creator_fk FOREIGN KEY (created_by) REFERENCES users(id)`);
    await queryRunner.query(`ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`);
    await queryRunner.query(`DROP TABLE IF EXISTS transaction_requests`);
    await queryRunner.query(`DROP TABLE IF EXISTS wallets`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS roles`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
    await queryRunner.query(`DROP TYPE IF EXISTS audit_event_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS asset_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS transaction_state_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS wallet_storage_class_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS wallet_type_enum`);
  }
}
