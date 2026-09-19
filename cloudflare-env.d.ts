import type { D1Database } from '@cloudflare/workers-types';
declare global {
 interface CloudflareEnv { DB:D1Database; APP_ENV:string; APP_ORIGIN?:string; DEMO_MODE?:string; }
}
export {};
