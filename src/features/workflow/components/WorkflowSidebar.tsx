import { useWorkflowStore } from "../store/workflowStore";

export function WorkflowSidebar() {
  const {
    workflows,
    activeWorkflow,
    setActiveWorkflow,
  } = useWorkflowStore();

  const getRelativeName = (path: string) => {
    const idx = path.lastIndexOf("/");
    const idxBack = path.lastIndexOf("\\");
    const divider = idx > idxBack ? idx : idxBack;
    return divider !== -1 ? path.substring(divider + 1) : path;
  };

  return (
    <div className="w-75 bg-brand-panel border-r border-brand-border flex flex-col overflow-y-auto select-none custom-scrollbar">
      <div className="py-3 px-4 text-[10px] uppercase tracking-wider text-brand-muted font-bold border-b border-brand-border">
        Workflows
      </div>
      {workflows.length === 0 ? (
        <div className="p-4 text-brand-muted text-xs italic">
          No local workflows found.
        </div>
      ) : (
        workflows.map((wf) => (
          <div
            key={wf.file_path}
            className={`py-3 px-4 border-b border-brand-border cursor-pointer transition-all duration-150 ${
              activeWorkflow?.file_path === wf.file_path 
                ? "bg-brand-primary-light border-l-4 border-brand-primary" 
                : "hover:bg-brand-primary/5"
            }`}
            onClick={() => setActiveWorkflow(wf)}
          >
            <div className="flex justify-between items-center mb-1">
              <div className="font-semibold text-sm truncate max-w-42.5">{wf.name}</div>
              <div className="text-[9px] py-0.5 px-1.5 bg-brand-panel-header rounded text-brand-muted font-medium truncate max-w-22.5">
                {wf.events.join(", ")}
              </div>
            </div>
            <div className="text-[10px] text-brand-muted font-mono truncate">{getRelativeName(wf.file_path)}</div>
          </div>
        ))
      )}
    </div>
  );
}
