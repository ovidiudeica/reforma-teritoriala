import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const tokens=read('atlas-design-tokens.css');
const html=read('index.html');
const style=read('style.css');
const shell=read('atlas-explorer-shell.css');
const tree=read('atlas-tree.css');
const panel=read('atlas-panel-content.css');

test('WEB-R1a token stylesheet loads exactly once before component CSS',()=>{
 const name='atlas-design-tokens.css';
 assert.equal(html.split('href="'+name+'"').length-1,1);
 const tokenIndex=html.indexOf('href="'+name+'"');
 const componentIndex=html.indexOf('href="style.css"');
 const leafIndex=html.indexOf('leaflet.css');
 assert.ok(leafIndex>=0&&tokenIndex>leafIndex&&componentIndex>tokenIndex);
});

test('WEB-R1a preserves exact initial palette, typography stack and 44px targets',()=>{
 for(const [name,value] of [
  ['--atlas-color-page','#f4f5f3'],['--atlas-color-text','#17202a'],
  ['--atlas-color-secondary','#52635a'],['--atlas-color-focus','#365b4a'],
  ['--atlas-color-surface','#fbfbf8'],['--atlas-color-selected','#e4ede7'],
  ['--atlas-color-warning','#633f14'],['--atlas-color-control-border','#bbc5bf'],
  ['--atlas-color-control-bg','#fff'],['--atlas-color-control-hover','#eef2ef'],
  ['--atlas-control-target','44px'],['--atlas-type-app-title','16px'],
  ['--atlas-type-panel-title','17px'],['--atlas-type-card-title','18px'],
  ['--atlas-type-section-title','11px'],['--atlas-type-body','13px'],
  ['--atlas-type-meta','12px'],['--atlas-type-button','12px'],
  ['--atlas-type-button-mobile','13px'],['--atlas-type-icon-close','24px']
 ])assert.ok(tokens.includes(name+': '+value+';'),name+'='+value);
 assert.match(tokens,/--atlas-font-ui:\s*Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;/);
 assert.doesNotMatch(tokens,/@import|https?:\/\//);
});

test('WEB-R1a consumers use semantic tokens rather than introducing new dimensions',()=>{
 for(const [source,names] of [
  [style,['--atlas-font-ui','--atlas-type-app-title','--atlas-type-card-title','--atlas-type-section-title','--atlas-type-body','--atlas-type-meta','--atlas-type-overline','--atlas-type-button','--atlas-type-button-mobile','--atlas-type-icon-close','--atlas-control-target','--atlas-color-control-border']],
  [shell,['--atlas-type-panel-title','--atlas-control-target']],
  [tree,['--atlas-type-meta']],
  [panel,['--atlas-control-target']]
 ])for(const name of names)assert.ok(source.includes('var('+name+','),'missing '+name);
 assert.match(style,/--atlas-text:var\(--atlas-color-text,#17202a\)/);
 assert.match(style,/--atlas-focus:var\(--atlas-color-focus,#365b4a\)/);
});

test('WEB-R1a leaves structural controls and component IDs in place',()=>{
 for(const id of ['drawer-close','details-close','atlas-navigation-rail','atlas-controls','atlas-panel-title','map-home','basemap-toggle','hierarchy-tree'])assert.ok(html.includes('id="'+id+'"'),id);
});
