import type { NextConfig } from "next";

// The staff website (NEXT_PUBLIC_SITE=staff) has no public front page: it opens on sign-in.
const staff = process.env.NEXT_PUBLIC_SITE === "staff" && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // A separate build folder lets the tests build the three websites side by side.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return staff ? [{ source: "/", destination: "/login", permanent: false }] : [];
  },
};

export default nextConfig;
