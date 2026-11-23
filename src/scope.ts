// Both views use the same simulated RF amplitudes, before the receiver filter.
export function spectrumDisplay(canvas:HTMLCanvasElement){
 const ctx=canvas.getContext('2d')!;
 const width=canvas.width, height=canvas.height, divider=90;
 const bins=new Float32Array(width),peaks=new Float32Array(width);
 const row=ctx.createImageData(width,1);
 const palette=[[4,10,35],[13,36,102],[15,98,177],[34,195,204],[247,214,89],[255,117,44]];
 const colors=Array.from({length:256},(_,i)=>{
  const position=i/255*(palette.length-1),index=Math.min(palette.length-2,Math.floor(position));
  return palette[index].map((v,k)=>Math.round(v+(palette[index+1][k]-v)*(position-index)));
 });
 ctx.fillStyle='#050e23';ctx.fillRect(0,0,width,height);
 return {
  begin(noise:number,storm:number){
   for(let x=0;x<width;x++)bins[x]=.012+Math.random()*(.015+.085*noise/100)+storm*.35;
  },
  signal(position:number,level:number){
   const center=Math.round(position*(width-1));
   for(let x=Math.max(0,center-6);x<=Math.min(width-1,center+6);x++)
    bins[x]+=level*Math.exp(-((x-center)**2)/6);
  },
  draw(){
   ctx.drawImage(canvas,0,divider,width,height-divider-1,0,divider+1,width,height-divider-1);
   ctx.fillStyle='#081425';ctx.fillRect(0,0,width,divider);
   ctx.strokeStyle='#203449';ctx.lineWidth=1;ctx.beginPath();
   for(let x=0;x<width;x+=width/10){ctx.moveTo(x,0);ctx.lineTo(x,divider)}
   for(let y=10;y<divider;y+=20){ctx.moveTo(0,y);ctx.lineTo(width,y)}
   ctx.stroke();ctx.beginPath();
   for(let x=0;x<width;x++){
    const intensity=Math.min(1,Math.log1p(12*bins[x])/Math.log(13));
    const rgb=colors[Math.round(255*intensity)],offset=x*4;
    row.data[offset]=rgb[0];row.data[offset+1]=rgb[1];row.data[offset+2]=rgb[2];row.data[offset+3]=255;
    peaks[x]=Math.max(intensity,peaks[x]*.91);
    const y=divider-3-peaks[x]*(divider-8);
    if(x===0)ctx.moveTo(0,y);else ctx.lineTo(x,y);
   }
   ctx.strokeStyle='#81eee8';ctx.lineWidth=1.5;ctx.stroke();
   ctx.lineTo(width,divider);ctx.lineTo(0,divider);ctx.closePath();ctx.fillStyle='#38cbd524';ctx.fill();
   ctx.putImageData(row,0,divider);
  }
 };
}
