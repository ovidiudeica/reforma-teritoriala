// WEB-CARD.1: numai prezentare; identitățile și geometriile ACTUAL rămân imuabile.
export const cardAuditBinding=Object.freeze({snapshot:'actual-a9e5a4ddcb5277ef',fingerprint:'a9e5a4ddcb5277ef614858c477be42bf1fe32e2ab1ca214ccad94fb9f42a6446'});
export function cardAuditBucket(id){let hash=2166136261;for(const c of String(id))hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return String(hash%32).padStart(2,'0');}
export function publicOsmTags(tags){
 const allowed=/^(?:name(?::[a-z-]+)?|alt_name(?::[a-z-]+)?|official_name(?::[a-z-]+)?|short_name(?::[a-z-]+)?|full_name|admin_level|boundary|place|type|wikidata|wikipedia|ref:cuatm:(?:codunic|codstatistic|statut)|ref:siruta|ref:nuts(?::[123])?)$/;
 return Object.fromEntries(Object.entries(tags||{}).filter(([k,v])=>allowed.test(k)&&typeof v==='string'&&v.length<=2000).sort(([a],[b])=>a.localeCompare(b)));
}
const append=(doc,parent,tag,text,cls)=>{const el=doc.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;parent.appendChild(el);return el;};
const number=(v,unit)=>Number.isFinite(v)?new Intl.NumberFormat('ro-RO',{maximumFractionDigits:unit==='km²'?6:3}).format(v)+(unit?' '+unit:''):'Nedisponibil';
const table=(doc,parent,entries)=>{const dl=append(doc,parent,'dl',null,'kv');for(const [label,value] of entries){append(doc,dl,'dt',label);append(doc,dl,'dd',value==null||value===''?'Nedisponibil':value);}return dl;};
export function validateCardAudit(doc,entity,manifest){
 if(manifest?.snapshot_id!==cardAuditBinding.snapshot||manifest?.release_fingerprint_sha256!==cardAuditBinding.fingerprint)throw Error('Auditul nu corespunde snapshotului ACTUAL');
 if(doc?.schema!=='web-card-audit-v1'||doc.snapshot!==cardAuditBinding.snapshot||doc.fingerprint!==cardAuditBinding.fingerprint)throw Error('Contract de audit incompatibil');
 const row=doc.records?.[entity.id];if(!row||row.id!==entity.id||row.jurisdiction!==entity.jurisdiction)throw Error('Identitate de audit incompatibilă');
 if(row.legal_registry!==(entity.legal?.registry||null)||row.legal_id!==(entity.legal?.id||null))throw Error('Binding oficial diferit de contractul ACTUAL');
 return row;
}
export function createCardAudit({document,fetch,getManifest,getEntity}){
 const cache=new Map();
 async function read(entity){
  if(!['RO','MD'].includes(entity.jurisdiction)||!/^([a-z]+-[A-Za-z0-9-]+)$/.test(entity.id))throw Error('Identificator neacceptat');
  const path='public/data/web-card-audit/'+entity.jurisdiction.toLowerCase()+'-'+cardAuditBucket(entity.id)+'.json';
  if(!cache.has(path))cache.set(path,Promise.resolve().then(async()=>{const r=await fetch(path);if(!r.ok)throw Error('Datele de audit nu au putut fi încărcate');return r.json();}).catch(e=>{cache.delete(path);throw e;}));
  return validateCardAudit(await cache.get(path),entity,getManifest());
 }
 function render(container,entity){
  const panel=append(document,container,'details',null,'details-section atlas-panel-disclosure web-card-audit');panel.dataset.cardAudit=entity.id;
  const summary=append(document,panel,'summary');append(document,summary,'h3','Geometrie, OSMB și audit');
  const body=append(document,panel,'div',null,'atlas-disclosure-body');let started=false;
  panel.addEventListener('toggle',async()=>{
   if(!panel.open||started)return;started=true;body.setAttribute('aria-busy','true');
   const status=append(document,body,'p','Se încarcă dovezile geometrice…','muted');status.setAttribute('role','status');
   try{
    const row=await read(entity);if(!panel.isConnected)return;status.remove();
    const m=row.geometry;const parent=getEntity(row.geometric_parent_id);
    table(document,body,[['Tip geometric',m.geometry_type],['Suprafață',number(m.area_m2/1e6,'km²')],['Perimetru geodezic',number(m.perimeter_m,'m')],['Componente',m.components],['Goluri interioare',m.holes],['Validitate geometrică',m.valid?'Validă în auditul documentat':'Necesită revizuire'],['Părinte geometric / de reprezentare',parent?.display_name||row.geometric_parent_id||'Rădăcină / fără părinte'],['Conflict de apartenență',row.parent_conflict?'DA — părintele juridic rămâne cel din registrul oficial':row.skips_official_intermediate?'Reprezentarea omite un nivel oficial intermediar':'Niciun conflict de ascendență identificat în audit'],['Certificarea hotarului juridic','Neacordată prin acest audit']]);
    append(document,body,'p','Suprafață: proiecție egal-area EPSG:6933. Perimetru: geodezic WGS84. Afișarea este rotunjită; valorile de audit și reziduurile sunt păstrate integral. Componentele și golurile geometrice nu certifică exclave sau enclave juridice.','hint');
    const osm=append(document,body,'details',null,'atlas-panel-disclosure');append(document,osm,'summary','Metadate cartografice OSM / OSMB');
    table(document,osm,[['Relație OSM',row.osm_relation_id],['admin_level',row.osmb_tags?.admin_level??entity.representation?.admin_level],['boundary',row.osmb_tags?.boundary],['place',row.osmb_tags?.place],['Versiune relație ACTUAL',row.osm_metadata?.version],['Timestamp relație ACTUAL',row.osm_metadata?.timestamp],['Versiune relație OSMB',row.osmb_version],['Timestamp relație OSMB',row.osmb_timestamp],['Snapshot OSMB','05.10.2026 — momentul exact per obiect necertificat']]);
    if(Number.isSafeInteger(row.osm_relation_id)&&row.osm_relation_id>0){const link=append(document,osm,'a','Relația sursă în OpenStreetMap');link.href='https://www.openstreetmap.org/relation/'+row.osm_relation_id;link.target='_blank';link.rel='noopener noreferrer';}
    const tags=append(document,osm,'details',null,'atlas-panel-disclosure');append(document,tags,'summary','Taguri OSMB disponibile pentru publicare');table(document,tags,Object.entries(publicOsmTags(row.osmb_tags)));
    append(document,osm,'p',row.osmb_present?'Tagurile sunt date cartografice necertificate juridic. Câmpurile personale, de contact și cele neincluse în lista publică sunt omise.':'Obiectul nu are corespondent în arhiva OSMB fixată; nu sunt inventate taguri sau metadate.','hint');
    append(document,osm,'p','© OpenStreetMap contributors · ODbL. OSMB este un snapshot cartografic, nu un registru juridic.','hint');
    const audit=append(document,body,'details',null,'atlas-panel-disclosure');append(document,audit,'summary','Proveniență și verificare');
    table(document,audit,[['Clasificator',row.classifier],['Ultima verificare documentată','01.11.2026'],['Snapshot ACTUAL',cardAuditBinding.snapshot],['Sursa geometriei',entity.representation?.geometry_source||entity.representation?.source],['Reconciliere',entity.validation?.legal_identity_status],['Încrederea bindingului oficial',entity.legal?.confidence],['SHA-256 geometrie ACTUAL',row.geometry_sha256],['SHA-256 arhivă OSMB',row.osmb_archive_sha256],['Baseline probatoriu',row.baseline],['Starea promovării','Nicio promovare autorizată prin card']]);
   }catch(error){status.textContent='Dovezile suplimentare nu sunt disponibile pentru acest snapshot. Identitatea și acțiunile cardului rămân disponibile.';status.dataset.auditUnavailable='true';}
   finally{body.removeAttribute('aria-busy');}
  });return panel;
 }
 return {render,read};
}
