import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SyncEntry {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete" | "upsert";
  data: Record<string, any>;
  filter?: Record<string, any>; // eq filters for update/delete
  conflictKey?: string;         // for upsert
  timestamp: number;
  retries: number;
}

export interface SyncResult {
  processed: number;
  failed: number;
  errors: string[];
}

const QUEUE_KEY = "offline_sync_queue";
const MAX_RETRIES = 3;

// ── Queue operations ─────────────────────────────────────────────────────────

export async function getQueue(): Promise<SyncEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: SyncEntry[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(entry: Omit<SyncEntry, "id" | "timestamp" | "retries">): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
    retries: 0,
  });
  await saveQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

// ── Process queue ────────────────────────────────────────────────────────────

export async function processQueue(): Promise<SyncResult> {
  const queue = await getQueue();
  if (queue.length === 0) return { processed: 0, failed: 0, errors: [] };

  const remaining: SyncEntry[] = [];
  let processed = 0;
  const errors: string[] = [];

  for (const entry of queue) {
    try {
      await executeEntry(entry);
      processed++;
    } catch (e: any) {
      const msg = e?.message || "Unknown error";
      if (entry.retries + 1 >= MAX_RETRIES) {
        errors.push(`[${entry.table}/${entry.operation}] ${msg} (dropped after ${MAX_RETRIES} retries)`);
        // Drop after max retries
      } else {
        remaining.push({ ...entry, retries: entry.retries + 1 });
      }
    }
  }

  await saveQueue(remaining);
  return { processed, failed: remaining.length + errors.length, errors };
}

async function executeEntry(entry: SyncEntry): Promise<void> {
  const { table, operation, data, filter, conflictKey } = entry;

  switch (operation) {
    case "insert": {
      const { error } = await supabase.from(table).insert([data]);
      if (error) throw error;
      break;
    }
    case "update": {
      if (!filter) throw new Error("Update requires filter");
      let q = supabase.from(table).update(data);
      for (const [k, v] of Object.entries(filter)) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) throw error;
      break;
    }
    case "delete": {
      if (!filter) throw new Error("Delete requires filter");
      let q = supabase.from(table).delete();
      for (const [k, v] of Object.entries(filter)) {
        q = q.eq(k, v);
      }
      const { error } = await q;
      if (error) throw error;
      break;
    }
    case "upsert": {
      const { error } = await supabase
        .from(table)
        .upsert([data], { onConflict: conflictKey || "id" });
      if (error) throw error;
      break;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Generate a UUID for new records — used for consistent IDs between local and remote */
export { generateId as generateUUID };
