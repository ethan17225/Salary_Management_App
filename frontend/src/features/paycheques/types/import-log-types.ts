export type ImportLogStage = 'parse' | 'import';
export type ImportLogStatus = 'ok' | 'error';
export type ImportLogParser = 'tabular' | 'pdf_text' | 'vision' | 'ocr';

export interface ImportLogStep {
  step: string;
  status: 'ok' | 'error' | 'skipped' | string;
  duration_ms: number | null;
  output: Record<string, unknown>;
}

export interface ImportPipelineLogSummary {
  id: number;
  created_at: string;
  stage: ImportLogStage;
  status: ImportLogStatus;
  parse_log_id: number | null;
  filename: string | null;
  file_size_bytes: number | null;
  file_sha256: string | null;
  detected_mime: string | null;
  ocr_runtime: string | null;
  vision_model: string | null;
  parser_used: ImportLogParser | null;
  used_llm_fallback: boolean;
  duration_ms: number;
  row_count: number;
  warning_count: number;
  error_message: string | null;
  step_names: string[];
}

export interface ImportPipelineLogDetail extends ImportPipelineLogSummary {
  steps: ImportLogStep[];
  response: Record<string, unknown> | null;
  linked_import_ids: number[];
}

export interface ImportLogFilterParams {
  stage?: string;
  status?: string;
  parser?: string;
  warnings?: string;
  q?: string;
  year?: string;
}
