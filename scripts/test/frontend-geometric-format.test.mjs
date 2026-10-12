import test from 'node:test';import assert from 'node:assert/strict';
import {formatAreaKm2,formatAreaRatio} from '../../atlas-geometric-ui.mjs';
test('small positive OSM territory never appears as zero km²',()=>{assert.equal(formatAreaKm2(2676.076603026288),'0,0027 km²');assert.equal(formatAreaKm2(2),'<0,0001 km²');assert.equal(formatAreaKm2(1e6),'1 km²');});
test('a small positive area ratio remains distinct from zero and unavailable',()=>{assert.equal(formatAreaRatio(1e-8),'<0,001');assert.equal(formatAreaRatio(0),'0');assert.equal(formatAreaRatio(2),'2');assert.equal(formatAreaRatio(null),'Indisponibil');});
