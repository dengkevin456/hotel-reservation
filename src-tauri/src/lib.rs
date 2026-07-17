use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Launches the automation sidecar binary (built from automation/openExample.mjs)
// via the Tauri shell sidecar API. Playwright can't run in the webview, so it
// runs as its own process here.
#[tauri::command]
async fn run_automation(
    app: tauri::AppHandle,
    url: Option<String>,
    download_path: Option<String>,
    open_in_excel: Option<bool>,
    username: Option<String>,
    password: Option<String>,
) -> Result<String, String> {
    let url = url.unwrap_or_else(|| "https://www.example.com".to_string());
    // Positional args (empty string = "use default"): url, download folder, excel flag.
    let download_path = download_path.unwrap_or_default();
    let open_flag = if open_in_excel.unwrap_or(false) { "excel" } else { "" };

    let sidecar = app
        .shell()
        .sidecar("automation")
        .map_err(|e| format!("Failed to resolve automation sidecar: {e}"))?
        .args([url, download_path, open_flag.to_string()])
        // Pass credentials via env vars, not CLI args, so they don't leak into
        // process listings or terminal logs.
        .env("AUTOMATION_USERNAME", username.unwrap_or_default())
        .env("AUTOMATION_PASSWORD", password.unwrap_or_default());

    let (mut rx, mut _child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to launch automation sidecar: {e}"))?;

    // Stream the sidecar's output to the terminal live, and capture the exit code.
    let mut exit_code = None;
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => print!("{}", String::from_utf8_lossy(&bytes)),
            CommandEvent::Stderr(bytes) => eprint!("{}", String::from_utf8_lossy(&bytes)),
            CommandEvent::Terminated(payload) => exit_code = payload.code,
            _ => {}
        }
    }

    match exit_code {
        Some(0) => Ok("Automation finished. See the terminal for logs.".to_string()),
        Some(code) => Err(format!(
            "Automation failed (exit code {code}). See the terminal for details."
        )),
        None => Err("Automation terminated without an exit code.".to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet, run_automation])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
