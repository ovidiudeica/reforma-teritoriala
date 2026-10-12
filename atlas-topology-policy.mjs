export const topologyRelations=Object.freeze(['boundary','point','overlap','contains','within','equal','disjoint']);
export function compatibleLevels(a,b){
 const channels=[];
 if(a.category!=='statistical'&&b.category!=='statistical'&&a.representation?.admin_level!=null&&a.representation.admin_level===b.representation?.admin_level)channels.push('administrative');
 if(a.roles?.includes('statistical')&&b.roles?.includes('statistical')&&a.statistical?.level!=null&&a.statistical.level===b.statistical?.level)channels.push('statistical');
 return channels;
}
export function reverseRelation(relation){return relation==='contains'?'within':relation==='within'?'contains':relation;}
// Spherical geodesic, mean Earth radius (IUGG), metres; never planar degrees.
export function geodesicMetres(a,b){const rad=Math.PI/180,p=a[1]*rad,q=b[1]*rad,d=(b[1]-a[1])*rad,l=(b[0]-a[0])*rad,h=Math.sin(d/2)**2+Math.cos(p)*Math.cos(q)*Math.sin(l/2)**2;return 6371008.8*2*Math.atan2(Math.sqrt(Math.max(0,Math.min(1,h))),Math.sqrt(Math.max(0,1-h)));}
export function frontierMetres(lines){let sum=0,correction=0;const seen=new Set();for(const line of lines)for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],ka=a[0]+','+a[1],kb=b[0]+','+b[1],key=ka<kb?ka+'|'+kb:kb+'|'+ka;if(ka===kb||seen.has(key))continue;seen.add(key);const value=geodesicMetres(a,b)-correction,t=sum+value;correction=(t-sum)-value;sum=t;}return sum;}
