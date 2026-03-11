import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n

// Block access via the public lovable.app URL — only custom domains and dev environments allowed
const hostname = window.location.hostname;
const isLovablePublic = hostname.endsWith('.lovable.app');
const isDevEnvironment = hostname === 'localhost' || hostname.includes('lovableproject.com');

if (isLovablePublic && !isDevEnvironment) {
  document.getElementById("root")!.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:2rem;">
      <div>
        <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">Accès non autorisé</h1>
        <p style="color:#888;font-size:0.95rem;">Cette application n'est pas accessible via cette URL.</p>
      </div>
    </div>
  `;
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
