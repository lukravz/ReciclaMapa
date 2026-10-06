import {eq,and,sql,desc} from 'drizzle-orm';
import {ZodError} from 'zod';
import {database} from '@/db';
import {cooperatives,wastePoints,stopResults} from '@/db/schema';
import {registerSchema,loginSchema} from './schemas';
import {bodyJson,checkOrigin,limit,sessionUser,requireUser,publicUser,register,login,logout,createSession,sessionCookie,HttpError} from './security';
import {listWaste,getWaste,serializeWaste,createWaste,editWaste,reserveWaste,scheduleWaste,cancelWaste,saveCooperative,getCooperative,getProfile,releaseWaste,runningPointIds,confirmWaste} from './waste-service';
import {createRoute,listRoutes,scheduleRoute,changeRouteStatus,collect,recordStopResult,finishRoute,removeRouteStop,reviewRoute} from './route-service';
import {impact,generationHistory,addInterview,validationReport,adminReport} from './report-service';
import {importLegacy,importedArchives} from './import-service';
import {listNotifications,readNotification} from './notification-service';
import {cepAddress} from './cep-service';
import {intelligence} from './intelligence-service';
import {defaultValidity} from '../collection-reliability';
import {getAccount,editProfile,savePreferences,changePassword} from './account-service';
import {planAccess,requireFeature} from './plan-service';
import {organizationExport,organizationProductivity} from './export-service';
import {ProviderError} from './providers';
export async function dispatch(request:Request,path:string[]){
 const headers=new Headers({'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'});
 try{
 const {db,env}=await database();checkOrigin(request,env);
 const method=request.method,key=path.join('/'),url=new URL(request.url),ip=request.headers.get('cf-connecting-ip')??'local';
 if(env.DEMO_MODE==='true')throw new HttpError(403,'Este ambiente é somente demonstrativo. Contas e dados reais estão desativados.');
 if(key==='config'&&method==='GET')return Response.json({defaultValidityDays:defaultValidity(env.DEFAULT_AVAILABILITY_DAYS)},{headers});
 if(key==='auth/register'&&method==='POST'){await limit(db,'register:'+ip,10,3600);const user=await register(db,registerSchema.parse(await bodyJson(request)));headers.set('Set-Cookie',sessionCookie(await createSession(db,user.id,user.passwordHash),request));return Response.json({user:publicUser(user)},{status:201,headers});}
 if(key==='auth/login'&&method==='POST'){await limit(db,'login:'+ip,20,900);const d=loginSchema.parse(await bodyJson(request));await limit(db,'login-email:'+d.email,10,900);const user=await login(db,d.email,d.password);headers.set('Set-Cookie',sessionCookie(await createSession(db,user.id,user.passwordHash),request));return Response.json({user:publicUser(user)},{headers});}
 if(key==='auth/logout'&&method==='POST'){await logout(db,request);headers.set('Set-Cookie',sessionCookie('',request,true));return Response.json({ok:true},{headers});}
 const user=await sessionUser(db,request);
 if(key==='auth/session'&&method==='GET')return Response.json({user:user?publicUser(user):null,profile:user?await getProfile(db,user):null},{headers});
 await limit(db,`api:${user?.id??ip}`,method==='GET'?240:60,60);
 let result:unknown;
 if(key==='account'&&method==='GET')result=await getAccount(db,requireUser(user));
 else if(key==='account/profile'&&method==='PATCH')result=await editProfile(db,requireUser(user),await bodyJson(request));
 else if(key==='account/preferences'&&method==='PATCH')result=await savePreferences(db,requireUser(user),await bodyJson(request));
 else if(key==='account/password'&&method==='POST'){const actor=requireUser(user);await limit(db,'password:'+actor.id,5,900);result=await changePassword(db,actor,await bodyJson(request));headers.set('Set-Cookie',sessionCookie('',request,true));}
 else if(key==='plans'&&method==='GET')result=await planAccess(db,requireUser(user));
 else if(key==='reports/productivity'&&method==='GET'){const actor=requireUser(user,['collector','cooperative']);await requireFeature(db,actor,'productivity');result=await organizationProductivity(db,actor,url.searchParams.get('period')??'all');}
 else if(key==='reports/export'&&method==='GET'){const actor=requireUser(user,['collector','cooperative']);await requireFeature(db,actor,'exports');headers.set('Content-Type','text/csv; charset=utf-8');headers.set('Content-Disposition','attachment; filename="reciclamapa-organizacao.csv"');return new Response(await organizationExport(db,actor,url.searchParams.get('period')??'all'),{headers});}
 else
 if(path[0]==='cep'&&path.length===2&&method==='GET')result=await cepAddress(path[1]);
 else if(key==='intelligence'&&method==='GET')result=await intelligence(db,requireUser(user));
 else if(key==='notifications'&&method==='GET')result=await listNotifications(db,requireUser(user));
 else if(key==='notifications/read-all'&&method==='POST')result=await readNotification(db,requireUser(user));
 else if(path[0]==='notifications'&&path.length===3&&path[2]==='read'&&method==='POST')result=await readNotification(db,requireUser(user),path[1]);
 else if(path[0]==='waste'){
  if(path.length===1&&method==='GET')result=await listWaste(db,user,url.searchParams);
  else if(path.length===1&&method==='POST')result=await createWaste(db,requireUser(user),await bodyJson(request),defaultValidity(env.DEFAULT_AVAILABILITY_DAYS));
  else if(path.length===2&&method==='GET'){const p=await getWaste(db,path[1]),c=user?await getCooperative(db,user):null;if(p.status!=='available'&&p.generatorUserId!==user?.id&&p.reservedBy!==c?.id&&user?.role!=='admin')throw new HttpError(404,'Resíduo não encontrado.');result={...serializeWaste(p,user,c?.id),inProgress:(await runningPointIds(db)).has(p.id),results:user&&(p.generatorUserId===user.id||p.reservedBy===c?.id||user.role==='admin')?await db.select().from(stopResults).where(and(eq(stopResults.wastePointId,p.id),...(p.generatorUserId===user.id||user.role==='admin'?[]:[eq(stopResults.cooperativeId,c!.id)]))).orderBy(desc(stopResults.createdAt)):[]};}
  else if(path.length===3&&method==='POST'&&path[2]==='confirm')result=await confirmWaste(db,requireUser(user),path[1],await bodyJson(request));
  else if(path.length===3&&method==='POST'&&path[2]==='result')result=await recordStopResult(db,requireUser(user),path[1],await bodyJson(request));
  else if(path.length===2&&method==='PATCH')result=await editWaste(db,requireUser(user),path[1],await bodyJson(request));
  else if(path.length===2&&method==='DELETE')result=await cancelWaste(db,requireUser(user),path[1]);
  else if(path.length===3&&method==='POST'&&path[2]==='release')result=await releaseWaste(db,requireUser(user),path[1]);
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
  else if(path.length===5&&path[2]==='stops'&&path[4]==='result'&&method==='POST')result=await recordStopResult(db,actor,path[3],await bodyJson(request),path[1]);
  else if(path.length===4&&path[2]==='stops'&&method==='DELETE')result=await removeRouteStop(db,actor,path[1],path[3]);
  else if(path.length===3&&path[2]==='finish'&&method==='POST')result=await finishRoute(db,actor,path[1],await bodyJson(request));
  else if(path.length===3&&path[2]==='review'&&method==='POST')result=await reviewRoute(db,actor,path[1]);
  else if(path.length===3&&method==='POST'&&path[2]==='schedule')result=await scheduleRoute(db,actor,path[1],await bodyJson(request));
  else if(path.length===3&&method==='POST'&&path[2]==='collect')result=await collect(db,actor,await bodyJson(request),path[1]);
  else if(path.length===3&&method==='POST'&&(path[2]==='start'||path[2]==='cancel'))result=await changeRouteStatus(db,actor,path[1],path[2]);else throw new HttpError(405,'Operação não disponível.');
 }else if(key==='impact'&&method==='GET')result=await impact(db,requireUser(user),url.searchParams.get('period')??'all');
 else if(key==='history'&&method==='GET'){const actor=requireUser(user),access=await planAccess(db,actor),history=await generationHistory(db,actor);result=history.map(h=>access.features.forecasts?h:{...h,weighted:null,next:null,trend:null});}
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
