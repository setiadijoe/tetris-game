import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const { VITE_API_BASE_URL: apiBaseUrl } = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      proxy: apiBaseUrl
        ? {
            "/api": {
              target: apiBaseUrl,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  };
});
