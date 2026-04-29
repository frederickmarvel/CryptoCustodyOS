use crate::{Result, SignerError};
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bitcoin::bip32::{DerivationPath, Xpriv, Xpub};
use bitcoin::secp256k1::{PublicKey, Secp256k1, SecretKey};
use bitcoin::Network;
use chrono::{SecondsFormat, Utc};
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::str::FromStr;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

pub const DEFAULT_DERIVATION_PATH: &str = "m/48'/1'/0'/2'";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyRecord {
    pub version: u8,
    pub key_id: String,
    pub asset: String,
    pub network: String,
    pub storage_class: String,
    pub derivation_path: String,
    pub xpub: String,
    pub fingerprint: String,
    pub public_key: String,
    pub created_at: String,
    pub encrypted_seed: EncryptedSeed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicKeyExport {
    pub key_id: String,
    pub asset: String,
    pub network: String,
    pub storage_class: String,
    pub derivation_path: String,
    pub xpub: String,
    pub fingerprint: String,
    pub public_key: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedSeed {
    pub algorithm: String,
    pub kdf: KdfParams,
    pub salt_b64: String,
    pub nonce_b64: String,
    pub ciphertext_b64: String,
    pub ciphertext_sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KdfParams {
    pub algorithm: String,
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

pub struct SigningMaterial {
    pub fingerprint: String,
    pub public_key: String,
    pub secret_key: SecretKey,
}

#[derive(Debug, Clone)]
pub struct KeyStore {
    root: PathBuf,
}

impl KeyRecord {
    pub fn public_export(&self) -> PublicKeyExport {
        PublicKeyExport {
            key_id: self.key_id.clone(),
            asset: self.asset.clone(),
            network: self.network.clone(),
            storage_class: self.storage_class.clone(),
            derivation_path: self.derivation_path.clone(),
            xpub: self.xpub.clone(),
            fingerprint: self.fingerprint.clone(),
            public_key: self.public_key.clone(),
            created_at: self.created_at.clone(),
        }
    }
}

impl KeyStore {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn init(&self) -> Result<()> {
        fs::create_dir_all(self.keys_dir())?;
        fs::create_dir_all(self.backups_dir())?;
        let config_path = self.root.join("config.json");
        if !config_path.exists() {
            let config = serde_json::json!({
                "version": 1,
                "initializedAt": now_rfc3339(),
                "network": "bitcoin-testnet",
                "storageClass": "OFFLINE_COLD"
            });
            write_private_file(&config_path, serde_json::to_vec_pretty(&config)?)?;
        }
        Ok(())
    }

    pub fn create_btc_key(&self, passphrase: &str) -> Result<KeyRecord> {
        self.init()?;

        let mut seed = [0u8; 64];
        OsRng.fill_bytes(&mut seed);
        let material = derive_signing_material(&seed)?;
        let xpub = derive_xpub(&seed)?;
        let key_id = key_id_from_xpub(&xpub);

        let record = KeyRecord {
            version: 1,
            key_id,
            asset: "BTC".to_string(),
            network: "bitcoin-testnet".to_string(),
            storage_class: "OFFLINE_COLD".to_string(),
            derivation_path: DEFAULT_DERIVATION_PATH.to_string(),
            xpub,
            fingerprint: material.fingerprint,
            public_key: material.public_key,
            created_at: now_rfc3339(),
            encrypted_seed: encrypt_seed(&seed, passphrase)?,
        };

        let key_path = self.key_path(&record.key_id);
        if key_path.exists() {
            return Err(SignerError::Message(format!(
                "key {} already exists",
                record.key_id
            )));
        }

        write_private_file(&key_path, serde_json::to_vec_pretty(&record)?)?;
        write_private_file(
            &self.backup_path(&record.key_id),
            serde_json::to_vec_pretty(&record)?,
        )?;
        Ok(record)
    }

    pub fn load_key(&self, key_id: Option<&str>) -> Result<KeyRecord> {
        let path = match key_id {
            Some(key_id) => self.key_path(key_id),
            None => self.first_key_path()?,
        };
        Ok(serde_json::from_slice(&fs::read(path)?)?)
    }

    pub fn decrypt_seed(&self, key: &KeyRecord, passphrase: &str) -> Result<Vec<u8>> {
        decrypt_seed(&key.encrypted_seed, passphrase)
    }

    pub fn verify_backup(&self, key_id: Option<&str>, passphrase: &str) -> Result<KeyRecord> {
        let key = self.load_key(key_id)?;
        let backup: KeyRecord = serde_json::from_slice(&fs::read(self.backup_path(&key.key_id))?)?;
        verify_backup_record(&backup, passphrase)?;
        if backup.key_id != key.key_id {
            return Err(SignerError::Message(
                "backup key_id does not match key file".to_string(),
            ));
        }
        Ok(backup)
    }

    pub fn restore_backup(&self, backup_file: &Path, passphrase: &str) -> Result<KeyRecord> {
        self.init()?;
        let backup: KeyRecord = serde_json::from_slice(&fs::read(backup_file)?)?;
        verify_backup_record(&backup, passphrase)?;

        let key_path = self.key_path(&backup.key_id);
        if key_path.exists() {
            return Err(SignerError::Message(format!(
                "key {} already exists in signer home",
                backup.key_id
            )));
        }

        write_private_file(&key_path, serde_json::to_vec_pretty(&backup)?)?;
        write_private_file(
            &self.backup_path(&backup.key_id),
            serde_json::to_vec_pretty(&backup)?,
        )?;
        Ok(backup)
    }

    fn keys_dir(&self) -> PathBuf {
        self.root.join("keys")
    }

    fn backups_dir(&self) -> PathBuf {
        self.root.join("backups")
    }

    fn key_path(&self, key_id: &str) -> PathBuf {
        self.keys_dir().join(format!("{key_id}.json"))
    }

    fn backup_path(&self, key_id: &str) -> PathBuf {
        self.backups_dir().join(format!("{key_id}.backup.json"))
    }

    fn first_key_path(&self) -> Result<PathBuf> {
        let mut entries = fs::read_dir(self.keys_dir())?
            .collect::<std::result::Result<Vec<_>, _>>()?
            .into_iter()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("json"))
            .collect::<Vec<_>>();
        entries.sort();
        entries
            .into_iter()
            .next()
            .ok_or_else(|| SignerError::Message("no signer keys found".to_string()))
    }
}

pub fn derive_signing_material(seed: &[u8]) -> Result<SigningMaterial> {
    let secp = Secp256k1::new();
    let xpriv = derive_account_xpriv(seed)?;
    let secret_key = xpriv.private_key;
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);
    Ok(SigningMaterial {
        fingerprint: xpriv.fingerprint(&secp).to_string(),
        public_key: public_key.to_string(),
        secret_key,
    })
}

fn derive_xpub(seed: &[u8]) -> Result<String> {
    let secp = Secp256k1::new();
    let xpriv = derive_account_xpriv(seed)?;
    let xpub = Xpub::from_priv(&secp, &xpriv);
    Ok(xpub.to_string())
}

fn derive_account_xpriv(seed: &[u8]) -> Result<Xpriv> {
    let secp = Secp256k1::new();
    let master = Xpriv::new_master(Network::Testnet, seed)?;
    let path = DerivationPath::from_str(DEFAULT_DERIVATION_PATH)?;
    Ok(master.derive_priv(&secp, &path)?)
}

fn key_id_from_xpub(xpub: &str) -> String {
    let digest = Sha256::digest(xpub.as_bytes());
    format!("key_{}", &hex::encode(digest)[..16])
}

fn encrypt_seed(seed: &[u8], passphrase: &str) -> Result<EncryptedSeed> {
    let kdf = KdfParams {
        algorithm: "argon2id".to_string(),
        memory_kib: 19_456,
        iterations: 2,
        parallelism: 1,
    };

    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);

    let key = derive_key(passphrase, &salt, &kdf)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| SignerError::Message("failed to initialize AES-256-GCM".to_string()))?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), seed)
        .map_err(|_| SignerError::Message("failed to encrypt signer seed".to_string()))?;

    Ok(EncryptedSeed {
        algorithm: "AES-256-GCM".to_string(),
        kdf,
        salt_b64: STANDARD.encode(salt),
        nonce_b64: STANDARD.encode(nonce),
        ciphertext_sha256: hex::encode(Sha256::digest(&ciphertext)),
        ciphertext_b64: STANDARD.encode(ciphertext),
    })
}

