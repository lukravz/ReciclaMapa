import type { NextConfig } from 'next';
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';
if (process.env.NODE_ENV === 'development') initOpenNextCloudflareForDev();
const config: NextConfig = { outputFileTracingRoot: process.cwd(), allowedDevOrigins: ['127.0.0.1', 'localhost'] };
export default config;
