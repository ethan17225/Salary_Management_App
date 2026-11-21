import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import type {
  ImportPipelineLogDetail,
  ImportPipelineLogSummary,
} from '../types/import-log-types';

export const getImportLogs = cache(
  async (limit = 200): Promise<ImportPipelineLogSummary[]> => {
    return db.get<ImportPipelineLogSummary[]>(`paycheques/import-logs?limit=${limit}`);
  }
);

export const getImportLogById = cache(
  async (id: number): Promise<ImportPipelineLogDetail | null> => {
    return db.getOptional<ImportPipelineLogDetail>(`paycheques/import-logs/${id}`);
  }
);
