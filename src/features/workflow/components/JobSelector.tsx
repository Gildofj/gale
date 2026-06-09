import { useWorkflowStore } from "../store/workflowStore";
import { Button } from "../../../shared/components/Button";

export function JobSelector() {
  const {
    activeWorkflow,
    isWorkflowRunning,
    runningJobId,
    activeTab,
    setActiveTab,
    runWorkflow,
    stopWorkflow,
  } = useWorkflowStore();

  if (!activeWorkflow) return null;

  const handleWorkflowAction = () => {
    if (isWorkflowRunning) {
      stopWorkflow();
    } else {
      runWorkflow();
    }
  };

  const isWorkflowButtonDisabled = runningJobId !== null && !isWorkflowRunning;

  return (
    <div className="px-6 py-4 bg-brand-panel border-b border-brand-border flex flex-col md:flex-row justify-between items-center gap-4 select-none">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted font-mono">
            Active Workflow
          </span>
          <span className="text-sm font-bold text-brand-text truncate max-w-50" title={activeWorkflow.name}>
            {activeWorkflow.name}
          </span>
        </div>

        <div className="flex bg-brand-console border border-brand-border p-1 rounded-lg">
          <button
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold font-sans cursor-pointer transition-all duration-150 ${
              activeTab === "graph"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-brand-muted hover:text-brand-text hover:bg-brand-panel-header"
            }`}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
            <span>Graph View</span>
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold font-sans cursor-pointer transition-all duration-150 ${
              activeTab === "logs"
                ? "bg-brand-primary text-white shadow-sm"
                : "text-brand-muted hover:text-brand-text hover:bg-brand-panel-header"
            }`}
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-4H6V10h12v2z" />
            </svg>
            <span>Terminal Logs</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <Button
          variant={isWorkflowRunning ? "danger" : "primary"}
          onClick={handleWorkflowAction}
          disabled={isWorkflowButtonDisabled}
          size="md"
          className="w-full sm:w-auto font-semibold"
        >
          {isWorkflowRunning ? (
            <>
              <svg className="w-4 h-4 fill-current animate-pulse mr-1" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
              <span>Stop Run</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 fill-current mr-1" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
              </svg>
              <span>Run Workflow</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
