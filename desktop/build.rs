fn main() {
    // App commands the web app may call; each gets an allow-<name> permission for the capability.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&["engine_status", "app_url"])),
    )
    .expect("failed to run tauri build script");
}
