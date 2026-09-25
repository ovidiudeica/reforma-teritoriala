#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { pointOnFeature, booleanPointInPolygon } from '@turf/turf';

const countries=['RO','MD'];
const catalog=JSON.parse(await readFile('data/current/entities.json','utf8'));
const entities=catalog.entities||[];
const byId=new Map(entities.map(e=>[e.id,e]));

function tagsOf(f){ return f.properties?.tags||f.properties||{}; }
function key(v){ return v===undefined||v===null||v===''?'∅':String(v); }
function bump(obj,k){ obj[k]=(obj[k]||0)+1; }

const report={
  generated_at:new Date().toISOString(),
  source_generated_at:catalog.generated_at,
  entity_count:entities.length,
  countries:{},
  parent_validation:{}
};
const review={generated_at:new Date().toISOString(),source_generated_at:catalog.generated_at,classifier_version:catalog.classifier_version||null,items:[]};
function reviewItem(e,issue,extra={}){
 return {jurisdiction:e.jurisdiction,id:e.id,name:e.name,osm_relation_id:e.osm?.relation_id??null,admin_level:e.osm?.admin_level??null,place:e.osm?.place??null,designation:e.osm?.designation??null,entity_type:e.type,classification_confidence:e.classification?.confidence??null,classification_reason:e.classification?.reason??null,parent_id:e.parent_id,osm_url:e.source_url||null,issue,...extra};
}

for(const country of countries){
  const geo=JSON.parse(await readFile(`public/geo/current/${country.toLowerCase()}-administrative.geojson`,'utf8'));
  const features=geo.features||[];
  const featureById=new Map(features.map(f=>[f.properties?.catalog_id,f]));
  const combinations={}, levels={}, places={}, designations={}, osmTypes={}, entityTypes={};

  for(const f of features){
    const t=tagsOf(f);
    const level=key(t.admin_level);
    const place=key(t.place);
    const designation=key(t.designation);
    const osmType=key(t.type);
    const entityType=key(f.properties?.entity_type);
    bump(levels,level); bump(places,place); bump(designations,designation); bump(osmTypes,osmType); bump(entityTypes,entityType);
    bump(combinations,JSON.stringify({admin_level:level,place,designation,osm_type:osmType,entity_type:entityType}));
  }

  const comboRows=Object.entries(combinations).map(([k,count])=>({...JSON.parse(k),count})).sort((a,b)=>b.count-a.count);
  const countryEntities=entities.filter(e=>e.jurisdiction===country);
  const minLevel=Math.min(...countryEntities.map(e=>e.osm?.admin_level??99));
  const pv={checked:countryEntities.length,root_parent:0,unexpected_root:0,entity_parent:0,null_parent:0,missing_parent:0,parent_wrong_jurisdiction:0,parent_level_not_lower:0,geometry_missing:0,point_outside_parent:0,issues:[]};
  for(const e of countryEntities.filter(e=>e.review_required)) review.items.push(reviewItem(e,'classification_review'));


  for(const e of countryEntities){
    if(e.parent_id==null){pv.null_parent++;pv.issues.push({id:e.id,name:e.name,issue:'null_parent'});continue;}
    if(e.parent_id===country){pv.root_parent++;if((e.osm?.admin_level??99)>minLevel){pv.unexpected_root++;pv.issues.push({id:e.id,name:e.name,admin_level:e.osm?.admin_level,issue:'unexpected_root'});review.items.push(reviewItem(e,'unexpected_root',{minimum_admin_level:minLevel}));}continue;}
    pv.entity_parent++;
    const p=byId.get(e.parent_id);
    if(!p){pv.missing_parent++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,issue:'missing_parent'});continue;}
    if(p.jurisdiction!==country){pv.parent_wrong_jurisdiction++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,issue:'parent_wrong_jurisdiction'});}
    const cl=e.osm?.admin_level??99, pl=p.osm?.admin_level??99;
    if(pl>=cl){pv.parent_level_not_lower++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,child_level:cl,parent_level:pl,issue:'parent_level_not_lower'});}
    const cf=featureById.get(e.id), pf=featureById.get(p.id);
    if(!cf||!pf){pv.geometry_missing++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,issue:'geometry_missing'});continue;}
    try{
      if(!booleanPointInPolygon(pointOnFeature(cf),pf)){pv.point_outside_parent++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,issue:'point_outside_parent'});}
    }catch{
      pv.geometry_missing++;pv.issues.push({id:e.id,name:e.name,parent_id:e.parent_id,issue:'geometry_validation_error'});
    }
  }

  report.countries[country]={
    feature_count:features.length,
    review_required:countryEntities.filter(e=>e.review_required).length,
    distributions:{admin_level:levels,place:places,designation:designations,osm_type:osmTypes,entity_type:entityTypes},
    combinations:comboRows
  };
  pv.issue_count=pv.issues.length;
  report.parent_validation[country]=pv;
}

review.items.sort((a,b)=>a.jurisdiction.localeCompare(b.jurisdiction)||(a.admin_level??99)-(b.admin_level??99)||(a.name||'').localeCompare(b.name||'','ro'));
review.item_count=review.items.length;
review.by_issue=review.items.reduce((o,x)=>(o[x.issue]=(o[x.issue]||0)+1,o),{});
review.by_jurisdiction=review.items.reduce((o,x)=>(o[x.jurisdiction]=(o[x.jurisdiction]||0)+1,o),{});
await writeFile('data/current/admin-audit.json',JSON.stringify(report,null,2)+'\n');
await writeFile('data/current/admin-review.json',JSON.stringify(review,null,2)+'\n');
console.log(JSON.stringify({
  entity_count:report.entity_count,
  countries:Object.fromEntries(countries.map(c=>[c,{
    features:report.countries[c].feature_count,
    review_required:report.countries[c].review_required,
    combinations:report.countries[c].combinations.length,
    parent_issues:report.parent_validation[c].issue_count
  }]))
},null,2));
