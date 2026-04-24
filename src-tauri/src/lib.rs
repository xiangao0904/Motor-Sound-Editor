mod native;

use tauri::{Emitter, Manager};

use native::{
    export_bve_project, msep_path_from_args, open_msep_file, pack_msep_file,
    read_audio_metadata_batch, read_msep_file, read_msep_modified_at,
    register_msep_file_association, sample_curves_batch, startup_msep_path, write_msep_file,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            register_msep_file_association(app.handle());
            Ok(())
        })
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
            startup_msep_path,
            read_audio_metadata_batch,
            sample_curves_batch,
            pack_msep_file,
            open_msep_file,
            export_bve_project
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
