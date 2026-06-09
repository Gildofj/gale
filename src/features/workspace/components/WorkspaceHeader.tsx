import { useEffect } from "react";
import { useWorkflowStore } from "../../workflow/store/workflowStore";
import { useSecretsStore } from "../../secrets/store/secretsStore";
import { useDockerStore } from "../../docker/store/dockerStore";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/StatusBadge";

export function WorkspaceHeader() {
  const {
    repoPath,
    dockerInstalled,
    actInstalled,
    checkingDeps,
    checkDependencies,
    selectDirectory,
  } = useWorkflowStore();

  const {
    secrets,
    setSecretsModalOpen,
  } = useSecretsStore();

  const {
    setModalOpen: setDockerModalOpen,
  } = useDockerStore();

  // Executa checagem inicial de dependências ao carregar
  useEffect(() => {
    checkDependencies();
  }, [checkDependencies]);

  return (
    <>
      {/* Dependency Status Banner */}
      <div className="flex justify-between items-center py-2 px-4 bg-brand-panel border-b border-brand-border text-xs select-none">
        <div>
          <span className="font-semibold text-brand-primary">Local Pipeline Orchestrator</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-1.5">
            <StatusBadge 
              type="dependency" 
              status={dockerInstalled} 
              label="Docker" 
            />
            {dockerInstalled && (
              <button
                onClick={() => setDockerModalOpen(true)}
                className="text-[10px] text-brand-muted hover:text-brand-primary cursor-pointer transition-all duration-150 flex items-center gap-1 bg-brand-console hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary/30 rounded px-1.5 py-0.5"
                title="Manage Docker Resources"
              >
                <span>⚙️</span>
                <span>Manage</span>
              </button>
            )}
          </div>
          <StatusBadge 
            type="dependency" 
            status={actInstalled} 
            label="act CLI" 
          />
          <Button 
            variant="ghost" 
            onClick={checkDependencies} 
            disabled={checkingDeps}
          >
            {checkingDeps ? "Checking..." : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Workspace picking header */}
      <div className="flex items-center gap-3 p-4 bg-brand-panel border-b border-brand-border select-none">
        <Button 
          variant="primary" 
          onClick={selectDirectory}
        >
          Select Repository Folder
        </Button>
        <div 
          className="flex-1 py-2 px-3 bg-brand-console border border-brand-border rounded-md font-mono text-xs text-brand-muted truncate select-text" 
          title={repoPath}
        >
          {repoPath || "No workspace folder selected (Choose a folder containing .github/workflows/)"}
        </div>
        {repoPath && (
          <Button
            variant="secondary"
            onClick={() => setSecretsModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <span>🔑</span>
            <span>Manage Secrets ({Object.keys(secrets).length})</span>
          </Button>
        )}
      </div>
    </>
  );
}
