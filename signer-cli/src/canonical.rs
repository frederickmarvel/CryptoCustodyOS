use serde_json::Value;
use sha2::{Digest, Sha256};

pub fn canonical_json(value: &Value) -> String {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            serde_json::to_string(value).expect("primitive JSON serialization cannot fail")
        }
        Value::Array(items) => {
            let values = items
                .iter()
                .map(canonical_json)
                .collect::<Vec<_>>()
                .join(",");
            format!("[{values}]")
        }
        Value::Object(map) => {
            let mut keys = map.keys().collect::<Vec<_>>();
            keys.sort();
            let values = keys
                .into_iter()
                .map(|key| {
                    let key_json =
                        serde_json::to_string(key).expect("JSON key serialization cannot fail");
                    format!("{key_json}:{}", canonical_json(&map[key]))
                })
                .collect::<Vec<_>>()
                .join(",");
            format!("{{{values}}}")
        }
    }
}

pub fn sha256_prefixed(value: &Value) -> String {
    let canonical = canonical_json(value);
    let digest = Sha256::digest(canonical.as_bytes());
    format!("sha256:{}", hex::encode(digest))
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn canonicalizes_nested_objects_by_key() {
        let a = json!({"b": 2, "a": [{"d": 4, "c": 3}]});
        let b = json!({"a": [{"c": 3, "d": 4}], "b": 2});

        assert_eq!(canonical_json(&a), canonical_json(&b));
        assert_eq!(sha256_prefixed(&a), sha256_prefixed(&b));
    }

    #[test]
    fn nested_tampering_changes_hash() {
        let a = json!({"utxoInputs": [{"txid": "abc", "vout": 0}]});
        let b = json!({"utxoInputs": [{"txid": "abc", "vout": 1}]});

        assert_ne!(sha256_prefixed(&a), sha256_prefixed(&b));
    }
}
