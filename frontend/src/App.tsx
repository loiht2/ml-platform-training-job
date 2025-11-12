import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

// Lazy load page components for code splitting
const CreateTrainingJobPage = lazy(() => import("./pages/CreateTrainingJobPage"));
const TrainingJobsListPage = lazy(() => import("./pages/TrainingJobsListPage"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="mt-4 text-slate-600">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<TrainingJobsListPage />} />
        <Route path="/create" element={<CreateTrainingJobPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
