import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Only Athena's own bundled files may load: no remote scripts, no inline
// code, no network requests. The camera stream is attached with srcObject,
// which CSP doesn't restrict.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

// Added to the built index.html only. The dev server needs inline scripts and
// a websocket for hot reload, which this policy would block.
function contentSecurityPolicy() {
  return {
    name: "athena-csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: {
          "http-equiv": "Content-Security-Policy",
          content: CONTENT_SECURITY_POLICY,
        },
        injectTo: "head-prepend",
      },
    ],
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  // Relative asset paths so the build loads from file:// inside Electron.
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
