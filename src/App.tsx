import { useEffect } from "react";
import { useWorkflowStore } from "./features/workflow/store/workflowStore";
import { useDockerStore } from "./features/docker/store/dockerStore";
import { WorkspaceHeader } from "./features/workspace/components/WorkspaceHeader";
import { WorkflowSidebar } from "./features/workflow/components/WorkflowSidebar";
import { JobSelector } from "./features/workflow/components/JobSelector";
import { ConsoleLogs } from "./features/workflow/components/ConsoleLogs";
import { SecretsModal } from "./features/secrets/components/SecretsModal";
import { DockerModal } from "./features/docker/components/DockerModal";
import "./index.css";

export default function App() {
  const {
    repoPath,
    activeWorkflow,
    initListeners,
    cleanupListeners,
  } = useWorkflowStore();

  const { autoCleanOnStartup } = useDockerStore();

  // Inicializa listeners do IPC do Tauri (runner-log, workflows-changed)
  useEffect(() => {
    initListeners();
    autoCleanOnStartup();
    return () => {
      cleanupListeners();
    };
  }, [initListeners, cleanupListeners, repoPath, autoCleanOnStartup]);

  return (
    <div className="h-screen w-screen flex flex-col bg-brand-bg text-brand-text font-sans overflow-hidden">
      {/* Barra de conexões e barra de controle do diretório de trabalho */}
      <WorkspaceHeader />

      {/* Área principal dividida */}
      <div className="flex flex-1 overflow-hidden">
        {/* Barra lateral de listagem de arquivos YAML */}
        <WorkflowSidebar />

        {/* Console e controles de job/workflow ativos */}
        <div className="flex-1 flex flex-col bg-brand-bg overflow-hidden">
          {activeWorkflow ? (
            <>
              {/* Seleção do job de workflow ativo */}
              <JobSelector />
              {/* Terminal virtual e logs em tempo real */}
              <ConsoleLogs />
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-10 bg-brand-bg gap-4 select-none">
              <div className="text-5xl">🚀</div>
              <div className="text-2xl font-bold text-brand-text">Local Pipeline Orchestrator</div>
              <div className="text-brand-muted max-w-[480px] text-sm leading-relaxed">
                To get started, select a local repository directory containing a GitHub Actions workflows directory (`.github/workflows/`). 
                Make sure Docker is active and the `act` CLI is installed to execute jobs locally.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de gerenciamento de secrets local */}
      <SecretsModal />

      {/* Modal de gerenciamento de recursos Docker */}
      <DockerModal />
    </div>
  );
}
