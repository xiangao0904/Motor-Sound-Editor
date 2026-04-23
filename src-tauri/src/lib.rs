use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Manager};

fn is_msep_path(path: &str) -> bool {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default();

    extension.eq_ignore_ascii_case("msep")
}

fn ensure_msep_path(path: &str) -> Result<(), String> {
    if is_msep_path(path) {
        Ok(())
    } else {
        Err("Only .msep files are supported".to_string())
    }
}

fn msep_path_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter().find(|arg| is_msep_path(arg))
}

#[tauri::command]
fn read_msep_file(path: String) -> Result<Vec<u8>, String> {
    ensure_msep_path(&path)?;
    fs::read(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_msep_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    ensure_msep_path(&path)?;
    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn read_msep_modified_at(path: String) -> Result<u64, String> {
    ensure_msep_path(&path)?;
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified_at = metadata.modified().map_err(|error| error.to_string())?;
    let duration = modified_at
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;

    Ok(duration.as_millis() as u64)
}

#[tauri::command]
fn startup_msep_path() -> Option<String> {
    msep_path_from_args(std::env::args())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = msep_path_from_args(args) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
                let _ = app.emit("msep-open-requested", path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_msep_file,
            write_msep_file,
            read_msep_modified_at,
            startup_msep_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
