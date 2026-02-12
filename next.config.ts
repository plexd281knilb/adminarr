import type { NextConfig } from "next";
import { networkInterfaces } from "os";

// --- HELPER: AUTO-DETECT LOCAL IPS ---
// This function finds every IP address this server has (192.168.x.x, 10.x.x.x, etc.)
function getLocalIps() {
  const nets = networkInterfaces();
  const results: string[] = ["localhost:3000", "127.0.0.1:3000"]; // Always allow localhost

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      // Skip internal (non-IPv4) and non-local addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(`${net.address}:3000`); // Add IP with port 3000
      }
    }
  }
  return results;
}

const allowedOrigins = getLocalIps();
console.log("✅ Allowed Origins Auto-Detected:", allowedOrigins);

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true, 
    serverActions: {
      // Pass the auto-generated list here
      allowedOrigins: allowedOrigins,
    },
  },
};

export default nextConfig;