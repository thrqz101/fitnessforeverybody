/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/preview/landing", destination: "/", permanent: false },
      { source: "/preview/scroll", destination: "/", permanent: false },
      { source: "/preview/workspace", destination: "/workspace", permanent: false }
    ];
  }
};

export default nextConfig;