fn decrypt_seed(encrypted: &EncryptedSeed, passphrase: &str) -> Result<Vec<u8>> {
    let salt = STANDARD.decode(&encrypted.salt_b64)?;
    let nonce = STANDARD.decode(&encrypted.nonce_b64)?;
    let ciphertext = STANDARD.decode(&encrypted.ciphertext_b64)?;
    let checksum = hex::encode(Sha256::digest(&ciphertext));
    if checksum != encrypted.ciphertext_sha256 {
        return Err(SignerError::Message(
            "encrypted seed checksum mismatch".to_string(),
        ));
    }

    let key = derive_key(passphrase, &salt, &encrypted.kdf)?;
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| SignerError::Message("failed to initialize AES-256-GCM".to_string()))?;
    cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|_| SignerError::Message("failed to decrypt signer seed".to_string()))
}

fn verify_backup_record(backup: &KeyRecord, passphrase: &str) -> Result<()> {
    let seed = decrypt_seed(&backup.encrypted_seed, passphrase)?;
    let material = derive_signing_material(&seed)?;
    if material.fingerprint != backup.fingerprint {
        return Err(SignerError::Message(
            "backup decrypted, but fingerprint did not match".to_string(),
        ));
    }
    Ok(())
}

fn derive_key(passphrase: &str, salt: &[u8], kdf: &KdfParams) -> Result<[u8; 32]> {
    let params = Params::new(kdf.memory_kib, kdf.iterations, kdf.parallelism, Some(32))
        .map_err(|error| SignerError::Message(format!("invalid argon2 params: {error}")))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; 32];
    argon2
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|error| SignerError::Message(format!("argon2 failed: {error}")))?;
    Ok(key)
}

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
}

