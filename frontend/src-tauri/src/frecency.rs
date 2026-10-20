use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Lightweight SQLite-backed frecency (frequency × recency) ranking engine.
/// Replaces the previous localStorage-based counter with persistent,
/// time-decay-weighted scoring that survives cache clears.

const SEVEN_DAYS_SECS: f64 = 7.0 * 24.0 * 3600.0;
const RECENCY_BONUS_WINDOW_SECS: f64 = 4.0 * 3600.0; // 4 hours
const RECENCY_BONUS: f64 = 2.5;

pub struct FrecencyDb {
    conn: Mutex<rusqlite::Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrecencyEntry {
    pub item_id: String,
    pub score: f64,
}

impl FrecencyDb {
    /// Open (or create) the frecency database in the app data directory.
    pub fn open(app_data_dir: &PathBuf) -> Result<Self, String> {
        let db_path = app_data_dir.join("frecency.db");

        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("Failed to open frecency DB: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS usage_events (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id   TEXT NOT NULL,
                timestamp REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_usage_item ON usage_events(item_id);
            CREATE INDEX IF NOT EXISTS idx_usage_ts   ON usage_events(timestamp);",
        )
        .map_err(|e| format!("Failed to initialize frecency schema: {}", e))?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// Record a single usage event for an item.
    pub fn record(&self, item_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs();
        conn.execute(
            "INSERT INTO usage_events (item_id, timestamp) VALUES (?1, ?2)",
            rusqlite::params![item_id, now],
        )
        .map_err(|e| format!("Failed to record usage: {}", e))?;

        // Prune events older than 90 days to keep the DB small
        let cutoff = now - 90.0 * 24.0 * 3600.0;
        let _ = conn.execute(
            "DELETE FROM usage_events WHERE timestamp < ?1",
            rusqlite::params![cutoff],
        );

        Ok(())
    }

    /// Compute frecency scores for all known items.
    /// Returns a sorted list (highest score first).
    pub fn get_scores(&self) -> Result<Vec<FrecencyEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs();

        let mut stmt = conn
            .prepare(
                "SELECT item_id, COUNT(*) as cnt, MAX(timestamp) as last_ts
                 FROM usage_events
                 GROUP BY item_id",
            )
            .map_err(|e| format!("Failed to query frecency: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                let item_id: String = row.get(0)?;
                let count: f64 = row.get(1)?;
                let last_ts: f64 = row.get(2)?;
                Ok((item_id, count, last_ts))
            })
            .map_err(|e| format!("Failed to read frecency rows: {}", e))?;

        let mut entries: Vec<FrecencyEntry> = Vec::new();
        for row in rows {
            let (item_id, count, last_ts) = row.map_err(|e| e.to_string())?;
            let age_secs = (now - last_ts).max(0.0);

            // Exponential half-life decay over 7 days
            let decay = (0.5_f64).powf(age_secs / SEVEN_DAYS_SECS);

            // Recency bonus for items used within the last 4 hours
            let bonus = if age_secs < RECENCY_BONUS_WINDOW_SECS {
                RECENCY_BONUS
            } else {
                0.0
            };

            let score = count * decay + bonus;
            entries.push(FrecencyEntry { item_id, score });
        }

        entries.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        Ok(entries)
    }

    /// Import legacy localStorage frequency data (one-time migration).
    pub fn import_legacy(&self, data: &[(String, f64)]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = now_epoch_secs();

        // Only import if the DB is empty (first run after migration)
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM usage_events", [], |r| r.get(0))
            .unwrap_or(0);
        if count > 0 {
            return Ok(());
        }

        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
        for (item_id, legacy_count) in data {
            // Spread synthetic events over the past week proportional to count
            let synthetic_count = (*legacy_count as i64).min(50);
            for i in 0..synthetic_count {
                let offset = (i as f64 / synthetic_count as f64) * SEVEN_DAYS_SECS;
                let ts = now - offset;
                tx.execute(
                    "INSERT INTO usage_events (item_id, timestamp) VALUES (?1, ?2)",
                    rusqlite::params![item_id, ts],
                )
                .map_err(|e| e.to_string())?;
            }
        }
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn now_epoch_secs() -> f64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64()
}


#[cfg(test)]
pub mod tests {
    use super::*;

    fn create_test_db() -> FrecencyDb {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS usage_events (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id   TEXT NOT NULL,
                timestamp REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_usage_item ON usage_events(item_id);
            CREATE INDEX IF NOT EXISTS idx_usage_ts   ON usage_events(timestamp);",
        )
        .unwrap();

        FrecencyDb {
            conn: Mutex::new(conn),
        }
    }

    #[test]
    fn test_record_and_get_scores() {
        let db = create_test_db();
        db.record("vscode.exe").unwrap();
        db.record("vscode.exe").unwrap();
        db.record("spotify.exe").unwrap();

        let scores = db.get_scores().unwrap();
        assert_eq!(scores.len(), 2);
        assert_eq!(scores[0].item_id, "vscode.exe");
        assert_eq!(scores[1].item_id, "spotify.exe");
        assert!(scores[0].score > scores[1].score);
    }

    #[test]
    fn test_recency_bonus() {
        let db = create_test_db();
        let now = now_epoch_secs();
        let old_ts = now - (30.0 * 24.0 * 3600.0); // 30 days ago

        {
            let conn = db.conn.lock().unwrap();
            // old_app was used 10 times 30 days ago
            for _ in 0..10 {
                conn.execute(
                    "INSERT INTO usage_events (item_id, timestamp) VALUES (?1, ?2)",
                    rusqlite::params!["old_app.exe", old_ts],
                )
                .unwrap();
            }
        }

        // new_app was used once just now
        db.record("new_app.exe").unwrap();

        let scores = db.get_scores().unwrap();
        assert_eq!(scores[0].item_id, "new_app.exe");
        assert!(scores[0].score > scores[1].score);
    }

    #[test]
    fn test_import_legacy() {
        let db = create_test_db();
        let legacy = vec![
            ("chrome.exe".to_string(), 15.0),
            ("slack.exe".to_string(), 5.0),
        ];
        db.import_legacy(&legacy).unwrap();

        let scores = db.get_scores().unwrap();
        assert_eq!(scores.len(), 2);
        assert_eq!(scores[0].item_id, "chrome.exe");
        assert_eq!(scores[1].item_id, "slack.exe");
        assert!(scores[0].score > scores[1].score);
    }
}
