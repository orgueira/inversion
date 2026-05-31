/** @type {import('next').NextConfig} */
const nextConfig = {
  // En producción en Vercel, la API_KEY se configura como variable de entorno
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  // Permitir imágenes externas si es necesario
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;