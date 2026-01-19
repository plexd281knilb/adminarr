import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // experimental: {             <-- REMOVE THIS SECTION
  //   instrumentationHook: true, 
  // },
};

export default nextConfig;