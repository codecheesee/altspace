use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Circuit Breaker loop limiter.
/// Prevents runaway automated loops by capping executions (max 3 actions per 30 seconds).
pub struct CircuitBreaker {
    max_actions: usize,
    window: Duration,
    timestamps: Mutex<VecDeque<Instant>>,
}

impl CircuitBreaker {
    pub fn new(max_actions: usize, window_secs: u64) -> Self {
        Self {
            max_actions,
            window: Duration::from_secs(window_secs),
            timestamps: Mutex::new(VecDeque::new()),
        }
    }

    /// Default production settings: max 3 actions in 30 seconds
    pub fn default_production() -> Self {
        Self::new(3, 30)
    }

    /// Checks if a new action is permitted. If yes, records timestamp.
    /// If limit exceeded, returns Err with remaining cooldown seconds.
    pub fn check_and_record(&self) -> Result<(), u64> {
        let now = Instant::now();
        let mut lock = self.timestamps.lock().unwrap();

        // Evict timestamps outside the window
        while let Some(&front) = lock.front() {
            if now.duration_since(front) > self.window {
                lock.pop_front();
            } else {
                break;
            }
        }

        if lock.len() >= self.max_actions {
            let oldest = *lock.front().unwrap();
            let elapsed = now.duration_since(oldest);
            let cooldown = self.window.saturating_sub(elapsed).as_secs().max(1);
            Err(cooldown)
        } else {
            lock.push_back(now);
            Ok(())
        }
    }

    /// Resets the circuit breaker state
    pub fn reset(&self) {
        let mut lock = self.timestamps.lock().unwrap();
        lock.clear();
    }
}
