import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5SignedPayloadMigration1777420800000 implements MigrationInterface {
  name = 'Phase5SignedPayloadMigration1777420800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transaction_requests
      ALTER COLUMN payload_hash TYPE VARCHAR(71)
    `);

    await queryRunner.query(`
      ALTER TABLE approvals
      ALTER COLUMN payload_hash TYPE VARCHAR(71)
    `);

    await queryRunner.query(`
      ALTER TABLE transaction_requests
      ADD COLUMN signed_payload JSONB,
      ADD COLUMN signed_payload_hash VARCHAR(71),
      ADD COLUMN signer_key_ids JSONB,
      ADD COLUMN signed_at TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE transaction_requests
      DROP COLUMN IF EXISTS signed_payload,
      DROP COLUMN IF EXISTS signed_payload_hash,
      DROP COLUMN IF EXISTS signer_key_ids,
      DROP COLUMN IF EXISTS signed_at
    `);

    await queryRunner.query(`
      ALTER TABLE approvals
      ALTER COLUMN payload_hash TYPE VARCHAR(64)
    `);

    await queryRunner.query(`
      ALTER TABLE transaction_requests
      ALTER COLUMN payload_hash TYPE VARCHAR(64)
    `);
  }
}
