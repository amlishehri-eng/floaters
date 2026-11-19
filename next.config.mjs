/** @type {import('next').NextConfig} */
const nextConfig = {
  // autopush.sh builds into .next-autosync so it never touches the .next of a running `npm run dev`.
  distDir: process.env.NEXT_BUILD_DIR || ".next",
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
