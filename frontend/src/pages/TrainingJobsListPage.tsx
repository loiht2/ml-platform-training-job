import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loadJobs } from "@/lib/jobs-storage";
import type { JobStatus, StoredJob } from "@/types/training-job";

const JOB_STATUSES = new Set<JobStatus>(["Pending", "Running", "Succeeded", "Failed"]);

function formatTimestamp(ts: number) {
  return new Date(ts).toLocaleString();
}

function CreateButton() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  const href = qs ? `/create?${qs}` : "/create";
  return (
    <Button asChild size="lg">
      <Link to={href}>Create Training Job</Link>
    </Button>
  );
}

export default function TrainingJobsListPage() {
  const [jobs, setJobs] = useState<StoredJob[]>([]);

  useEffect(() => {
    let ignore = false;
    let timer: number | undefined;

    async function load() {
      try {
        const data = await loadJobs();
        if (!ignore) {
          const parsed = data.filter((item): item is StoredJob => {
            if (!item || typeof item !== "object") return false;
            const maybe = item as Partial<StoredJob>;
            return (
              typeof maybe.id === "string" &&
              typeof maybe.algorithm === "string" &&
              typeof maybe.createdAt === "number" &&
              typeof maybe.priority === "number" &&
              typeof maybe.status === "string" &&
              JOB_STATUSES.has(maybe.status as JobStatus)
            );
          });
          setJobs(parsed);
        }
      } catch (error) {
        console.error("Failed to load jobs", error);
        if (!ignore) setJobs([]);
      }
    }

    load();
    timer = window.setInterval(load, 5000);

    return () => {
      ignore = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!jobs.length) return;
    const interval = window.setInterval(() => {
      setJobs((prev) =>
        prev.map((job) => {
          if (job.status === "Pending" && job.pendingUntil && Date.now() >= job.pendingUntil) {
            return { ...job, status: "Running" as JobStatus, pendingUntil: undefined };
          }
          return job;
        })
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, [jobs.length]);

  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => b.createdAt - a.createdAt), [jobs]);

  return (
    <div className="min-h-screen bg-white">
      {/* Modern Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Training Jobs</h1>
              <p className="mt-2 text-lg text-slate-600">Monitor your ML training jobs and track their progress</p>
            </div>
            <CreateButton />
          </div>
          
          {/* Stats Bar */}
          {sortedJobs.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-600">Total Jobs</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{sortedJobs.length}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-700">Succeeded</p>
                <p className="mt-1 text-2xl font-bold text-emerald-900">
                  {sortedJobs.filter((j) => j.status === "Succeeded").length}
                </p>
              </div>
              <div className="rounded-lg bg-blue-50 px-4 py-3">
                <p className="text-sm text-blue-700">Running</p>
                <p className="mt-1 text-2xl font-bold text-blue-900">
                  {sortedJobs.filter((j) => j.status === "Running").length}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-700">Pending</p>
                <p className="mt-1 text-2xl font-bold text-amber-900">
                  {sortedJobs.filter((j) => j.status === "Pending").length}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        {sortedJobs.length === 0 ? (
          <Card className="border-2 border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                <span className="text-3xl text-slate-400">+</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No jobs yet</h3>
              <p className="text-slate-600 mb-6 max-w-md">
                Get started by creating your first training job. Click the button above to configure and submit a new job.
              </p>
              <CreateButton />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedJobs.map((job) => (
              <Card key={job.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left Side - Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 truncate">{job.id}</h3>
                        <Badge
                          variant={
                            job.status === "Succeeded"
                              ? "secondary"
                              : job.status === "Running"
                              ? "default"
                              : job.status === "Pending"
                              ? "outline"
                              : "destructive"
                          }
                          className="flex-shrink-0"
                        >
                          {job.status === "Succeeded" && <span className="mr-1">✓</span>}
                          {job.status === "Running" && <span className="mr-1">●</span>}
                          {job.status === "Failed" && <span className="mr-1">✕</span>}
                          {job.status === "Pending" && <span className="mr-1">○</span>}
                          {job.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Algorithm:</span> {job.algorithm}
                      </p>
                    </div>
                    
                    {/* Right Side - Meta Info */}
                    <div className="flex flex-wrap gap-6 text-sm">
                      <div>
                        <p className="text-slate-500 mb-1">Created</p>
                        <p className="font-medium text-slate-900">{formatTimestamp(job.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 mb-1">Priority</p>
                        <p className="font-medium text-slate-900">{job.priority}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
