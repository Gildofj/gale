import { useEffect } from "react";
import { useWorkflowStore } from "./features/workflow/store/workflowStore";
import { useDockerStore } from "./features/docker/store/dockerStore";
import { WorkspaceHeader } from "./features/workspace/components/WorkspaceHeader";
import { WorkflowSidebar } from "./features/workflow/components/WorkflowSidebar";
import { JobSelector } from "./features/workflow/components/JobSelector";
import { ConsoleLogs } from "./features/workflow/components/ConsoleLogs";
import { WorkflowGraph } from "./features/workflow/components/WorkflowGraph";
import { SecretsModal } from "./features/secrets/components/SecretsModal";
import { DockerModal } from "./features/docker/components/DockerModal";
import "./index.css";

export default function App() {
  const {
    repoPath,
    activeWorkflow,
    activeTab,
    initListeners,
    cleanupListeners,
  } = useWorkflowStore();

  const { autoCleanOnStartup } = useDockerStore();

  useEffect(() => {
    initListeners();
    autoCleanOnStartup();
    return () => {
      cleanupListeners();
    };
  }, [initListeners, cleanupListeners, repoPath, autoCleanOnStartup]);

  return (
    <div className="h-screen w-screen flex flex-col bg-brand-bg text-brand-text font-sans overflow-hidden">
      <WorkspaceHeader />

      <div className="flex flex-1 overflow-hidden">
        <WorkflowSidebar />

        <div className="flex-1 flex flex-col bg-brand-bg overflow-hidden">
          {activeWorkflow ? (
            <>
              <JobSelector />
              {activeTab === "graph" ? <WorkflowGraph /> : <ConsoleLogs />}
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

      <SecretsModal />

      <DockerModal />
    </div>
  );
}
