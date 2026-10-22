use crate::crypto_vault;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};

const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByokChatRequest {
    pub provider: String,
    pub model: Option<String>,
    pub prompt: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByokChatResponse {
    pub provider: String,
    pub model: String,
    pub content: String,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ByokProviderStatus {
    pub provider: String,
    pub is_configured: bool,
    pub fingerprint: String,
}

pub fn sanitize_byok_provider(provider: &str) -> Result<String, String> {
    let clean = provider.trim().to_lowercase();
    match clean.as_str() {
        "anthropic" | "openai" | "deepseek" | "groq" | "openrouter" => Ok(clean),
        _ => Err(format!(
            "Unsupported AI provider '{}'. Supported providers: anthropic, openai, deepseek, groq, openrouter",
            provider
        )),
    }
}

pub fn get_byok_status(provider: &str) -> Result<Option<ByokProviderStatus>, String> {
    let clean = sanitize_byok_provider(provider)?;
    if let Ok(Some(key)) = crypto_vault::retrieve_byok_key(&clean) {
        if !key.trim().is_empty() {
            let fp = crypto_vault::redact_secret_value(&key);
            return Ok(Some(ByokProviderStatus {
                provider: clean,
                is_configured: true,
                fingerprint: fp,
            }));
        }
    }
    Ok(None)
}

pub fn chat_completion(request: ByokChatRequest) -> Result<ByokChatResponse, String> {
    let provider = sanitize_byok_provider(&request.provider)?;

    // 1. Retrieve the plaintext API key from DPAPI directly in Rust memory
    // The key NEVER crosses the IPC boundary or enters JavaScript context
    let api_key = match crypto_vault::retrieve_byok_key(&provider)? {
        Some(k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => {
            return Err(format!(
                "No API key configured for provider '{}'. Please configure your BYOK key in Settings.",
                provider
            ));
        }
    };

    if request.prompt.trim().is_empty() {
        return Err("Prompt cannot be empty.".into());
    }

    match provider.as_str() {
        "anthropic" => execute_anthropic_request(&api_key, &request),
        "openai" | "deepseek" | "groq" | "openrouter" => {
            execute_openai_compatible_request(&provider, &api_key, &request)
        }
        _ => unreachable!(),
    }
}

fn execute_anthropic_request(
    api_key: &str,
    req: &ByokChatRequest,
) -> Result<ByokChatResponse, String> {
    let model = req.model.as_deref().unwrap_or("claude-3-7-sonnet-20250219");
    let max_tokens = req.max_tokens.unwrap_or(1024);

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".into(), serde_json::Value::String(model.into()));
    body_map.insert(
        "max_tokens".into(),
        serde_json::Value::Number(max_tokens.into()),
    );
    if let Some(ref sys) = req.system_prompt {
        body_map.insert("system".into(), serde_json::Value::String(sys.clone()));
    }
    body_map.insert(
        "messages".into(),
        serde_json::json!([
            { "role": "user", "content": &req.prompt }
        ]),
    );

    let body_json = serde_json::to_string(&body_map)
        .map_err(|e| format!("Failed to serialize Anthropic payload: {}", e))?;

    let curl_config = format!(
        "silent\nurl = \"https://api.anthropic.com/v1/messages\"\nheader = \"x-api-key: {}\"\nheader = \"anthropic-version: 2023-06-01\"\nheader = \"content-type: application/json\"\ndata = \"{}\"\n",
        api_key,
        escape_curl_config_data(&body_json)
    );

    let stdout = run_curl_with_config(&curl_config)?;
    let val: serde_json::Value = serde_json::from_str(&stdout).map_err(|e| {
        format!(
            "Failed to parse Anthropic response: {} (raw: {})",
            e, stdout
        )
    })?;

    if let Some(err_obj) = val.get("error") {
        let msg = err_obj
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown Anthropic API error");
        return Err(format!("Anthropic API error: {}", msg));
    }

    let content_text = val
        .get("content")
        .and_then(|c| c.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|item| item.get("type").and_then(|t| t.as_str()) == Some("text"))
        })
        .and_then(|item| item.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("");

    let stop_reason = val
        .get("stop_reason")
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());

    Ok(ByokChatResponse {
        provider: "anthropic".into(),
        model: model.into(),
        content: content_text.to_string(),
        finish_reason: stop_reason,
    })
}

fn execute_openai_compatible_request(
    provider: &str,
    api_key: &str,
    req: &ByokChatRequest,
) -> Result<ByokChatResponse, String> {
    let (url, default_model) = match provider {
        "openai" => ("https://api.openai.com/v1/chat/completions", "gpt-4o"),
        "deepseek" => ("https://api.deepseek.com/chat/completions", "deepseek-chat"),
        "groq" => (
            "https://api.groq.com/openai/v1/chat/completions",
            "llama-3.3-70b-versatile",
        ),
        "openrouter" => (
            "https://openrouter.ai/api/v1/chat/completions",
            "openai/gpt-4o",
        ),
        _ => unreachable!(),
    };

    let model = req.model.as_deref().unwrap_or(default_model);

    let mut messages = Vec::new();
    if let Some(ref sys) = req.system_prompt {
        messages.push(serde_json::json!({ "role": "system", "content": sys }));
    }
    messages.push(serde_json::json!({ "role": "user", "content": &req.prompt }));

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".into(), serde_json::Value::String(model.into()));
    body_map.insert("messages".into(), serde_json::Value::Array(messages));
    if let Some(t) = req.temperature {
        if let Some(num) = serde_json::Number::from_f64(t as f64) {
            body_map.insert("temperature".into(), serde_json::Value::Number(num));
        }
    }
    if let Some(max_tok) = req.max_tokens {
        body_map.insert(
            "max_tokens".into(),
            serde_json::Value::Number(max_tok.into()),
        );
    }

    let body_json = serde_json::to_string(&body_map)
        .map_err(|e| format!("Failed to serialize provider payload: {}", e))?;

    let curl_config = format!(
        "silent\nurl = \"{}\"\nheader = \"Authorization: Bearer {}\"\nheader = \"Content-Type: application/json\"\ndata = \"{}\"\n",
        url,
        api_key,
        escape_curl_config_data(&body_json)
    );

    let stdout = run_curl_with_config(&curl_config)?;
    let val: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse provider response: {} (raw: {})", e, stdout))?;

    if let Some(err_obj) = val.get("error") {
        let msg = err_obj
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown provider API error");
        return Err(format!("{} API error: {}", provider, msg));
    }

    let content_text = val
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|msg| msg.get("content"))
        .and_then(|cnt| cnt.as_str())
        .unwrap_or("");

    let finish_reason = val
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|choice| choice.get("finish_reason"))
        .and_then(|fr| fr.as_str())
        .map(|s| s.to_string());

    Ok(ByokChatResponse {
        provider: provider.into(),
        model: model.into(),
        content: content_text.to_string(),
        finish_reason,
    })
}

