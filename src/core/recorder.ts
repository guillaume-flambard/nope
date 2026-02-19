// ═══════════════════════════════════════
// NOPE. — Call Recorder (Persistence)
// ═══════════════════════════════════════

import { mkdir, writeFile, readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { CallResult, CallTask } from './types';

// ── Stored record shape ──

interface CallRecord {
  task: CallTask;
  result: CallResult;
  savedAt: string;
}

/** Summary returned by list() */
export interface CallSummary {
  taskId: string;
  date: string;
  company: string;
  status: string;
  duration: number;
  goal: string;
}

export class CallRecorder {
  private dir: string;

  constructor() {
    this.dir = join(homedir(), '.nope', 'calls');
  }

  /** Ensure the storage directory exists */
  private async ensureDir(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  /** Save a call result + task to disk. Returns the file path. */
  async save(result: CallResult, task: CallTask): Promise<string> {
    await this.ensureDir();

    const record: CallRecord = {
      task,
      result,
      savedAt: new Date().toISOString(),
    };

    const filePath = join(this.dir, `${task.id}.json`);
    await writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
    return filePath;
  }

  /** Load a single call by taskId. Returns null if not found. */
  async load(taskId: string): Promise<CallRecord | null> {
    try {
      const filePath = join(this.dir, `${taskId}.json`);
      const raw = await readFile(filePath, 'utf-8');
      return JSON.parse(raw) as CallRecord;
    } catch {
      return null;
    }
  }

  /** List all saved calls (sorted by date, most recent first) */
  async list(): Promise<CallSummary[]> {
    await this.ensureDir();

    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }

    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const summaries: CallSummary[] = [];

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(this.dir, file), 'utf-8');
        const record = JSON.parse(raw) as CallRecord;
        summaries.push({
          taskId: record.task.id,
          date: record.savedAt,
          company: record.task.company || 'Unknown',
          status: record.result.status,
          duration: record.result.duration,
          goal: record.task.goal,
        });
      } catch {
        // Skip corrupted files
      }
    }

    // Most recent first
    summaries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return summaries;
  }
}
