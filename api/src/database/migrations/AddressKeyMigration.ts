import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddressKeyMigration implements MigrationInterface {
  name = 'AddressKeyMigration';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE address_status_enum AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPROMISED')
    `);
    await queryRunner.query(`
      CREATE TYPE key_status_enum AS ENUM ('ACTIVE', 'REVOKED', 'COMPROMISED')
    `);

    await queryRunner.query(`
      CREATE TABLE addresses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        wallet_id UUID NOT NULL,
        address TEXT NOT NULL,
        derivation_path VARCHAR(255),
        derivation_index INT DEFAULT 0,
        chain_symbol VARCHAR(20) NOT NULL,
        network VARCHAR(50) NOT NULL,
        status address_status_enum DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        wallet_id UUID NOT NULL,
        key_type VARCHAR(50) NOT NULL,
        xpub TEXT,
        xpub_hash VARCHAR(64) NOT NULL,
        derivation_path VARCHAR(255),
        key_index INT NOT NULL,
        status key_status_enum DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await queryRunner.query(`ALTER TABLE addresses ADD CONSTRAINT addresses_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE addresses ADD CONSTRAINT addresses_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallets(id)`);
    await queryRunner.query(`ALTER TABLE keys ADD CONSTRAINT keys_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id)`);
    await queryRunner.query(`ALTER TABLE keys ADD CONSTRAINT keys_wallet_fk FOREIGN KEY (wallet_id) REFERENCES wallets(id)`);

    await queryRunner.query(`CREATE INDEX idx_addresses_wallet_id ON addresses(wallet_id)`);
    await queryRunner.query(`CREATE INDEX idx_addresses_tenant_id ON addresses(tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_keys_wallet_id ON keys(wallet_id)`);
    await queryRunner.query(`CREATE INDEX idx_keys_tenant_id ON keys(tenant_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS addresses`);
    await queryRunner.query(`DROP TYPE IF EXISTS key_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS address_status_enum`);
  }
}