/**
 * @file frontend/src/lib/offlineQueue.ts
 * @description Offline attendance submission queue.
 * Buffers attendance submissions to IndexedDB when the server is unreachable
 * and automatically syncs them back when connectivity is restored.
 */

const DB_NAME = "attendreg_offline";
const STORE_NAME = "attendance_queue";
const DB_VERSION = 1;

export interface QueuedSubmission {
  id?: number;
  studentId: string;
  name: string;
  department?: string;
  deviceId?: string;
  queuedAt: number; // epoch ms
  retries: number;
  lastError?: string;
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        store.createIndex("queuedAt", "queuedAt", { unique: false });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Add a failed submission to the offline queue */
export async function enqueue(payload: Omit<QueuedSubmission, "id" | "queuedAt" | "retries">): Promise<void> {
  const db = await openDB();
  const record: QueuedSubmission = { ...payload, queuedAt: Date.now(), retries: 0 };
  return new Promise((resolve, reject) => {
    const req = txStore(db, "readwrite").add(record);
    req.onsuccess = () => {
      console.log("[offline-queue] Submission queued for later sync:", payload.studentId);
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Return all pending queue items */
export async function getAllQueued(): Promise<QueuedSubmission[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = txStore(db, "readonly").getAll();
    req.onsuccess = () => resolve(req.result as QueuedSubmission[]);
    req.onerror = () => reject(req.error);
  });
}

/** Remove a successfully synced item */
export async function dequeue(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = txStore(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Update retry count + last error for a failed sync attempt */
export async function updateRetry(id: number, error: string): Promise<void> {
  const db = await openDB();
  const store = txStore(db, "readwrite");
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result as QueuedSubmission;
      if (!record) return resolve();
      record.retries += 1;
      record.lastError = error;
      const putReq = txStore(db, "readwrite").put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Count items in the queue */
export async function queueSize(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = txStore(db, "readonly").count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Sync Engine ────────────────────────────────────────────────────────────

const MAX_RETRIES = 5;

async function syncOnce(): Promise<{ synced: number; failed: number }> {
  const items = await getAllQueued();
  if (items.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      // Give up on items that failed too many times
      await dequeue(item.id!);
      failed++;
      continue;
    }

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: item.name,
          studentId: item.studentId,
          department: item.department,
          deviceId: item.deviceId,
        }),
      });

      if (res.ok || res.status === 409) {
        // 409 = already submitted (don't retry)
        await dequeue(item.id!);
        synced++;
        console.log(`[offline-queue] Synced submission for ${item.studentId}`);
      } else {
        await updateRetry(item.id!, `HTTP ${res.status}`);
        failed++;
      }
    } catch (err: any) {
      await updateRetry(item.id!, err.message);
      failed++;
    }
  }

  return { synced, failed };
}

let _syncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background sync process.
 * Tries every 30 seconds when online, pauses when offline.
 */
export function startOfflineSync(onSync?: (result: { synced: number; failed: number; remaining: number }) => void) {
  if (_syncInterval) return; // Already running

  const attempt = async () => {
    if (!navigator.onLine) return;
    try {
      const result = await syncOnce();
      const remaining = await queueSize();
      if ((result.synced > 0 || result.failed > 0) && onSync) {
        onSync({ ...result, remaining });
      }
    } catch (err) {
      console.warn("[offline-queue] Sync error:", err);
    }
  };

  // Sync on reconnect
  window.addEventListener("online", attempt);

  // Periodic sync
  _syncInterval = setInterval(attempt, 30_000);

  // Try immediately
  attempt();
}

export function stopOfflineSync() {
  if (_syncInterval) {
    clearInterval(_syncInterval);
    _syncInterval = null;
  }
}
