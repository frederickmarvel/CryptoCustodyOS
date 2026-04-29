pub mod canonical;
pub mod key_store;
pub mod payload;

use clap::{Parser, Subcommand};
use key_store::KeyStore;
use payload::{inspect_unsigned_file, sign_unsigned_file};
use std::env;
use std::io::{self, Write};
use std::path::PathBuf;

pub type Result<T> = std::result::Result<T, SignerError>;

#[derive(thiserror::Error, Debug)]
pub enum SignerError {
    #[error("{0}")]
    Message(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("base64 error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("bip32 error: {0}")]
    Bip32(#[from] bitcoin::bip32::Error),
    #[error("secp256k1 error: {0}")]
    Secp256k1(#[from] bitcoin::secp256k1::Error),
}

#[derive(Parser)]
#[command(name = "custody-signer")]
#[command(about = "Offline signer MVP for the Custodian BTC testnet flow")]
pub struct Cli {
    #[arg(long, global = true, env = "CUSTODY_SIGNER_HOME")]
    pub data_dir: Option<PathBuf>,

    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    Init,
    CreateKey {
        #[arg(long, default_value = "BTC")]
        asset: String,
    },
    ExportXpub {
        #[arg(long)]
        key_id: Option<String>,
    },
    Inspect {
        unsigned_tx: PathBuf,
    },
    Sign {
        unsigned_tx: PathBuf,
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        key_id: Option<String>,
    },
    VerifyBackup {
        #[arg(long)]
        key_id: Option<String>,
    },
    RestoreBackup {
        backup_file: PathBuf,
    },
}

pub fn run_cli() -> Result<()> {
    let cli = Cli::parse();
    run(cli)
}

pub fn run(cli: Cli) -> Result<()> {
    let store = KeyStore::new(resolve_data_dir(cli.data_dir)?);

    match cli.command {
        Commands::Init => {
            store.init()?;
            println!("initialized signer home: {}", store.root().display());
        }
        Commands::CreateKey { asset } => {
            if asset != "BTC" {
                return Err(SignerError::Message(
                    "Phase 5 signer supports BTC only".to_string(),
                ));
            }
            let passphrase = read_passphrase()?;
            let key = store.create_btc_key(&passphrase)?;
            println!("{}", serde_json::to_string_pretty(&key.public_export())?);
        }
        Commands::ExportXpub { key_id } => {
            let key = store.load_key(key_id.as_deref())?;
            println!("{}", serde_json::to_string_pretty(&key.public_export())?);
        }
        Commands::Inspect { unsigned_tx } => {
            let summary = inspect_unsigned_file(&unsigned_tx)?;
            println!("{summary}");
        }
        Commands::Sign {
            unsigned_tx,
            output,
            key_id,
        } => {
            let summary = inspect_unsigned_file(&unsigned_tx)?;
            println!("{summary}");
            require_manual_confirmation(&summary)?;
            let passphrase = read_passphrase()?;
            let key = store.load_key(key_id.as_deref())?;
            let seed = store.decrypt_seed(&key, &passphrase)?;
            let signed = sign_unsigned_file(&unsigned_tx, &key, &seed)?;
            std::fs::write(&output, serde_json::to_vec_pretty(&signed)?)?;
            println!("signed payload written: {}", output.display());
        }
        Commands::VerifyBackup { key_id } => {
            let passphrase = read_passphrase()?;
            let key = store.verify_backup(key_id.as_deref(), &passphrase)?;
            println!("backup verified for key_id: {}", key.key_id);
        }
        Commands::RestoreBackup { backup_file } => {
            let passphrase = read_passphrase()?;
            let key = store.restore_backup(&backup_file, &passphrase)?;
            println!("backup restored for key_id: {}", key.key_id);
        }
    }

    Ok(())
}

fn resolve_data_dir(explicit: Option<PathBuf>) -> Result<PathBuf> {
    if let Some(path) = explicit {
        return Ok(path);
    }
    if let Ok(path) = env::var("CUSTODY_SIGNER_HOME") {
        return Ok(PathBuf::from(path));
    }
    let home = env::var("HOME")
        .map(PathBuf::from)
        .map_err(|_| SignerError::Message("HOME is not set; pass --data-dir".to_string()))?;
    Ok(home.join(".custody-signer"))
}

fn read_passphrase() -> Result<String> {
    if let Ok(passphrase) = env::var("CUSTODY_SIGNER_PASSPHRASE") {
        if passphrase.is_empty() {
            return Err(SignerError::Message(
                "CUSTODY_SIGNER_PASSPHRASE cannot be empty".to_string(),
            ));
        }
        return Ok(passphrase);
    }

    let passphrase = rpassword::prompt_password("Signer passphrase: ")?;
    if passphrase.is_empty() {
        return Err(SignerError::Message(
            "passphrase cannot be empty".to_string(),
        ));
    }
    Ok(passphrase)
}

fn require_manual_confirmation(summary: &str) -> Result<()> {
    let tx_id = summary
        .lines()
        .find_map(|line| line.strip_prefix("tx_request_id: "))
        .ok_or_else(|| SignerError::Message("summary did not include tx_request_id".to_string()))?;
    let expected = format!("SIGN {tx_id}");

    print!("Type '{expected}' to sign: ");
    io::stdout().flush()?;

    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    if input.trim() != expected {
        return Err(SignerError::Message(
            "manual signing confirmation failed".to_string(),
        ));
    }
    Ok(())
}