fn escape_curl_config_data(data: &str) -> String {
    data.replace('\\', "\\\\").replace('"', "\\\"")
}

fn run_curl_with_config(config: &str) -> Result<String, String> {
    let mut child = Command::new("curl.exe")
        .args(["--config", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to spawn native curl process: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(config.as_bytes())
            .map_err(|e| format!("Failed to write configuration to curl stdin: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Curl execution failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Curl process failed (exit code {:?}): {}",
            output.status.code(),
            stderr
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_byok_provider() {
        assert_eq!(sanitize_byok_provider("anthropic").unwrap(), "anthropic");
        assert_eq!(sanitize_byok_provider("OpenAI").unwrap(), "openai");
        assert_eq!(sanitize_byok_provider(" deepseek ").unwrap(), "deepseek");
        assert_eq!(sanitize_byok_provider("groq").unwrap(), "groq");
        assert_eq!(sanitize_byok_provider("openrouter").unwrap(), "openrouter");
        assert!(sanitize_byok_provider("malicious_untrusted").is_err());
        assert!(sanitize_byok_provider("").is_err());
    }

    #[test]
    fn test_byok_chat_fails_closed_when_key_missing() {
        let req = ByokChatRequest {
            provider: "groq".into(),
            model: None,
            prompt: "Hello AI".into(),
            system_prompt: None,
            max_tokens: None,
            temperature: None,
        };
        // groq key is not configured in clean vault
        let _ = crypto_vault::delete_byok_key("groq");
        let res = chat_completion(req);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("No API key configured"));
    }

    #[test]
    fn test_byok_status_returns_only_masked_fingerprint() {
        let provider = "openai";
        crypto_vault::store_byok_key(provider, "sk-proj-test1234567890abcdef1234567890").unwrap();

        let status = get_byok_status(provider)
            .unwrap()
            .expect("Status should be Some");
        assert_eq!(status.provider, "openai");
        assert!(status.is_configured);
        assert!(
            !status.fingerprint.contains("test1234567890abcdef"),
            "Fingerprint must not leak full key"
        );
        assert!(
            status.fingerprint.contains("***"),
            "Fingerprint must be masked"
        );

        crypto_vault::delete_byok_key(provider).unwrap();
        assert!(get_byok_status(provider).unwrap().is_none());
    }
}
