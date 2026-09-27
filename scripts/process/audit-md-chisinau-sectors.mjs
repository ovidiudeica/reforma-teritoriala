#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [catalog,recon,pub]=await Promise.all([
  read('data/current/entities.json'),
  read('data/current/md-cuatm-reconciliation.json'),
  read('public/data/actual-entities.json')
]);
const expected=[
  ['osm-r1813306','0110','Botanica'],
  ['osm-r1813297','0120','Buiucani'],
  ['osm-r58512','0130','Centru'],
  ['osm-r1813315','0140','Ciocana'],
  ['osm-r1813316','0150','Rîșcani']
];
const byEntity=new Map((catalog.entities||[]).map(e=>[e.id,e]));
const byMatch=new Map((recon.matches||[]).map(m=>[m.id,m]));
const byPublic=new Map((pub.entities||[]).map(e=>[e.id,e]));
const rows=expected.map(([id,legal_id,label])=>{
  const e=byEntity.get(id)||null,m=byMatch.get(id)||null,p=byPublic.get(id)||null;
  return {
    id,label,expected_legal_id:legal_id,
    catalog:e?{name:e.name,type:e.type,parent_id:e.parent_id,admin_level:e.osm?.admin_level??null,place:e.osm?.place??null,cuatm_code:e.osm?.cuatm_code??null,cuatm_unique_id:e.osm?.cuatm_unique_id??null,classification:e.classification??null}:null,
    reconciliation:m?{legal_id:m.legal_id??null,legal_name:m.legal_name??null,match_method:m.match_method??null,confidence:m.confidence??null,unmatched_reason:m.unmatched_reason??null}:null,
    public:p?{display_type:p.display_type??null,inferred_type:p.representation?.inferred_type??null,legal:p.legal??null,validation:p.validation??null,parent_catalog_id:p.hierarchy?.parent_catalog_id??null}:null
  };
});
const issues=[];
for(const r of rows){
  if(!r.catalog)issues.push({id:r.id,issue:'catalog_missing'});
  if(r.catalog&&r.catalog.type!=='chisinau_sector'&&String(r.expected_legal_id)!=='0130')issues.push({id:r.id,issue:'catalog_type_not_chisinau_sector',actual:r.catalog.type});
  if(!r.public||r.public.inferred_type!=='chisinau_sector')issues.push({id:r.id,issue:'public_type_not_chisinau_sector',actual:r.public?.inferred_type??null});
  if(!r.reconciliation||String(r.reconciliation.legal_id)!==String(r.expected_legal_id))issues.push({id:r.id,issue:'cuatm_identity_missing_or_wrong',actual:r.reconciliation?.legal_id??null,expected:r.expected_legal_id});
  if(!r.public||String(r.public.legal?.id)!==String(r.expected_legal_id))issues.push({id:r.id,issue:'public_identity_missing_or_wrong',actual:r.public?.legal?.id??null,expected:r.expected_legal_id});
}
const report={schema_version:1,status:issues.length?'FAIL':'PASS',rows,issues};
console.log(JSON.stringify(report,null,2));
if(issues.length)process.exit(1);
