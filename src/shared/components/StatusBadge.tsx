interface StatusBadgeProps {
  status: "pending" | "running" | "success" | "error" | boolean;
  label?: string;
  type?: "job" | "dependency";
}

export function StatusBadge({ status, label, type = "job" }: StatusBadgeProps) {
  if (type === "dependency") {
    const isOk = !!status;
    return (
      <div 
        className="flex items-center gap-1.5 font-medium" 
        title={label || (isOk ? "Active" : "Inactive")}
      >
        <span className={`w-2 h-2 rounded-full ${
          isOk 
            ? "bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.7)]" 
            : "bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.7)]"
        }`} />
        {label && <span>{label}</span>}
      </div>
    );
  }

  // Job Status badges
  const state = status as "pending" | "running" | "success" | "error";

  const statusMap = {
    pending: {
      dotClass: "bg-brand-dark",
      title: "Pending",
    },
    running: {
      dotClass: "bg-brand-primary animate-pulse",
      title: "Running...",
    },
    success: {
      dotClass: "bg-brand-success shadow-[0_0_8px_rgba(16,185,129,0.7)]",
      title: "Success",
    },
    error: {
      dotClass: "bg-brand-danger shadow-[0_0_8px_rgba(239,68,68,0.7)]",
      title: "Error",
    },
  };

  const current = statusMap[state] || statusMap.pending;

  return (
    <span 
      className={`w-2 h-2 rounded-full ${current.dotClass}`} 
      title={label || current.title} 
    />
  );
}
