import {eq,and,sql} from 'drizzle-orm';
import {ZodError} from 'zod';
import {database} from '@/db';
import {cooperatives,wastePoints} from '@/db/schema';
import {registerSchema,loginSchema} from './schemas';
import {bodyJson,checkOrigin,limit,sessionUser,requireUser,publicUser,register,login,logout,createSession,sessionCookie,HttpError} from './security';
import {listWaste,getWaste,serializeWaste,createWaste,editWaste,reserveWaste,scheduleWaste,cancelWaste,saveCooperative,getCooperative,getProfile} from './waste-service';
import {createRoute,listRoutes,scheduleRoute,changeRouteStatus,collect} from './route-service';
import {impact,generationHistory,addInterview,validationReport,adminReport} from './report-service';
import {importLegacy,importedArchives} from './import-service';
import {ProviderError} from './providers';
export async function dispatch(request:Request,path:string[]){
 const headers=new Headers({'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'});
 try{
 const {db,env}=await database();checkOrigin(request,env);
 const method=request.method,key=path.join('/'),url=new URL(request.url),ip=request.headers.get('cf-connecting-ip')??'local';
 if(env.DEMO_MODE==='true')throw new HttpError(403,'Este ambiente é somente demonstrativo. Contas e dados reais estão desativados.');
 if(key==='auth/register'&&method==='POST'){await limit(db,'register:'+ip,10,3600);const user=await register(db,registerSchema.parse(await bodyJson(request)));headers.set('Set-Cookie',sessionCookie(await createSession(db,user.id),request));return Response.json({user:publicUser(user)},{status:201,headers});}
 if(key==='auth/login'&&method==='POST'){await limit(db,'login:'+ip,20,900);const d=loginSchema.parse(await bodyJson(request));await limit(db,'login-email:'+d.email,10,900);const user=await login(db,d.email,d.password);headers.set('Set-Cookie',sessionCookie(await createSession(db,user.id),request));return Response.json({user:publicUser(user)},{headers});}
 if(key==='auth/logout'&&method==='POST'){await logout(db,request);headers.set('Set-Cookie',sessionCookie('',request,true));return Response.json({ok:true},{headers});}
 const user=await sessionUser(db,request);
 if(key==='auth/session'&&method==='GET')return Response.json({user:user?publicUser(user):null,profile:user?await getProfile(db,user):null},{headers});
 await limit(db,`api:${user?.id??ip}`,method==='GET'?240:60,60);
 let result:unknown;
 if(path[0]==='waste'){
  if(path.length===1&&method==='GET')result=await listWaste(db,user,url.searchParams);
  else if(path.length===1&&method==='POST')result=await createWaste(db,requireUser(user),await bodyJson(request));
  else if(path.length===2&&method==='GET'){const p=await getWaste(db,path[1]),c=user?await getCooperative(db,user):null;if(p.status!=='available'&&p.generatorUserId!==user?.id&&p.reservedBy!==c?.id&&user?.role!=='admin')throw new HttpError(404,'Resíduo não encontrado.');result=serializeWaste(p,user,c?.id);}
  else if(path.length===2&&method==='PATCH')result=await editWaste(db,requireUser(user),path[1],await bodyJson(request));
  else if(path.length===2&&method==='DELETE')result=await cancelWaste(db,requireUser(user),path[1]);
  else if(path.length===3&&method==='POST'&&path[2]==='reserve')result=await reserveWaste(db,requireUser(user),path[1]);
  else if(path.length===3&&method==='POST'&&path[2]==='schedule')result=await scheduleWaste(db,requireUser(user),path[1],await bodyJson(request));
  else if(path.length===3&&method==='POST'&&path[2]==='collect')result=await collect(db,requireUser(user),await bodyJson(request),undefined,path[1]);
  else throw new HttpError(405,'Operação não disponível.');
 }else if(key==='cooperatives'){
  if(method==='GET')result=url.searchParams.get('mine')==='true'?await getCooperative(db,requireUser(user)):await db.select({id:cooperatives.id,name:cooperatives.name,city:cooperatives.city,state:cooperatives.state,radiusKm:cooperatives.radiusKm}).from(cooperatives).where(eq(cooperatives.active,true));
  else if(method==='POST'||method==='PATCH')result=await saveCooperative(db,requireUser(user),await bodyJson(request));else throw new HttpError(405,'Operação não disponível.');
 }else if(path[0]==='routes'){
  const actor=requireUser(user,['cooperative','collector','admin']);
  if(path.length===1&&method==='GET')result=await listRoutes(db,actor);
  else if(path.length===1&&method==='POST')result=await createRoute(db,actor,await bodyJson(request));
  else if(path.length===3&&method==='POST'&&path[2]==='schedule')result=await scheduleRoute(db,actor,path[1],await bodyJson(request));
  else if(path.length===3&&method==='POST'&&path[2]==='collect')result=await collect(db,actor,await bodyJson(request),path[1]);
  else if(path.length===3&&method==='POST'&&(path[2]==='start'||path[2]==='cancel'))result=await changeRouteStatus(db,actor,path[1],path[2]);else throw new HttpError(405,'Operação não disponível.');
 }else if(key==='impact'&&method==='GET')result=await impact(db,requireUser(user),url.searchParams.get('period')??'all');
 else if(key==='history'&&method==='GET')result=await generationHistory(db,requireUser(user));
 else if(key==='validation'&&method==='GET')result=await validationReport(db,requireUser(user));
 else if(key==='validation'&&method==='POST')result=await addInterview(db,requireUser(user),await bodyJson(request));
 else if(key==='admin'&&method==='GET')result=await adminReport(db,requireUser(user));
 else if(key==='import'&&method==='POST')result=await importLegacy(db,requireUser(user),await bodyJson(request));
 else if(key==='import'&&method==='GET')result=await importedArchives(db,requireUser(user));
 else throw new HttpError(404,'Endpoint não encontrado.');
 return Response.json(result,{headers});
 }catch(error){
  const status=error instanceof HttpError||error instanceof ProviderError?error.status:error instanceof ZodError?400:500;
  const message=error instanceof HttpError||error instanceof ProviderError?error.message:error instanceof ZodError?'Confira os campos: '+error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).slice(0,4).join('; '):'Não foi possível concluir a operação. Confira a configuração do banco e tente novamente.';
  if(status===500)console.error('ReciclaMapa API: falha interna',error instanceof Error?error.name:'Unknown');
  return Response.json({error:message},{status,headers});
 }
}
