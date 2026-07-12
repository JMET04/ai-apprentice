/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingExcludes: {
    "*": ["./artifacts/productization/runtime/**/*"]
  }
};

export default nextConfig;
