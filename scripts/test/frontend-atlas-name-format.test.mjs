import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {formatEntityName} from '../../atlas-name-format.mjs';
import {createSearchIndex,searchEntities} from '../../atlas-search.mjs';
import {entityProvenance} from '../../atlas-presentation.mjs';

test('permanent Romanian casing for RO and MD: proper words, particles, hyphen, diacritics',()=>{
 for(const [raw,expected] of [
  ['JUDEȚUL VRANCEA','Județul Vrancea'],
  ['ALBEȘTI','Albești'],
  ['MUNICIPIUL IAȘI','Municipiul Iași'],
  ['ORAȘUL TÂRGU NEAMȚ','Orașul Târgu Neamț'],
  ['REPUBLICA MOLDOVA','Republica Moldova'],
  ['RAIONUL ORHEI','Raionul Orhei'],
  ['JUDEȚUL BISTRIȚA-NĂSĂUD','Județul Bistrița-Năsăud'],
  ['ȘTEFAN CEL MARE','Ștefan cel Mare'],
  ['VALEA LUI MIHAI','Valea lui Mihai'],
  ['VALEA DE JOS','Valea de Jos'],
  ['POPEȘTI-LEORDENI','Popești-Leordeni'],
  ['SÂNGEORGIU DE PĂDURE','Sângeorgiu de Pădure'],
  ['DROBETA-TURNU SEVERIN','Drobeta-Turnu Severin'],
  ['SATUL DE SUS ȘI DE JOS','Satul de Sus și de Jos'],
  ['UAT GĂGĂUZIA','UAT Găgăuzia'],
  ['REGIUNEA NUTS 2','Regiunea NUTS 2'],
  ['SECTORUL II','Sectorul II'],
  ['MD120','MD120'],
  ['RO11','RO11'],
  ['SIRUTA','SIRUTA'],
  ['CUATM','CUATM'],
  ['orașul alba iulia','Orașul Alba Iulia'],
  ['Municipiul Târgu Mureș','Municipiul Târgu Mureș'],
  ['McDonald și Popescu','McDonald și Popescu']
 ])assert.equal(formatEntityName(raw),expected,raw);
 assert.equal(formatEntityName(null),'');
 assert.equal(formatEntityName('<img src=x>'),'<img src=x>');
});

test('casing is idempotent on all 5848 released names and hierarchy labels; public bytes untouched',async()=>{
 const [rawIndex,rawHierarchy]=await Promise.all([
  readFile('public/data/actual-entities.json','utf8'),
  readFile('public/data/actual-consolidated-tree.json','utf8')
 ]);
 const entities=JSON.parse(rawIndex).entities,nodes=JSON.parse(rawHierarchy).nodes;
 assert.equal(entities.length,5848);assert.equal(nodes.length,5848);
 let changed=0;
 for(const record of [...entities,...nodes]){
  const name=record.display_name,formatted=formatEntityName(name);
  assert.equal(formatEntityName(formatted),formatted,record.id);
  assert.equal(record.display_name,name,'must not alter source data');
  if(formatted!==name)changed++;
 }
 assert.ok(changed>0,'real all-uppercase labels must be normalized for display');
 assert.equal(rawIndex,await readFile('public/data/actual-entities.json','utf8'));
 assert.equal(rawHierarchy,await readFile('public/data/actual-consolidated-tree.json','utf8'));
});

test('search uses formatted labels and parent context, retaining original names, aliases and identifiers',()=>{
 const fixtures=[
  {id:'osm-r58974',jurisdiction:'MD',display_name:'REPUBLICA MOLDOVA',display_type:'state',legal:{registry:'CUATM',id:'1234',name:'REPUBLICA MOLDOVA'}},
  {id:'osm-r7',jurisdiction:'RO',display_name:'JUDEȚUL VRANCEA',display_type:'county',hierarchy:{legal_parent_name:'ROMÂNIA'},searchable_names:['JUDETUL VRANCEA']}
 ];
 const input=JSON.stringify(fixtures);
 const index=createSearchIndex(fixtures);
 assert.equal(index[0].descriptor.name,'Republica Moldova');
 assert.equal(index[1].descriptor.name,'Județul Vrancea');
 assert.equal(index[1].descriptor.parent,'România');
 assert.equal(searchEntities('JUDEȚUL VRANCEA',index)[0].entity.id,'osm-r7');
 assert.equal(searchEntities('Județul Vrancea',index)[0].entity.id,'osm-r7');
 assert.equal(searchEntities('1234',index)[0].entity.id,'osm-r58974');
 assert.equal(JSON.stringify(fixtures),input,'search must not rewrite official or index data');
});

test('official and statistical provenance presents readable names but unchanged authority/codes',()=>{
 const entity={
  legal:{name:'JUDEȚUL VRANCEA',parent_name:'ROMÂNIA',registry:'SIRUTA',id:'1234'},
  statistical:{code:'RO11',classification:'NUTS',level:3,parent_code:'RO1'},
  hierarchy:{statistical_parent_name:'REGIUNEA NORD-VEST'},
  representation:{source:'OSM',osm_relation_id:1234}
 };
 const sections=entityProvenance(entity);
 const official=Object.fromEntries(sections[0].rows),statistical=Object.fromEntries(sections[1].rows);
 assert.equal(official['Denumire oficială'],'Județul Vrancea');
 assert.equal(official['Părinte legal'],'România');
 assert.equal(official['ID oficial'],'1234');
 assert.equal(statistical['Părinte statistic'],'Regiunea Nord-Vest');
 assert.equal(statistical['Cod oficial'],'RO11');
 assert.equal(entity.legal.name,'JUDEȚUL VRANCEA');
 assert.equal(entity.hierarchy.statistical_parent_name,'REGIUNEA NORD-VEST');
});
