use windows::core::PCWSTR;
use windows::Win32::Foundation::LocalFree;
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};
use windows::Win32::System::Memory::{VirtualLock, VirtualUnlock};

/// RAII container for sensitive memory that locks pages in physical RAM
/// via Win32 `VirtualLock` (preventing paging out to `pagefile.sys`) and
/// securely wipes all bytes with volatile zeroing on drop.
pub struct ProtectedBuffer {
    data: Vec<u8>,
    locked: bool,
}

impl ProtectedBuffer {
    pub fn new(data: Vec<u8>) -> Self {
        let mut locked = false;
        if !data.is_empty() {
            unsafe {
                // Attempt to lock page into RAM. If privileges restrict, proceed safely without failing
                if VirtualLock(data.as_ptr() as *const _, data.len()).is_ok() {
                    locked = true;
                }
            }
        }
        Self { data, locked }
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }

    pub fn into_vec(mut self) -> Vec<u8> {
        self.locked = false; // Transfer ownership
        std::mem::take(&mut self.data)
    }
}

impl Drop for ProtectedBuffer {
    fn drop(&mut self) {
        if self.locked && !self.data.is_empty() {
            unsafe {
                let _ = VirtualUnlock(self.data.as_ptr() as *const _, self.data.len());
            }
        }
        // Deterministic volatile zeroing of sensitive memory
        for byte in self.data.iter_mut() {
            unsafe {
                std::ptr::write_volatile(byte, 0);
            }
        }
    }
}

/// Protects plaintext bytes using Windows Data Protection API (DPAPI).
/// Cryptographically bound to the current Windows user and machine credentials.
pub fn protect_bytes(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    if plaintext.is_empty() {
        return Ok(Vec::new());
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: plaintext.len() as u32,
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    unsafe {
        let success = CryptProtectData(
            &data_in,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        );

        if success.is_err() || data_out.pbData.is_null() {
            return Err("DPAPI encryption failed via CryptProtectData".into());
        }

        let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
        let ciphertext = slice.to_vec();

        let _ = LocalFree(windows::Win32::Foundation::HLOCAL(data_out.pbData as *mut _));
        Ok(ciphertext)
    }
}

/// Decrypts DPAPI ciphertext bytes back into a `ProtectedBuffer`.
pub fn unprotect_bytes(ciphertext: &[u8]) -> Result<ProtectedBuffer, String> {
    if ciphertext.is_empty() {
        return Ok(ProtectedBuffer::new(Vec::new()));
    }

    let data_in = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut data_out = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    unsafe {
        let success = CryptUnprotectData(
            &data_in,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut data_out,
        );

        if success.is_err() || data_out.pbData.is_null() {
            return Err("DPAPI decryption failed: payload cannot be decrypted on this user profile".into());
        }

        let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
        let plaintext = slice.to_vec();

        let _ = LocalFree(windows::Win32::Foundation::HLOCAL(data_out.pbData as *mut _));
        Ok(ProtectedBuffer::new(plaintext))
    }
}
