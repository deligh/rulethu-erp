import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export — the app is 100% client-side (localStorage), no server
  // APIs — so it can be hosted on any static host (Netlify, Cloudflare Pages…).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
