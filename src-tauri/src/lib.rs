pub mod domain;
pub mod application;
pub mod infrastructure;
pub mod interface;

use crate::interface::commands::{
    list_workflows_cmd,
    run_job_cmd,
    check_dependencies_cmd,
    select_directory_cmd,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_workflows_cmd,
            run_job_cmd,
            check_dependencies_cmd,
            select_directory_cmd,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
