import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",

  turbopack: {
    root: projectRoot,
  },

  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.18.6",
    "192.168.0.106",
  ],
};

export default nextConfig;
