export function validCep(value:string){return /^\d{8}$/.test(value);}
export function normalizeCep(value:string){const cleaned=value.trim().replace(/^(\d{5})-(\d{3})$/,'$1$2');return validCep(cleaned)?cleaned:null;}
export async function lookupCep(cep:string,fetcher:typeof fetch=fetch){
 if(!validCep(cep))throw new Error('Informe um CEP com 8 dígitos.');
 const response=await fetcher(`https://viacep.com.br/ws/${cep}/json/`,{signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw new Error('Não foi possível consultar o serviço agora. Preencha o endereço manualmente.');
 const data=await response.json();if(data.erro)return null;
 if(typeof data.localidade!=='string'||typeof data.uf!=='string')throw new Error('Resposta de CEP inválida. Preencha manualmente.');
 return {cep,logradouro:String(data.logradouro??''),bairro:String(data.bairro??''),cidade:data.localidade as string,estado:data.uf as string};
}
