mod native;

use std::sync::Mutex;
use tauri::{Emitter, Manager};

use native::{
    export_bve_project, export_mtr_project, export_openbve_project, msep_path_from_args,
    normalize_audio_for_preview, open_msep_file, pack_msep_file, read_audio_metadata_batch,
    read_external_file, read_msep_file, read_msep_modified_at, register_msep_file_association,
    sample_curves_batch, startup_msep_path_from_args, write_msep_file,
};

#[derive(Default)]
struct MsepOpenState {
    frontend_ready: bool,
    pending_path: Option<String>,
}

#[derive(Default)]
struct SharedMsepOpenState(Mutex<MsepOpenState>);

#[tauri::command]
fn startup_msep_path(app: tauri::AppHandle) -> Option<String> {
    let pending_path = app
        .state::<SharedMsepOpenState>()
        .0
        .lock()
        .ok()
        .and_then(|mut state| {
            state.frontend_ready = true;
            state.pending_path.take()
        });

    pending_path.or_else(startup_msep_path_from_args)
}

fn handle_msep_open_request(app: &tauri::AppHandle, path: String) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    let should_emit = app
        .state::<SharedMsepOpenState>()
        .0
        .lock()
        .map(|mut state| {
            if state.frontend_ready {
                true
            } else {
                state.pending_path = Some(path.clone());
                false
            }
        })
        .unwrap_or(true);

    if should_emit {
        let _ = app.emit("msep-open-requested", path);
    }
}

#[cfg(target_os = "macos")]
fn msep_path_from_opened_urls(urls: &[tauri::Url]) -> Option<String> {
    urls.iter().find_map(|url| {
        let path = url.to_file_path().ok()?;
        let path = path.to_str()?.to_owned();
        native::is_msep_path(&path).then_some(path)
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SharedMsepOpenState::default())
        .setup(|app| {
            register_msep_file_association(app.handle());
            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = msep_path_from_args(args) {
                handle_msep_open_request(app, path);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_msep_file,
            read_external_file,
            write_msep_file,
            read_msep_modified_at,
            startup_msep_path,
            read_audio_metadata_batch,
            normalize_audio_for_preview,
            sample_curves_batch,
            pack_msep_file,
            open_msep_file,
            export_bve_project,
            export_mtr_project,
            export_openbve_project
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(path) = msep_path_from_opened_urls(&urls) {
                    handle_msep_open_request(_app, path);
                }
            }
        });
}
