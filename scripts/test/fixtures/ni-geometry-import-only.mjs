// A static module fixture: importing the live auditor must not invoke its CLI.
globalThis.fetch=()=>{throw Error('Unexpected network request');};
await import('../../audit/p907218-osm-live-85.mjs');
console.log('IMPORT_ONLY');
