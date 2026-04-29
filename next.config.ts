import { EventEmitter } from "events";
EventEmitter.defaultMaxListeners = 20;
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
        port: "",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Aumenta el límite a 100MB para archivos grandes
      bodySizeLimit: "100mb",
    },
    // Optimizaciones para archivos grandes
    largePageDataBytes: 512 * 1000, // 512KB
  },
  // Aumentar timeout para operaciones largas
  staticPageGenerationTimeout: 180,
  // Compresión para respuestas grandes
  compress: true,
};

export default nextConfig;