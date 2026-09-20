import {lookupCep,normalizeCep} from '../cep';
import {sharedProviderCall} from './provider-cache';
import {HttpError} from './security';
export async function cepAddress(input:string){
 const cep=normalizeCep(input);if(!cep)throw new HttpError(400,'Informe um CEP com 8 dígitos.');
 try{const value=await sharedProviderCall('viacep',cep,86400000,()=>lookupCep(cep));if(!value)throw new HttpError(404,'CEP não encontrado. Confira ou preencha o endereço manualmente.');return value;}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'Não foi possível consultar o CEP. Preencha o endereço manualmente.');}
}
