#!/usr/bin/env node
import net from 'node:net';
import os from 'node:os';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';

const OUTPUT='data/current/actual-network-denial-audit.json';
const expectedMode='docker-network-none';
const mode=process.env.ACTUAL_NETWORK_MODE??null;

const sysInterfaces=(await readdir('/sys/class/net')).sort();
const nonLoopbackSys=sysInterfaces.filter(name=>name!=='lo');
const nodeInterfaces=os.networkInterfaces();
const nonLoopbackNode=Object.entries(nodeInterfaces)
 .flatMap(([name,items])=>(items||[]).filter(item=>!item.internal).map(item=>({name,family:item.family})));

let routeText='';
try{routeText=await readFile('/proc/net/route','utf8');}catch{}
const nonLoopbackRoutes=routeText.trim().split('\n').slice(1)
 .map(line=>line.trim().split(/\s+/))
 .filter(parts=>parts[0]&&parts[0]!=='lo');

const probe=(host,port,family)=>new Promise(resolve=>{
 let settled=false;
 const finish=value=>{
  if(settled)return;
  settled=true;
  socket.destroy();
  resolve(value);
 };
 const socket=net.createConnection({host,port,family});
 socket.setTimeout(1200);
 socket.once('connect',()=>finish(false));
 socket.once('error',()=>finish(true));
 socket.once('timeout',()=>finish(true));
});

const [ipv4Denied,ipv6Denied]=await Promise.all([
 probe('1.1.1.1',443,4),
 probe('2606:4700:4700::1111',443,6)
]);

const checks={
 explicit_network_mode:mode===expectedMode,
 sysfs_only_loopback:nonLoopbackSys.length===0,
 node_only_loopback:nonLoopbackNode.length===0,
 no_non_loopback_routes:nonLoopbackRoutes.length===0,
 external_ipv4_tcp_denied:ipv4Denied,
 external_ipv6_tcp_denied:ipv6Denied
};
const status=Object.values(checks).every(Boolean)?'PASS':'FAIL';
const report={
 schema_version:1,
 mode:'ACTUAL_NETWORK_DENIAL',
 status,
 enforcement:'docker --network none',
 privilege_policy:'--cap-drop ALL + no-new-privileges',
 docker_socket_mounted:false,
 checks,
 policy:'The deterministic ACTUAL phase must execute in a Docker network namespace with only loopback, no non-loopback route and no successful external IPv4 or IPv6 TCP connection. The proof is process-agnostic: every child process shares the same network namespace.'
};

await mkdir('data/current',{recursive:true});
await writeFile(OUTPUT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(status!=='PASS')process.exit(1);
