use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,
    pub timestamp_ms: u64,
    pub action_type: String,
    pub summary: String,
    pub payload_hash: String,
    pub success: bool,
    pub undoable: bool,
}

pub struct ActionLedger {
    entries: Mutex<Vec<LedgerEntry>>,
    max_history: usize,
}

impl Default for ActionLedger {
    fn default() -> Self {
        Self::new(100)
    }
}

impl ActionLedger {
    pub fn new(max_history: usize) -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            max_history,
        }
    }

    pub fn record(&self, entry: LedgerEntry) {
        let mut lock = self.entries.lock().unwrap();
        lock.push(entry);
        if lock.len() > self.max_history {
            lock.remove(0);
        }
    }

    pub fn get_recent(&self, limit: usize) -> Vec<LedgerEntry> {
        let lock = self.entries.lock().unwrap();
        lock.iter().rev().take(limit).cloned().collect()
    }

    pub fn current_timestamp_ms() -> u64 {
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }
}
