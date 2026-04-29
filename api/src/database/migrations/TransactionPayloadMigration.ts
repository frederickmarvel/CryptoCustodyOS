import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransactionPayloadMigration implements MigrationInterface {
  name = 'TransactionPayloadMigration';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transaction_requests
      ADD COLUMN payload_hash VARCHAR(64),
      ADD COLUMN unsigned_payload JSONB,
      ADD COLUMN fee_policy VARCHAR(20) DEFAULT 'MEDIUM',
      ADD COLUMN network_fee DECIMAL(18, 8),
      ADD COLUMN utxo_inputs JSONB,
      ADD COLUMN payload_locked_at TIMESTAMP,
      ADD COLUMN btc_psbt_base64 TEXT
    `);

    await queryRunner.query(`
      ALTER TABLE transaction_requests
      ADD CONSTRAINT chk_fee_policy
      CHECK (fee_policy IN ('LOW', 'MEDIUM', 'HIGH', 'CUSTOM'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transaction_requests
      DROP COLUMN IF EXISTS payload_hash,
      DROP COLUMN IF EXISTS unsigned_payload,
      DROP COLUMN IF EXISTS fee_policy,
      DROP COLUMN IF EXISTS network_fee,
      DROP COLUMN IF EXISTS utxo_inputs,
      DROP COLUMN IF EXISTS payload_locked_at,
      DROP COLUMN IF EXISTS btc_psbt_base64
    `);
  }
}