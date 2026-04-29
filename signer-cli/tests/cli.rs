use assert_cmd::Command;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use custody_signer::canonical::sha256_prefixed;
use serde_json::json;
use tempfile::TempDir;

fn unsigned_fixture() -> serde_json::Value {
    let payload = json!({
        "version": "1.0",
        "txRequestId": "txreq_cli_001",
        "tenantId": "tenant_001",
        "walletId": "wallet_btc_001",
        "asset": "BTC",
        "amount": "0.01000000",
        "destination": "tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9",
        "network": "bitcoin-testnet",
        "feePolicy": "MEDIUM",
        "networkFee": "1000",
        "utxoInputs": [],
        "changeAddress": "tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9",
        "createdAt": "2026-04-29T00:00:00.000Z"
    });
    let psbt = json!({
        "globalMap": {"xpubs": [], "unknown": {}},
        "inputs": [],
        "outputs": [],
        "network": "bitcoin-testnet"
    });

    json!({
        "txRequestId": "txreq_cli_001",
        "payload": payload,
        "payloadHash": sha256_prefixed(&payload),
        "btcPsbtBase64": STANDARD.encode(serde_json::to_vec(&psbt).unwrap()),
        "createdAt": "2026-04-29T00:00:00.000Z"
    })
}

#[test]
fn cli_inspects_and_signs_payload() {
    let temp = TempDir::new().unwrap();
    let signer_home = temp.path().join("signer");
    let unsigned_path = temp.path().join("unsigned_tx.json");
    let signed_path = temp.path().join("signed_tx.json");
    std::fs::write(
        &unsigned_path,
        serde_json::to_vec_pretty(&unsigned_fixture()).unwrap(),
    )
    .unwrap();

    Command::cargo_bin("custody-signer")
        .unwrap()
        .arg("--data-dir")
        .arg(&signer_home)
        .arg("init")
        .assert()
        .success();

    Command::cargo_bin("custody-signer")
        .unwrap()
        .arg("--data-dir")
        .arg(&signer_home)
        .arg("create-key")
        .arg("--asset")
        .arg("BTC")
        .env("CUSTODY_SIGNER_PASSPHRASE", "cli-passphrase")
        .assert()
        .success();

    Command::cargo_bin("custody-signer")
        .unwrap()
        .arg("--data-dir")
        .arg(&signer_home)
        .arg("inspect")
        .arg(&unsigned_path)
        .assert()
        .success()
        .stdout(predicates::str::contains("tx_request_id: txreq_cli_001"));

    Command::cargo_bin("custody-signer")
        .unwrap()
        .arg("--data-dir")
        .arg(&signer_home)
        .arg("sign")
        .arg(&unsigned_path)
        .arg("--output")
        .arg(&signed_path)
        .env("CUSTODY_SIGNER_PASSPHRASE", "cli-passphrase")
        .write_stdin("SIGN txreq_cli_001\n")
        .assert()
        .success();

    let signed: serde_json::Value =
        serde_json::from_slice(&std::fs::read(signed_path).unwrap()).unwrap();
    assert_eq!(signed["txRequestId"], "txreq_cli_001");
    assert_eq!(signed["signatureCount"], 1);
}
