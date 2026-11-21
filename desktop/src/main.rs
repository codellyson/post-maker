// Post maker desktop app: a native window over the Post maker web app, plus the local engine
// that reads a product's repo on this Mac (runs the app, takes screens, records flows).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_updater::UpdaterExt;

const ENGINE: &str = "127.0.0.1:4710";

struct Engine(Arc<Mutex<Option<Child>>>);
// Why the engine can't run, when it can't (no Node, Node too old); shown on the product page.
struct Problem(Arc<Mutex<Option<String>>>);

// The web app this window opens. Set at build time with PM_APP_URL; local until Post maker is deployed.
fn app_url_value() -> &'static str {
    option_env!("PM_APP_URL").unwrap_or("http://localhost:3417")
}

#[tauri::command]
fn app_url() -> &'static str {
    app_url_value()
}

// Who is on the engine port: our engine (its /health names it), something else, or nothing.
#[derive(PartialEq)]
enum Port { Ours, Other, Free }

fn engine_port() -> Port {
    let Ok(mut s) = TcpStream::connect_timeout(&ENGINE.parse().unwrap(), Duration::from_millis(300)) else { return Port::Free };
    let _ = s.set_read_timeout(Some(Duration::from_millis(800)));
    let _ = s.write_all(b"GET /health HTTP/1.0\r\nHost: 127.0.0.1:4710\r\n\r\n");
    let mut body = String::new();
    let _ = s.read_to_string(&mut body);
    if body.contains("post-maker-engine") { Port::Ours } else { Port::Other }
}

// Asked by the product page when the engine doesn't answer, so it can say why.
#[tauri::command]
fn engine_status(problem: tauri::State<Problem>) -> String {
    match engine_port() {
        Port::Ours => "running".into(),
        Port::Other => "Another program is using port 4710, so the Post maker engine can’t start. Quit it, then reopen Post maker.".into(),
        Port::Free => problem.0.lock().unwrap().clone().unwrap_or_else(|| "starting".into()),
    }
}

// The user's own shell, interactive and login (-ilc), so Node is found the way their Terminal finds it
// (nvm, fnm and volta set it up in .zshrc).
fn shell(cmd: &str) -> Command {
    let sh = std::env::var("SHELL").ok().filter(|s| s.starts_with('/')).unwrap_or_else(|| "/bin/zsh".into());
    let mut c = Command::new(sh);
    c.args(["-ilc", cmd]).stdin(Stdio::null());
    c
}

// The engine is TypeScript run directly by Node, which needs 22.18 or newer.
fn node_problem() -> Option<String> {
    let out = shell("node -v").stderr(Stdio::null()).output().ok();
    let v = out.map(|o| String::from_utf8_lossy(&o.stdout).trim().trim_start_matches('v').to_string()).unwrap_or_default();
    let mut parts = v.split('.').map(|p| p.parse::<u32>().unwrap_or(0));
    let (major, minor) = (parts.next().unwrap_or(0), parts.next().unwrap_or(0));
    if v.is_empty() { return Some("Node.js isn’t installed, and the local engine needs it. Install Node 22 or newer from nodejs.org, then reopen Post maker.".into()) }
    if major < 22 || (major == 22 && minor < 18) { return Some(format!("The local engine needs Node 22.18 or newer; this Mac has {v}. Update it from nodejs.org, then reopen Post maker.")) }
    None
}

// Keeps an engine running while the app is open. One already running (a developer's own) is used as is.
fn watch_engine(slot: Arc<Mutex<Option<Child>>>, problem: Arc<Mutex<Option<String>>>, server: String) {
    thread::spawn(move || {
        let found = node_problem();
        let blocked = found.is_some();
        *problem.lock().unwrap() = found;
        if blocked { return }
        loop {
            if engine_port() == Port::Free {
                let mut child = slot.lock().unwrap();
                let alive = child.as_mut().map(|c| matches!(c.try_wait(), Ok(None))).unwrap_or(false);
                if !alive { *child = shell(&format!("exec node {:?}", server)).spawn().ok(); }
            }
            thread::sleep(Duration::from_secs(2));
        }
    });
}

// SIGTERM, not kill(): the engine then stops any dev server it started before it exits.
fn stop_engine(app: &AppHandle) {
    if let Some(child) = app.state::<Engine>().0.lock().unwrap().take() {
        let _ = Command::new("kill").arg(child.id().to_string()).status();
    }
}

// On launch, look for a newer release on GitHub. If there is one, ask before installing; never update silently.
// Any failure (offline, no release yet) just leaves the current version running.
fn check_for_update(app: AppHandle) {
    thread::spawn(move || tauri::async_runtime::block_on(async move {
        let Ok(updater) = app.updater() else { return };
        let Ok(Some(update)) = updater.check().await else { return };
        let yes = app.dialog()
            .message(format!("Post maker {} is ready. Install it now? The app restarts when it is done.", update.version))
            .title("Update available")
            .buttons(MessageDialogButtons::OkCancelCustom("Install and restart".into(), "Later".into()))
            .blocking_show();
        if !yes { return }
        match update.download_and_install(|_, _| {}, || {}).await {
            Ok(()) => { stop_engine(&app); app.restart() }
            Err(e) => { app.dialog().message(format!("The update did not install: {e}")).title("Update failed").blocking_show(); }
        }
    }));
}

fn main() {
    let slot = Arc::new(Mutex::new(None));
    let problem = Arc::new(Mutex::new(None));
    let (watched, noted) = (slot.clone(), problem.clone());
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Engine(slot))
        .manage(Problem(problem))
        .invoke_handler(tauri::generate_handler![engine_status, app_url])
        .setup(move |app| {
            // The engine shipped inside the app; a dev build without it runs the repo's copy.
            let server = app.path().resource_dir().ok()
                .map(|d| d.join("engine/engine/server.ts"))
                .filter(|p| p.exists())
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_else(|| format!("{}/../engine/server.ts", env!("CARGO_MANIFEST_DIR")));
            watch_engine(watched.clone(), noted.clone(), server);
            check_for_update(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to start Post maker")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                stop_engine(app);
            }
        });
}
