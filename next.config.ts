import type { NextConfig } from "next";
const pages = process.env.GITHUB_PAGES === "true";
const config: NextConfig = {
  turbopack: { root: process.cwd() },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  ...(pages ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {}),
};
export default config;
