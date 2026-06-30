import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// Sentry source maps upload :
//   - Activé uniquement si SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT
//     sont définis en environnement (typiquement via Vercel build env).
//   - Sinon, no-op → ne casse jamais le build local ni un build sans secrets.
const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const SENTRY_ORG = process.env.SENTRY_ORG;
const SENTRY_PROJECT = process.env.SENTRY_PROJECT;
const enableSentrySourceMaps = !!(SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    ...(enableSentrySourceMaps
      ? [
          sentryVitePlugin({
            authToken: SENTRY_AUTH_TOKEN,
            org: SENTRY_ORG,
            project: SENTRY_PROJECT,
            // Pas de telemetry parasite Sentry vers leurs serveurs build-side
            telemetry: false,
            sourcemaps: {
              // On upload puis on supprime les .map du build final pour ne
              // jamais exposer le source côté client.
              filesToDeleteAfterUpload: ["./dist/**/*.map"],
            },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Source maps nécessaires pour que Sentry symbolique les stacks.
    // Sans `enableSentrySourceMaps`, on garde "hidden" → le browser ne charge
    // pas les maps mais elles existent localement (pas servies en prod).
    sourcemap: enableSentrySourceMaps ? true : "hidden",
    minify: "esbuild",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip"],
          charts: ["recharts"],
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
