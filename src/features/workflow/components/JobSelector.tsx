import { useWorkflowStore, areDependenciesMet } from "../store/workflowStore";
import { Button } from "../../../shared/components/Button";
import { StatusBadge } from "../../../shared/components/StatusBadge";

export function JobSelector() {
  const {
    activeWorkflow,
    activeJob,
    jobStatuses,
    isWorkflowRunning,
    runningJobId,
    setActiveJob,
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
    <div className="p-4 bg-brand-panel border-b border-brand-border flex flex-col gap-3 select-none">
      <div className="flex justify-between items-center">
        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          Select Workflow Job
        </div>
        <div>
          <Button
            variant={isWorkflowRunning ? "danger" : "primary"}
            onClick={handleWorkflowAction}
            disabled={isWorkflowButtonDisabled}
            size="sm"
          >
            {isWorkflowRunning ? "Stop Workflow Run" : "Run Entire Workflow"}
          </Button>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        {activeWorkflow.jobs.map((job) => {
          const status = jobStatuses[job.id] || "pending";
          const depsMet = areDependenciesMet(job, jobStatuses);
          const isActive = activeJob?.id === job.id;

          return (
            <div
              key={job.id}
              className={`p-3 bg-brand-bg border rounded-lg min-w-[170px] cursor-pointer transition-all duration-200 hover:border-brand-primary hover:-translate-y-0.5 ${
                isActive 
                  ? "border-brand-primary bg-brand-primary-light" 
                  : "border-brand-border"
              } ${!depsMet ? "opacity-75 border-dashed border-brand-warning/40" : ""}`}
              onClick={() => setActiveJob(job)}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-semibold text-xs text-brand-text truncate mr-2">
                  {job.name || job.id}
                </span>
                <StatusBadge status={status} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-[10px] text-brand-muted">{job.steps.length} Steps</div>
                {job.needs && job.needs.length > 0 && (
                  <div 
                    className="text-[9px] text-brand-warning truncate font-medium animate-pulse" 
                    title={`Needs: ${job.needs.join(", ")}`}
                  >
                    {depsMet ? "✓" : "🔒"} Needs: {job.needs.join(", ")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
