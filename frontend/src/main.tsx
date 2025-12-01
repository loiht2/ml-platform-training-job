import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App";
import "./app/globals.css";

// Kubeflow serves apps under /<app-name> path (not /_/)
const basename = "/training-job";

// Redirect direct access to iframe URLs
// If accessed directly (not in iframe), redirect to centraldashboard iframe URL
function checkAndRedirect() {
  const currentPath = window.location.pathname;
  const search = window.location.search;
  
  // Check if we're in an iframe by looking at parent window
  const isInIframe = window.self !== window.top;
  
  // If NOT in iframe and accessed via /training-job/* (not /_/training-job/*)
  if (!isInIframe && currentPath.startsWith('/training-job/') && !currentPath.startsWith('/_/training-job/')) {
    // Get the path after /training-job/
    const subPath = currentPath.substring('/training-job'.length);
    
    // Get namespace from URL or use default
    const params = new URLSearchParams(search);
    const namespace = params.get('ns') || 'kubeflow-user-example-com';
    
    // Redirect to centraldashboard iframe URL
    const iframeUrl = `/_/training-job${subPath}?ns=${namespace}`;
    window.location.href = iframeUrl;
    return true; // Prevent rendering
  }
  
  return false; // Continue rendering
}

// Check for redirect before rendering
if (!checkAndRedirect()) {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </StrictMode>
  );
}
