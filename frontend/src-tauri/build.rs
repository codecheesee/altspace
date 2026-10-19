use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    tauri_build::build();

    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let sdk_lib_dir = manifest_dir.join("sdk").join("lib");
    let sdk_dll = manifest_dir.join("sdk").join("dll").join("Everything64.dll");

    println!("cargo:rustc-link-search=native={}", sdk_lib_dir.display());
    println!("cargo:rustc-link-lib=Everything64");

    if let Ok(out_dir) = env::var("OUT_DIR") {
        let out_path = PathBuf::from(out_dir);
        if let Some(target_dir) = out_path.ancestors().nth(3) {
            let dest_dll = target_dir.join("Everything64.dll");
            let _ = fs::copy(&sdk_dll, &dest_dll);
        }
    }
}
