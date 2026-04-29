fn main() {
    if let Err(error) = custody_signer::run_cli() {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}