fn write_private_file(path: &Path, data: Vec<u8>) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let mut options = OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    options.mode(0o600);
    let mut file = options.open(path)?;
    file.write_all(&data)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn creates_encrypted_key_and_exports_public_metadata() {
        let temp = TempDir::new().unwrap();
        let store = KeyStore::new(temp.path().join("signer"));

        let key = store
            .create_btc_key("correct horse battery staple")
            .unwrap();
        let export = key.public_export();

        assert_eq!(export.asset, "BTC");
        assert_eq!(export.network, "bitcoin-testnet");
        assert_eq!(export.storage_class, "OFFLINE_COLD");
        assert!(export.xpub.starts_with("tpub"));
        assert!(!serde_json::to_string(&export)
            .unwrap()
            .contains("ciphertext"));
        assert!(store.backup_path(&key.key_id).exists());
    }

    #[test]
    fn rejects_wrong_passphrase() {
        let temp = TempDir::new().unwrap();
        let store = KeyStore::new(temp.path().join("signer"));
        let key = store.create_btc_key("right-passphrase").unwrap();

        let error = store.decrypt_seed(&key, "wrong-passphrase").unwrap_err();
        assert!(error.to_string().contains("failed to decrypt"));
    }

    #[test]
    fn verifies_encrypted_backup() {
        let temp = TempDir::new().unwrap();
        let store = KeyStore::new(temp.path().join("signer"));
        let key = store.create_btc_key("backup-passphrase").unwrap();

        let backup = store
            .verify_backup(Some(&key.key_id), "backup-passphrase")
            .unwrap();

        assert_eq!(backup.key_id, key.key_id);
    }

    #[test]
    fn restores_backup_into_fresh_signer_home() {
        let temp = TempDir::new().unwrap();
        let source = KeyStore::new(temp.path().join("source"));
        let restored = KeyStore::new(temp.path().join("restored"));
        let key = source.create_btc_key("restore-passphrase").unwrap();
        let backup_path = source.backup_path(&key.key_id);

        let restored_key = restored
            .restore_backup(&backup_path, "restore-passphrase")
            .unwrap();

        assert_eq!(restored_key.key_id, key.key_id);
        assert!(restored.key_path(&key.key_id).exists());
    }
}
