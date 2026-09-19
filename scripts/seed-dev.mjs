// Explicit, local-only fixtures. This script never connects to remote D1.
import {getPlatformProxy} from 'wrangler';
import bcrypt from 'bcryptjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes,randomUUID} from 'node:crypto';
const proxy=await getPlatformProxy();
try{
 if(proxy.env.APP_ENV!=='development')throw new Error('Seed permitido somente no ambiente development local.');
 const password=randomBytes(18).toString('base64url'),hash=await bcrypt.hash(password,12),at=new Date().toISOString(),accounts=[];
 for(const role of ['generator','cooperative','collector','admin']){
  const email=`qa-${role}@reciclamapa.invalid`,existing=await proxy.env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first();
  const id=existing?.id??randomUUID();
  await proxy.env.DB.batch([proxy.env.DB.prepare('INSERT INTO users(id,name,email,password_hash,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash').bind(id,`Perfil fictício QA ${role}`,email,hash,role,at,at),proxy.env.DB.prepare('INSERT INTO profiles(id,user_id,city,state,neighborhood,profile_type,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(randomUUID(),id,'Fortaleza','CE','Centro',role,at)]);
  accounts.push({role,email,id});
 }
 await mkdir('.wrangler',{recursive:true});await writeFile('.wrangler/dev-credentials.json',JSON.stringify({password,accounts},null,2));
 console.log('Quatro contas fictícias criadas no D1 local. Credenciais em .wrangler/dev-credentials.json (ignorado pelo Git). Nenhum seed remoto foi executado.');
}finally{await proxy.dispose();}
