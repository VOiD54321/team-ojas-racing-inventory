/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the development server to serve HMR/dev resources when opened
  // from another device on the local network.
  allowedDevOrigins: ['192.168.137.1'],
};

module.exports = nextConfig;
