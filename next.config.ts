import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.18.6",
    "192.168.0.106",
  ],
};

export default nextConfig;
