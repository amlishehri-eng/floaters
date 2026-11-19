/** @type {import('next').NextConfig} */
const nextConfig = {
  // cacheComponents is off on purpose: no Suspense/caching build errors in a 24h build.
  // partialPrefetching requires cacheComponents, so it's off too.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
