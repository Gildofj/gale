import { useEffect, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
} from "@xyflow/react";
import { useWorkflowStore, areDependenciesMet } from "../store/workflowStore";
import { JobNode } from "./JobNode";
import { Job } from "../../../entities/pipeline";

const nodeTypes = {
  jobNode: JobNode,
};

export function WorkflowGraph() {
  const {
    activeWorkflow,
    activeJob,
    jobStatuses,
    isWorkflowRunning,
    runningJobId,
    setActiveJob,
    runSingleJob,
    stopJob,
  } = useWorkflowStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const graphData = useMemo(() => {
    if (!activeWorkflow || activeWorkflow.jobs.length === 0) {
      return { nodes: [], edges: [] };
    }

    const jobs = activeWorkflow.jobs;
    const ranks: Record<string, number> = {};
    const visiting = new Set<string>();

    const getRank = (id: string): number => {
      if (id in ranks) return ranks[id];
      if (visiting.has(id)) return 0;

      visiting.add(id);
      const job = jobs.find((j) => j.id === id);
      if (!job || !job.needs || job.needs.length === 0) {
        visiting.delete(id);
        ranks[id] = 0;
        return 0;
      }

      let maxDepRank = 0;
      for (const depId of job.needs) {
        maxDepRank = Math.max(maxDepRank, getRank(depId));
      }
      visiting.delete(id);
      ranks[id] = maxDepRank + 1;
      return ranks[id];
    };

    for (const job of jobs) {
      getRank(job.id);
    }

    const columns: Record<number, string[]> = {};
    for (const job of jobs) {
      const r = ranks[job.id] ?? 0;
      if (!columns[r]) columns[r] = [];
      columns[r].push(job.id);
    }

    const nodeWidth = 220;
    const horizontalGap = 80;
    const verticalGap = 40;

    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const cols = Object.keys(columns).map(Number).sort((a, b) => a - b);
    
    cols.forEach((colIndex) => {
      const jobIds = columns[colIndex];
      const colX = colIndex * (nodeWidth + horizontalGap) + 40;
      
      let colY = 40;
      jobIds.forEach((jobId) => {
        const job = jobs.find((j) => j.id === jobId)!;
        const hasMatrix = job.matrix_configs && job.matrix_configs.length > 0;
        const currentHeight = hasMatrix ? 240 : 110;

        initialNodes.push({
          id: jobId,
          type: "jobNode",
          position: { x: colX, y: colY },
          data: { job },
          style: {
            width: nodeWidth,
            height: currentHeight
          }
        });

        colY += currentHeight + verticalGap;

        if (job.needs) {
          job.needs.forEach((depId) => {
            const depStatus = jobStatuses[depId] || "pending";
            let edgeClass = "active";
            if (depStatus === "success") {
              edgeClass = "success";
            } else if (depStatus === "running") {
              edgeClass = "running";
            }

            initialEdges.push({
              id: `${depId}->${jobId}`,
              source: depId,
              target: jobId,
              className: edgeClass,
              animated: depStatus === "running",
            });
          });
        }
      });
    });

    return { nodes: initialNodes, edges: initialEdges };
  }, [activeWorkflow, jobStatuses]);

  const handleRunJob = useCallback(
    async (job: Job) => {
      await runSingleJob(job);
    },
    [runSingleJob]
  );

  const handleStopJob = useCallback(async () => {
    await stopJob();
  }, [stopJob]);

  useEffect(() => {
    setNodes((prevNodes) => {
      return graphData.nodes.map((node) => {
        const jobId = node.id;
        const job = (node.data as any).job;
        const status = jobStatuses[jobId] || "pending";
        const isActive = activeJob?.id === jobId;
        const depsMet = areDependenciesMet(job, jobStatuses);

        const existingNode = prevNodes.find((n) => n.id === jobId);
        const currentStyle = existingNode?.style || node.style;
        const currentPosition = existingNode?.position || node.position;

        return {
          ...node,
          position: currentPosition,
          style: currentStyle,
          data: {
            job,
            status,
            isActive,
            isWorkflowRunning,
            runningJobId,
            depsMet,
            onSelect: setActiveJob,
            onRun: handleRunJob,
            onStop: handleStopJob,
          },
        };
      });
    });
    setEdges(graphData.edges);
  }, [
    graphData,
    jobStatuses,
    activeJob,
    isWorkflowRunning,
    runningJobId,
    setActiveJob,
    handleRunJob,
    handleStopJob,
    setNodes,
    setEdges,
  ]);

  if (!activeWorkflow) {
    return (
      <div className="flex-1 flex items-center justify-center text-brand-muted text-sm italic">
        No workflow active to load dependency tree.
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full relative overflow-hidden bg-brand-bg select-none">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        panOnScroll={false}
        zoomOnScroll={true}
        preventScrolling={true}
      >
        <Background color="#282A30" gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          style={{
            backgroundColor: "var(--color-brand-panel)",
            border: "1px solid var(--color-brand-border)",
            borderRadius: "6px",
          }}
          nodeColor={(n) => {
            const status = jobStatuses[n.id] || "pending";
            if (status === "success") return "var(--color-brand-success)";
            if (status === "running") return "var(--color-brand-primary)";
            if (status === "error") return "var(--color-brand-danger)";
            return "var(--color-brand-dark)";
          }}
          maskColor="rgba(18, 19, 22, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}
