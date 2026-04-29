import { MigrationInterface, QueryRunner } from 'typeorm';

export class PolicyApprovalMigration1745942400000 implements MigrationInterface {
  name = 'PolicyApprovalMigration1745942400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Policies table ---
    await queryRunner.query(`
      CREATE TABLE "policies" (
        "id" VARCHAR(36) PRIMARY KEY,
        "tenant_id" VARCHAR(36) NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "priority" INTEGER NOT NULL DEFAULT 0,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_policies_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_policies_tenant" ON "policies"("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_policies_active" ON "policies"("is_active")`);

    // --- Policy rules table ---
    await queryRunner.query(`
      CREATE TABLE "policy_rules" (
        "id" VARCHAR(36) PRIMARY KEY,
        "policy_id" VARCHAR(36) NOT NULL,
        "rule_type" VARCHAR(50) NOT NULL,
        "rule_config" JSONB NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_policy_rules_policy" FOREIGN KEY ("policy_id")
          REFERENCES "policies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_policy_rules_policy" ON "policy_rules"("policy_id")`);

    // --- Destination allowlist table ---
    await queryRunner.query(`
      CREATE TABLE "destination_allowlist" (
        "id" VARCHAR(36) PRIMARY KEY,
        "policy_id" VARCHAR(36) NOT NULL,
        "chain_symbol" VARCHAR(20) NOT NULL,
        "network" VARCHAR(50) NOT NULL,
        "address_pattern" VARCHAR(255) NOT NULL,
        "label" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_dest_allowlist_policy" FOREIGN KEY ("policy_id")
          REFERENCES "policies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_dest_allowlist_policy" ON "destination_allowlist"("policy_id")`);

    // --- Address cooldown table ---
    await queryRunner.query(`
      CREATE TABLE "address_cooldowns" (
        "id" VARCHAR(36) PRIMARY KEY,
        "tenant_id" VARCHAR(36) NOT NULL,
        "chain_symbol" VARCHAR(20) NOT NULL,
        "network" VARCHAR(50) NOT NULL,
        "address" VARCHAR(255) NOT NULL,
        "cooldown_until" TIMESTAMP NOT NULL,
        "reason" VARCHAR(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_addr_cooldown_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_addr_cooldown_tenant" ON "address_cooldowns"("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_addr_cooldown_expires" ON "address_cooldowns"("cooldown_until")`);

    // --- Approvals table ---
    await queryRunner.query(`
      CREATE TABLE "approvals" (
        "id" VARCHAR(36) PRIMARY KEY,
        "tenant_id" VARCHAR(36) NOT NULL,
        "transaction_request_id" VARCHAR(36) NOT NULL,
        "approver_id" VARCHAR(36) NOT NULL,
        "approver_type" VARCHAR(20) NOT NULL,
        "decision" VARCHAR(20) NOT NULL,
        "reason" TEXT,
        "policy_id" VARCHAR(36),
        "payload_hash" VARCHAR(64),
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_approvals_tenant" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_approvals_tx" FOREIGN KEY ("transaction_request_id")
          REFERENCES "transaction_requests"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_approvals_tenant" ON "approvals"("tenant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_approvals_tx" ON "approvals"("transaction_request_id")`);
    await queryRunner.query(`CREATE INDEX "idx_approvals_approver" ON "approvals"("approver_id")`);

    // --- Required approvals config table ---
    await queryRunner.query(`
      CREATE TABLE "required_approvals" (
        "id" VARCHAR(36) PRIMARY KEY,
        "policy_id" VARCHAR(36) NOT NULL,
        "wallet_id" VARCHAR(36),
        "chain_symbol" VARCHAR(20),
        "min_approvals" INTEGER NOT NULL,
        "require_different_users" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "fk_req_approvals_policy" FOREIGN KEY ("policy_id")
          REFERENCES "policies"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_req_approvals_policy" ON "required_approvals"("policy_id")`);
    await queryRunner.query(`CREATE INDEX "idx_req_approvals_wallet" ON "required_approvals"("wallet_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "required_approvals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approvals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "address_cooldowns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "destination_allowlist"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policy_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "policies"`);
  }
}
