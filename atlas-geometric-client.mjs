// Bounded result cache. Each active job owns its Worker and can be terminated.
export function createGeometricClient({feature,pairRelation,Worker:WorkerClass=globalThis.Worker,timeoutMs=120000,maxEntries=2}={}){
 const cache=new Map(),pending=new Map();let sequence=0,tail=Promise.resolve();
 function cancel(){for(const job of pending.values())job.abort();pending.clear();}
 async function run(operation,ids){
  const key=operation+'|'+ids.join('|');if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return {...value,cached:true};}if(pending.has(key))return pending.get(key).promise;
  let worker=null,timer=null,aborted=false,rejectJob;const previous=tail;
  const abort=()=>{aborted=true;clearTimeout(timer);worker?.terminate();rejectJob?.(Error('Calcul anulat'));};
  const promise=new Promise((resolve,reject)=>{rejectJob=reject;void (async()=>{
   try{await previous;if(aborted)return;const loading=performance.now(),features=await Promise.all(ids.map(feature)),topology=operation==='compare'&&pairRelation?await pairRelation(...ids):null;if(aborted)return;const loadMs=performance.now()-loading;
    worker=new WorkerClass(new URL('./atlas-geometric-worker.mjs',import.meta.url),{type:'module'});const id=++sequence,started=performance.now();
    timer=setTimeout(()=>{worker.terminate();reject(Error('Calcul indisponibil: limita de timp a fost depășită'));},timeoutMs);
    worker.onerror=()=>{clearTimeout(timer);worker.terminate();reject(Error('Calcul indisponibil: Worker GIS nu a putut fi executat'));};
    worker.onmessage=({data})=>{if(data.id!==id||aborted)return;clearTimeout(timer);worker.terminate();if(data.error){reject(Error(data.error));return;}if(topology&&topology.relation!==data.result.relation){reject(Error('Calcul indisponibil: relația diferă de indexul topologic verificat'));return;}const value={...data.result,...(topology?.relation==='boundary'?{commonFrontierMetres:topology.metres}:{}),timing:{loadMs,workerMs:performance.now()-started},features};cache.set(key,value);while(cache.size>maxEntries)cache.delete(cache.keys().next().value);resolve({...value,cached:false});};
    worker.postMessage({id,operation,a:features[0].geometry,b:features[1]?.geometry});
   }catch(error){clearTimeout(timer);worker?.terminate();reject(error);}
  })();});
  tail=promise.catch(()=>{});pending.set(key,{promise,abort});try{return await promise;}finally{if(pending.get(key)?.promise===promise)pending.delete(key);}
 }
 return {metrics:id=>run('metrics',[id]),peekMetrics:id=>cache.get('metrics|'+id)||null,compare:(a,b)=>run('compare',[a,b]),cancel,get cacheSize(){return cache.size;}};
}
