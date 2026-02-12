import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true, // <--- ENABLED (Required for Cron)
    serverActions: {
      // <--- ADDED (Required to fix "Cross origin" warning)
      allowedOrigins: [
        "192.168.1.87:3033", 
        "192.168.1.219:3033", 
        "localhost:3033",
        "192.168.1.87:3001", 
        "192.168.1.219:3001", 
        "localhost:3001",
        "192.168.1.87:3000", 
        "192.168.1.219:3000", 
        "localhost:3000"
      ],
    },
  },
};

export default nextConfig;