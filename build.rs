use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    // Compile Slint UI
    slint_build::compile("ui/appwindow.slint").unwrap();

    // Link Everything64 SDK
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let sdk_lib_dir = manifest_dir.join("sdk").join("lib");
    let sdk_dll = manifest_dir.join("sdk").join("dll").join("Everything64.dll");

    println!("cargo:rustc-link-search=native={}", sdk_lib_dir.display());
    println!("cargo:rustc-link-lib=Everything64");

    // Copy DLL to out dir
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_dir = out_dir.ancestors().nth(3).unwrap();
    let dest_dll = target_dir.join("Everything64.dll");
    let _ = fs::copy(&sdk_dll, &dest_dll);
}
