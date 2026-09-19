import { getCloudflareContext } from '@opennextjs/cloudflare';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
export async function database(){
 const {env}=await getCloudflareContext({async:true});
 if(!env.DB)throw new Error('D1 não configurado. Aplique as migrations locais.');
 return {db:drizzle(env.DB,{schema}),env};
}
export type Database=Awaited<ReturnType<typeof database>>['db'];
