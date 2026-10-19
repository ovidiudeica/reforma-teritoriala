import path from 'node:path';

// Environment may confirm the reviewed fixture path; it never selects a write target.
export function performanceOutput(root,requested){
 const output=path.join(root,'outputs','web-r2c302-cdp');
 if(requested&&path.resolve(root,requested)!==output)throw Error('Unsupported benchmark output; use outputs/web-r2c302-cdp');
 return output;
}
