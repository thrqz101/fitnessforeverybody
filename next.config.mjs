/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      "/api/food-ai": ["./data/nutrition-100g.json"],
      "/api/nutrition-agent": ["./data/nutrition-100g.json"]
    }
  },
  async redirects() {
    return [
      { source: "/preview/landing", destination: "/", permanent: false },
      { source: "/preview/scroll", destination: "/", permanent: false },
      { source: "/preview/workspace", destination: "/workspace", permanent: false }
    ];
  }
};

export default nextConfig;
