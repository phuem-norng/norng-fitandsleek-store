import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/** Local-only dev server vs Cloudflare Tunnel (or any public hostname → this machine). */
const defaultAllowedHosts = [
  // Without these, Vite responds 403 to the document and /favicon.ico on typical local URLs.
  "localhost",
  "127.0.0.1",
  "[::1]",
  "gluten-judge-remedial.ngrok-free.dev",
  ".ngrok-free.dev",
  ".ngrok-free.app",
  ".trycloudflare.com",
  "fitandsleek.kalapak-team.space",
  "fitandsleekapp.kalapak-team.space",
  "app.fitandsleek.phuemnorng-kalapakteam.space",
  ".phuemnorng-kalapakteam.space",
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Default matches repo `docker-compose.yml`: backend published as host:8001 → container:8000.
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:8001";
  const cfTunnel = env.VITE_CLOUDFLARE_TUNNEL === "1";
  const tunnelHost = (env.VITE_TUNNEL_PUBLIC_HOST || "").trim().replace(/^https?:\/\//i, "").split("/")[0] || "";
  const extraAllowedHosts = (env.VITE_EXTRA_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  // Any Host not in the list → Vite 403 for `/`, `/favicon.ico`, etc. Default: allow all in dev.
  // Set VITE_STRICT_DEV_HOSTS=1 to use defaultAllowedHosts + VITE_EXTRA_ALLOWED_HOSTS only.
  const strictDevHosts = env.VITE_STRICT_DEV_HOSTS === "1";
  const devAllowedHosts = strictDevHosts ? [...defaultAllowedHosts, ...extraAllowedHosts] : true;

  const apiProxy = {
    "/api": {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    },
    "/sanctum": {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    },
    "/storage": {
      target: proxyTarget,
      changeOrigin: true,
      secure: false,
    },
  };

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      sourcemap: mode !== "production",
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (id.includes("recharts")) return "recharts";
            if (id.includes("html5-qrcode")) return "html5-qrcode";
            if (id.includes("@radix-ui") || id.includes("framer-motion")) return "ui-vendor";
            return "vendor";
          },
        },
      },
    },
    preview: {
      // `vite preview` does not inherit `server.*`; set proxy + allowedHosts here too.
      proxy: apiProxy,
      allowedHosts: devAllowedHosts,
    },
    server: {
      port: 5173,
      // Tunnel / LAN: listen on all interfaces. Pure local: localhost only.
      host: cfTunnel ? true : "localhost",
      strictPort: true,
      // Tunnel: any host. Otherwise see `devAllowedHosts` (default true = no 403 on unknown Host).
      allowedHosts: cfTunnel ? true : devAllowedHosts,
      hmr:
        cfTunnel && tunnelHost
          ? {
              host: tunnelHost,
              protocol: "wss",
              clientPort: 443,
            }
          : {
              host: "localhost",
              port: 5173,
              protocol: "ws",
            },
      proxy: apiProxy,
    },
  };
});
