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
  const proxyTarget = env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";
  const cfTunnel = env.VITE_CLOUDFLARE_TUNNEL === "1";
  const tunnelHost = (env.VITE_TUNNEL_PUBLIC_HOST || "").trim().replace(/^https?:\/\//i, "").split("/")[0] || "";
  const extraAllowedHosts = (env.VITE_EXTRA_ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

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
    preview: {
      // `vite preview` does not inherit `server.proxy`; without this, /api hits the static server and breaks Docker + Telegram WebView.
      proxy: apiProxy,
    },
    server: {
      port: 5173,
      // Tunnel / LAN: listen on all interfaces. Pure local: localhost only.
      host: cfTunnel ? true : "localhost",
      strictPort: true,
      // Quick tunnels use a new subdomain each run — `true` allows any Host (dev only).
      allowedHosts: cfTunnel ? true : [...defaultAllowedHosts, ...extraAllowedHosts],
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
