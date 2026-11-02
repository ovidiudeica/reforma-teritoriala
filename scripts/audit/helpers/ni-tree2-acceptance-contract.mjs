import assert from 'node:assert/strict';

// Contract de acceptare succesor. Nu schimbă modelul sau starea aplicației.
export const NI_TREE2_ACCEPTANCE=Object.freeze({
 id:'NI-TREE.2/published-acceptance-v1',
 actualRoots:Object.freeze(['osm-r58974','osm-r90689']),
 jurisdictions:Object.freeze(['MD','RO']),
 initialOutlines:Object.freeze([]),
 rootOutline:'view-nistrenia',parent:'osm-r58974',groupCount:7,totalOutlines:8,
 historicalScript:'scripts/audit/web-r2c32-hardening-browser.mjs',
 historicalSha256:'75677ebbc66e7bf1b0335b4148c0c8e31d9c13f9e0759e0cd8627436413be1f4'
});
export function assertNiTree2Initial(value){
 const c=NI_TREE2_ACCEPTANCE;
 assert.deepEqual([...value.actual].sort(),c.actualRoots);
 assert.deepEqual([...value.roots].sort(),c.actualRoots);
 assert.deepEqual([...value.jurisdictions].sort(),c.jurisdictions);
 assert.deepEqual(value.ni,c.initialOutlines);
 assert.equal(value.niParent,c.parent);
 assert.equal(value.mdFirst,c.rootOutline);
 assert.equal(value.groups,c.groupCount);
 assert.equal(value.outlines,c.totalOutlines);
}
