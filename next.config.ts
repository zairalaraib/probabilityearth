import type { NextConfig } from "next";
const pages = process.env.GITHUB_PAGES === "true";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  ...(pages ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {
    async rewrites() { return [{ source: "/api/earth/:path*", destination: "http://127.0.0.1:4001/:path*" }]; }
  }),
};
export default config;
