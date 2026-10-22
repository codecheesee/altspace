use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SecretType {
    GitHubToken,
    OpenAiApiKey,
    AnthropicApiKey,
    AwsAccessKey,
    SlackToken,
    GitLabToken,
    GenericHighEntropyToken,
    PrivateKeyHeader,
}

pub struct SecretPattern {
    pub secret_type: SecretType,
    pub prefix: &'static str,
    pub min_len: usize,
    pub max_len: usize,
}

pub const KNOWN_PATTERNS: &[SecretPattern] = &[
    SecretPattern {
        secret_type: SecretType::GitHubToken,
        prefix: "ghp_",
        min_len: 36,
        max_len: 44,
    },
    SecretPattern {
        secret_type: SecretType::GitHubToken,
        prefix: "github_pat_",
        min_len: 80,
        max_len: 100,
    },
    SecretPattern {
        secret_type: SecretType::OpenAiApiKey,
        prefix: "sk-proj-",
        min_len: 40,
        max_len: 200,
    },
    SecretPattern {
        secret_type: SecretType::OpenAiApiKey,
        prefix: "sk-",
        min_len: 40,
        max_len: 60,
    },
    SecretPattern {
        secret_type: SecretType::AnthropicApiKey,
        prefix: "sk-ant-",
        min_len: 40,
        max_len: 120,
    },
    SecretPattern {
        secret_type: SecretType::AwsAccessKey,
        prefix: "AKIA",
        min_len: 20,
        max_len: 20,
    },
    SecretPattern {
        secret_type: SecretType::SlackToken,
        prefix: "xoxb-",
        min_len: 40,
        max_len: 80,
    },
    SecretPattern {
        secret_type: SecretType::GitLabToken,
        prefix: "glpat-",
        min_len: 20,
        max_len: 30,
    },
    SecretPattern {
        secret_type: SecretType::PrivateKeyHeader,
        prefix: "-----BEGIN",
        min_len: 64,
        max_len: 8192,
    },
];
