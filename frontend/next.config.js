/** @type {import('next').NextConfig} */
// The frontend calls a relative `/api`. It is proxied to the backend by a
// runtime route handler at src/app/api/[...path]/route.ts (NOT a next.config
// rewrite): `rewrites()` is evaluated at `next build` time and baked into the
// routes manifest, so it would freeze in the wrong BACKEND_URL when that value
// is only known at deploy time (e.g. on Render, set after the first deploy).
const nextConfig = {};

module.exports = nextConfig;
