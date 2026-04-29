use crate::canonical::{sha256_hex, sha256_prefixed};
use crate::key_store::{derive_signing_material, KeyRecord};
use crate::{Result, SignerError};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bitcoin::secp256k1::{Message, Secp256k1};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsignedEnvelope {
    pub tx_request_id: String,
    pub payload: Value,
    pub payload_hash: String,
    pub btc_psbt_base64: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureRecord {
    pub key_id: String,
    pub fingerprint: String,
    pub public_key: String,
    pub derivation_path: String,
    pub payload_signature: String,
    pub psbt_digest: String,
    pub signed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedEnvelope {
    pub version: String,
    pub tx_request_id: String,
    pub wallet_id: String,
    pub payload_hash: String,
    pub asset: String,
    pub network: String,
    pub key_id: String,
    pub signer_fingerprint: String,
    pub signed_psbt_base64: String,
    pub signature_count: usize,
    pub signatures: Vec<SignatureRecord>,
    pub signed_at: String,
}

pub fn inspect_unsigned_file(path: &Path) -> Result<String> {
    let envelope = read_unsigned_file(path)?;
    verify_payload_hash(&envelope)?;
    Ok(format_summary(&envelope))
}

pub fn sign_unsigned_file(path: &Path, key: &KeyRecord, seed: &[u8]) -> Result<SignedEnvelope> {
    let envelope = read_unsigned_file(path)?;
    sign_envelope(&envelope, key, seed)
}

pub fn read_unsigned_file(path: &Path) -> Result<UnsignedEnvelope> {
    Ok(serde_json::from_slice(&fs::read(path)?)?)
}

pub fn verify_payload_hash(envelope: &UnsignedEnvelope) -> Result<()> {
    let computed = sha256_prefixed(&envelope.payload);
    if computed != envelope.payload_hash {
        return Err(SignerError::Message(format!(
            "payload hash mismatch: expected {}, computed {}",
            envelope.payload_hash, computed
        )));
    }
    Ok(())
}

pub fn sign_envelope(
    envelope: &UnsignedEnvelope,
    key: &KeyRecord,
    seed: &[u8],
) -> Result<SignedEnvelope> {
    verify_payload_hash(envelope)?;

    let asset = payload_string(&envelope.payload, "asset")?;
    let network = payload_string(&envelope.payload, "network")?;
    if asset != "BTC" {
        return Err(SignerError::Message(
            "Phase 5 signer supports BTC payloads only".to_string(),
        ));
    }
    if network != "bitcoin-testnet" {
        return Err(SignerError::Message(
            "Phase 5 signer only signs bitcoin-testnet payloads".to_string(),
        ));
    }

    let psbt_base64 = envelope.btc_psbt_base64.as_ref().ok_or_else(|| {
        SignerError::Message("unsigned payload does not include btcPsbtBase64".to_string())
    })?;
    let psbt_bytes = STANDARD.decode(psbt_base64)?;
    let psbt_digest = sha256_hex(&psbt_bytes);
    let material = derive_signing_material(seed)?;
    let signed_at = now_rfc3339();

    let message_digest = signing_digest(&envelope.payload_hash, &psbt_digest);
    let message = Message::from_digest(message_digest);
    let secp = Secp256k1::new();
    let signature = secp.sign_ecdsa(&message, &material.secret_key);

    let signature_record = SignatureRecord {
        key_id: key.key_id.clone(),
        fingerprint: material.fingerprint.clone(),
        public_key: material.public_key.clone(),
        derivation_path: key.derivation_path.clone(),
        payload_signature: hex::encode(signature.serialize_der()),
        psbt_digest,
        signed_at: signed_at.clone(),
    };

    let (signed_psbt_base64, signature_count) =
        append_mvp_signature(psbt_base64, &psbt_bytes, &signature_record)?;

    Ok(SignedEnvelope {
        version: "1.0".to_string(),
        tx_request_id: envelope.tx_request_id.clone(),
        wallet_id: payload_string(&envelope.payload, "walletId")?,
        payload_hash: envelope.payload_hash.clone(),
        asset,
        network,
        key_id: key.key_id.clone(),
        signer_fingerprint: material.fingerprint,
        signed_psbt_base64,
        signature_count,
        signatures: vec![signature_record],
        signed_at,
    })
}

pub fn format_summary(envelope: &UnsignedEnvelope) -> String {
    let amount =
        payload_string(&envelope.payload, "amount").unwrap_or_else(|_| "unknown".to_string());
    let asset =
        payload_string(&envelope.payload, "asset").unwrap_or_else(|_| "unknown".to_string());
    let destination =
        payload_string(&envelope.payload, "destination").unwrap_or_else(|_| "unknown".to_string());
    let network =
        payload_string(&envelope.payload, "network").unwrap_or_else(|_| "unknown".to_string());
    let wallet_id =
        payload_string(&envelope.payload, "walletId").unwrap_or_else(|_| "unknown".to_string());
    let fee = envelope
        .payload
        .get("networkFee")
        .map(|value| value_to_display(value))
        .unwrap_or_else(|| "unknown".to_string());
    let input_count = envelope
        .payload
        .get("utxoInputs")
        .and_then(Value::as_array)
        .map(|items| items.len())
        .unwrap_or_default();
    let psbt_status = if envelope.btc_psbt_base64.is_some() {
        "present"
    } else {
        "missing"
    };

    [
        "Unsigned transaction summary".to_string(),
        format!("tx_request_id: {}", envelope.tx_request_id),
        format!("wallet_id: {wallet_id}"),
        format!("asset: {asset}"),
        format!("amount: {amount}"),
        format!("destination: {destination}"),
        format!("network: {network}"),
        format!("network_fee_sats: {fee}"),
        format!("utxo_inputs: {input_count}"),
        format!("payload_hash: {}", envelope.payload_hash),
        format!("btc_psbt_base64: {psbt_status}"),
    ]
    .join("\n")
}

fn append_mvp_signature(
    original_psbt_base64: &str,
    psbt_bytes: &[u8],
    signature: &SignatureRecord,
) -> Result<(String, usize)> {
    let Ok(mut psbt_value) = serde_json::from_slice::<Value>(psbt_bytes) else {
        return Ok((original_psbt_base64.to_string(), 1));
    };

    let object = psbt_value
        .as_object_mut()
        .ok_or_else(|| SignerError::Message("decoded PSBT JSON is not an object".to_string()))?;
    let signatures = object
        .entry("partialSignatures")
        .or_insert_with(|| Value::Array(Vec::new()));
    let signatures = signatures
        .as_array_mut()
        .ok_or_else(|| SignerError::Message("partialSignatures must be an array".to_string()))?;
    signatures.push(serde_json::to_value(signature)?);
    let signature_count = signatures.len();
    Ok((
        STANDARD.encode(serde_json::to_vec(&psbt_value)?),
        signature_count,
    ))
}

fn payload_string(payload: &Value, key: &str) -> Result<String> {
    payload
        .get(key)
        .map(value_to_display)
        .ok_or_else(|| SignerError::Message(format!("payload missing {key}")))
}

fn value_to_display(value: &Value) -> String {
    value
        .as_str()
        .map(ToString::to_string)
        .unwrap_or_else(|| value.to_string())
}

fn signing_digest(payload_hash: &str, psbt_digest: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(payload_hash.as_bytes());
    hasher.update(b":");
    hasher.update(psbt_digest.as_bytes());
    hasher.finalize().into()
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::canonical::sha256_prefixed;
    use crate::key_store::KeyStore;
    use serde_json::json;
    use tempfile::TempDir;

    fn fixture_envelope() -> UnsignedEnvelope {
        let payload = json!({
            "version": "1.0",
            "txRequestId": "txreq_001",
            "tenantId": "tenant_001",
            "walletId": "wallet_btc_001",
            "asset": "BTC",
            "amount": "0.01000000",
            "destination": "tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9",
            "network": "bitcoin-testnet",
            "feePolicy": "MEDIUM",
            "networkFee": "1000",
            "utxoInputs": [
                {
                    "txid": "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234",
                    "vout": 0,
                    "satoshis": 100000,
                    "address": "tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9",
                    "derivationPath": "m/48'/1'/0'/2'/0/0"
                }
            ],
            "changeAddress": "tb1q9nzuyc2hsplr3ka0hygt3f0eksr22sv0ph9rp9",
            "createdAt": "2026-04-29T00:00:00.000Z"
        });
        let psbt = json!({
            "globalMap": {"xpubs": [], "unknown": {}},
            "inputs": [],
            "outputs": [],
            "network": "bitcoin-testnet"
        });
        UnsignedEnvelope {
            tx_request_id: "txreq_001".to_string(),
            payload_hash: sha256_prefixed(&payload),
            payload,
            btc_psbt_base64: Some(STANDARD.encode(serde_json::to_vec(&psbt).unwrap())),
            created_at: "2026-04-29T00:00:00.000Z".to_string(),
        }
    }

    #[test]
    fn verifies_payload_hash_and_detects_nested_tamper() {
        let mut envelope = fixture_envelope();
        verify_payload_hash(&envelope).unwrap();

        envelope.payload["utxoInputs"][0]["vout"] = json!(1);
        let error = verify_payload_hash(&envelope).unwrap_err();
        assert!(error.to_string().contains("payload hash mismatch"));
    }

    #[test]
    fn signs_btc_testnet_payload_export() {
        let temp = TempDir::new().unwrap();
        let store = KeyStore::new(temp.path().join("signer"));
        let key = store.create_btc_key("phase-five-passphrase").unwrap();
        let seed = store.decrypt_seed(&key, "phase-five-passphrase").unwrap();
        let envelope = fixture_envelope();

        let signed = sign_envelope(&envelope, &key, &seed).unwrap();

        assert_eq!(signed.tx_request_id, "txreq_001");
        assert_eq!(signed.asset, "BTC");
        assert_eq!(signed.network, "bitcoin-testnet");
        assert_eq!(signed.payload_hash, envelope.payload_hash);
        assert_eq!(signed.signature_count, 1);
        assert_eq!(signed.signatures.len(), 1);

        let decoded = STANDARD.decode(signed.signed_psbt_base64).unwrap();
        let signed_psbt: Value = serde_json::from_slice(&decoded).unwrap();
        assert_eq!(
            signed_psbt["partialSignatures"].as_array().unwrap().len(),
            1
        );
    }

    #[test]
    fn rejects_wrong_network() {
        let temp = TempDir::new().unwrap();
        let store = KeyStore::new(temp.path().join("signer"));
        let key = store.create_btc_key("phase-five-passphrase").unwrap();
        let seed = store.decrypt_seed(&key, "phase-five-passphrase").unwrap();
        let mut envelope = fixture_envelope();
        envelope.payload["network"] = json!("bitcoin-mainnet");
        envelope.payload_hash = sha256_prefixed(&envelope.payload);

        let error = sign_envelope(&envelope, &key, &seed).unwrap_err();
        assert!(error.to_string().contains("bitcoin-testnet"));
    }
}
