import type { JobPayload, JobStatus, StoredJob } from "@/types/training-job";

const INDEX_STORAGE_KEY = "training-job-ui:index";
const PAYLOAD_PREFIX = "training-job-ui:payload:";

type StoredIndex = StoredJob[];

function isStoredJob(maybe: unknown): maybe is StoredJob {
  if (!maybe || typeof maybe !== "object") return false;
  const candidate = maybe as Partial<StoredJob>;
  const validStatus = candidate.status === "Pending" || candidate.status === "Running" || candidate.status === "Succeeded" || candidate.status === "Failed";
  return (
    typeof candidate.id === "string" &&
    typeof candidate.algorithm === "string" &&
    typeof candidate.createdAt === "number" &&
    typeof candidate.priority === "number" &&
    validStatus
  );
}

function readIndex(): StoredIndex {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(INDEX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredJob);
  } catch {
    return [];
  }
}

function writeIndex(entries: StoredIndex) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(INDEX_STORAGE_KEY, JSON.stringify(entries));
}

export async function loadJobs(): Promise<StoredJob[]> {
  const entries = readIndex();
  const now = Date.now();
  let mutated = false;
  const normalized = entries.map((job) => {
    if (job.status === "Pending" && job.pendingUntil && now >= job.pendingUntil) {
      mutated = true;
      return { ...job, status: "Running" as JobStatus, pendingUntil: undefined };
    }
    return job;
  });
  if (mutated) {
    writeIndex(normalized);
  }
  return normalized;
}

export async function persistJob(payload: JobPayload, job: StoredJob): Promise<{ ok: true; filename: string } | { ok: false }> {
  try {
    const filename = `${job.id}-${Date.now()}.json`;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${PAYLOAD_PREFIX}${filename}`, JSON.stringify(payload, null, 2));
    }
    const entries = readIndex().filter((entry) => entry.id !== job.id);
    entries.push(job);
    writeIndex(entries);
    return { ok: true, filename };
  } catch (error) {
    console.error("Failed to persist job payload", error);
    return { ok: false };
  }
}

export async function clearJobs(): Promise<void> {
  if (typeof window === "undefined") return;
  const entries = readIndex();
  for (const job of entries) {
    const prefix = `${job.id}-`;
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(PAYLOAD_PREFIX) && key.includes(prefix)) {
        window.localStorage.removeItem(key);
      }
    }
  }
  window.localStorage.removeItem(INDEX_STORAGE_KEY);
}
