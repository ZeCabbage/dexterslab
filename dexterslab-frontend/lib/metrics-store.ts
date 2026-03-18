/**
 * DEXTER'S LAB — Inbox Buddy Metrics Store
 * Simple file-based metrics persistence
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { CleanMetrics } from './gmail';

const DATA_DIR = path.join(process.cwd(), 'data');
const METRICS_FILE = path.join(DATA_DIR, 'inbox-buddy-metrics.json');

export interface StoredMetrics {
  lastClean: CleanMetrics | null;
  history: CleanMetrics[];
  totalCleans: number;
}

const DEFAULT_METRICS: StoredMetrics = {
  lastClean: null,
  history: [],
  totalCleans: 0,
};

export async function loadMetrics(): Promise<StoredMetrics> {
  try {
    const raw = await fs.readFile(METRICS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { ...DEFAULT_METRICS };
  }
}

export async function saveMetrics(metrics: CleanMetrics): Promise<StoredMetrics> {
  const stored = await loadMetrics();

  stored.lastClean = metrics;
  stored.history.unshift(metrics);
  // Keep last 30 entries
  if (stored.history.length > 30) {
    stored.history = stored.history.slice(0, 30);
  }
  stored.totalCleans++;

  // Ensure data dir exists
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(METRICS_FILE, JSON.stringify(stored, null, 2));

  return stored;
}
