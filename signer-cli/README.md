# Custody Signer CLI

Offline signer MVP for the Custodian Bitcoin testnet flow.

## Commands

```bash
cargo run -- init
cargo run -- create-key --asset BTC
cargo run -- export-xpub --key-id <key_id>
cargo run -- inspect unsigned_tx.json
cargo run -- sign unsigned_tx.json --output signed_tx.json --key-id <key_id>
cargo run -- verify-backup --key-id <key_id>
cargo run -- restore-backup backups/<key_id>.backup.json
```

For tests and automation, set:

```bash
export CUSTODY_SIGNER_PASSPHRASE='dev-only-passphrase'
export CUSTODY_SIGNER_HOME=/tmp/custody-signer
```

Production operators should enter the passphrase interactively and keep the signer home on offline encrypted storage.

## Security Boundary

The CLI stores seed bytes encrypted with Argon2id and AES-256-GCM. It exports only public key metadata and signed payload files. It never prints raw private keys, seed bytes, seed phrases, or mnemonics.
