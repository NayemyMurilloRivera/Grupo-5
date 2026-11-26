export const API_URL = import.meta.env?.VITE_API_URL ?? '/api/v1'
export class ApiError extends Error { constructor(public status:number, message:string) { super(message) } }
export async function request<T=unknown>(path:string, options:{method?:string;body?:unknown;token?:string;signal?:AbortSignal}={}):Promise<T> {
 const response=await fetch(API_URL+path,{ method:options.method??'GET', headers:{ 'Content-Type':'application/json', ...(options.token?{Authorization:'Bearer '+options.token}:{}) }, ...(options.body!==undefined?{body:JSON.stringify(options.body)}:{}),signal:options.signal })
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new ApiError(response.status, data?.error?.mensaje??data?.message??'Servicio no disponible')
 return data as T
}
export async function downloadFile(path:string,filename:string,token:string){
 const response=await fetch(API_URL+path,{headers:{Authorization:'Bearer '+token}})
 if(!response.ok){const data=await response.json().catch(()=>null);throw new ApiError(response.status,data?.error?.mensaje??'No se pudo descargar el reporte')}
 if(!response.headers.get('content-type')?.includes('text/csv'))throw new Error('La API todavía no devuelve un archivo CSV')
 const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

