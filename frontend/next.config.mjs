/** @type {import('next').NextConfig} */

function resolveApiProxyTarget() {
  const fromEnv = (
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!fromEnv) return "https://pocketa.onrender.com";
  if (fromEnv.includes("localhost") || fromEnv.includes("127.0.0.1")) {
    return "";
  }
  return fromEnv;
}

const apiProxyTarget = resolveApiProxyTarget();

const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    // Browser → same origin /api/* → Render. Makes auth cookies first-party
    // (required for mobile Safari / Chrome third-party cookie blocking).
    if (!apiProxyTarget) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
