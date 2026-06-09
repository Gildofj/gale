pub mod domain;
pub mod application;
pub mod infrastructure;
pub mod interface;

use crate::interface::commands::{
    list_workflows_cmd,
    run_job_cmd,
    stop_job_cmd,
    check_dependencies_cmd,
    select_directory_cmd,
    start_watching_workflows,
    load_secrets_cmd,
    save_secrets_cmd,
    import_secrets_from_env_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(crate::infrastructure::watcher::WatcherState::default())
        .setup(|app| {
            crate::infrastructure::act::init_app_handle(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_workflows_cmd,
            run_job_cmd,
            stop_job_cmd,
            check_dependencies_cmd,
            select_directory_cmd,
            start_watching_workflows,
            load_secrets_cmd,
            save_secrets_cmd,
            import_secrets_from_env_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

