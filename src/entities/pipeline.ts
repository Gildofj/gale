export interface Step {
  name: string | null;
  run: string | null;
  uses: string | null;
}

export interface MatrixConfig {
  id: string;
  name: string;
  values: Record<string, string>;
}

export interface Job {
  id: string;
  name: string | null;
  steps: Step[];
  needs: string[] | null;
  matrix_configs?: MatrixConfig[];
}

export interface Workflow {
  file_path: string;
  name: string;
  events: string[];
  jobs: Job[];
}

export interface LogLine {
  job_id: string;
  step_name: string;
  message: string;
  stream: string;
  timestamp: number;
}
