// Equinox classroom scenario, receiver in Madrid. Great-circle path and midpoint.
export function pathFromMadrid(lat:number,lon:number){
 const rad=Math.PI/180, origin=40.42*rad, target=lat*rad, delta=(lon+3.70)*rad;
 const angle=Math.acos(Math.min(1,Math.sin(origin)*Math.sin(target)+Math.cos(origin)*Math.cos(target)*Math.cos(delta)));
 const x=Math.cos(target)*Math.cos(delta), y=Math.cos(target)*Math.sin(delta);
 const midpointLat=Math.atan2(Math.sin(origin)+Math.sin(target),Math.hypot(Math.cos(origin)+x,y));
 const midpointLon=-3.70+Math.atan2(y,Math.cos(origin)+x)/rad;
 return {km:Math.round(6371*angle),midpointLat,midpointLon};
}
export function pathGain(path:ReturnType<typeof pathFromMadrid>,hour:number){
 const solarAngle=(hour+path.midpointLon/15-12)*Math.PI/12;
 const sun=Math.cos(path.midpointLat)*Math.cos(solarAngle);
 const daylight=Math.max(0,Math.min(1,(sun+.12)/.65));
 const longPath=Math.max(0,Math.min(1,(path.km-500)/900));
 const loss=16*((1-longPath)*(1-daylight)+longPath*daylight);
 return 10**(-loss/20);
}
// Magnitude of two CW rays with a time-varying relative phase.
export function multipath(time:number,path:number,depth:number){
 const echo=.94*depth/100;
 const phase=time*(1.3+path*.12)+path+1.4*Math.sin(time*.37+path);
 return Math.hypot(1+echo*Math.cos(phase),echo*Math.sin(phase))/(1+echo);
}
