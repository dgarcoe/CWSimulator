import {useEffect,useRef,useState} from 'react';
import {CW_CODES} from './cwPlayback';

const low=7024000, high=7026500;
const channels=[
 {split:0,prefix:'EA1',hz:7024670,wpm:15,power:.8,name:'ANA',qth:'VIGO'},
 {split:1000,prefix:'F4',hz:7024890,wpm:21,power:.55,name:'LUC',qth:'LYON'},
 {split:500,prefix:'DL2',hz:7025940,wpm:25,power:.35,name:'MAX',qth:'BONN'}
];
function makeStations(){
 const used=new Set<string>();
 function callsign(prefix:string){
  let call:string;
  do{call=prefix+Array.from({length:3},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join('')}while(used.has(call));
  used.add(call);return call;
 }
 return channels.map(channel=>({...channel,call:callsign(channel.prefix),rivals:[callsign('G3'),callsign('I2')]}));
}
type Station=ReturnType<typeof makeStations>[number];
function message(ctx:AudioContext,text:string,wpm:number,pause:number){
 const units:number[]=[];
 for(const word of text.split(' ')){
  for(const letter of word){
   for(const mark of CW_CODES[letter]||'')units.push(...(mark==='.'?[1]:[1,1,1]),0);
   units.push(0,0);
  }
  units.push(0,0,0,0);
 }
 const dot=1.2/wpm, end=(units.length-7)*dot;
 const buffer=ctx.createBuffer(1,Math.ceil((end+pause)*8000),8000);
 const data=buffer.getChannelData(0);
 for(let i=0;i<end*8000;i++){
  const pos=i/(8000*dot),unit=Math.floor(pos),fraction=pos-unit;
  if(units[unit])data[i]=Math.min(1,units[unit-1]?1:fraction*dot/.004,units[unit+1]?1:(1-fraction)*dot/.004);
 }
 return {buffer,end};
}
function voice(ctx:AudioContext,station:Station,index:number,caller=false){
 const osc=ctx.createOscillator(),key=ctx.createGain(),gain=ctx.createGain();
 osc.connect(key).connect(gain).connect(ctx.destination);
 key.gain.value=0; gain.gain.value=0; osc.start();
 let source:AudioBufferSourceNode;
 function send(text:string,offset=0,loop=true){
  source?.stop();source?.disconnect();
  const {buffer,end}=message(ctx,text,station.wpm,6+index);
  source=ctx.createBufferSource();source.buffer=buffer;source.loop=loop;
  source.connect(key.gain);source.start(ctx.currentTime,offset);
  const epoch=ctx.currentTime-offset;
  return {finished:(time:number)=>time-epoch>=end, level:(time:number)=>!loop&&time-epoch>=end?0:buffer.getChannelData(0)[Math.floor(((time-epoch)%buffer.duration)*8000)]||0,
   listening:(time:number)=>(time-epoch)%buffer.duration>=end};
 }
 const cq=()=>send('CQ CQ DE '+station.call+' '+station.call+(station.split?' UP '+(station.split===1000?'1':'0R5'):'')+' K',index*2);
 return {osc,gain,send,cq,signal:caller?send('E',.5,false):cq(),close(){source.stop();source.disconnect();osc.stop();osc.disconnect();key.disconnect();gain.disconnect()}};
}
type Voice=ReturnType<typeof voice>;
type Props={hz:number;tune:(n:number)=>void;tone:number;volume:number;qrn:number;qsb:number;call:string;setCall:(call:string)=>void;decoded:string};
export function Band(props:Props){
 const {hz,tune,call}=props;
 const [on,setOn]=useState(false),[width,setWidth]=useState(500),[tx,setTx]=useState(''),[feedback,setFeedback]=useState(''),[contact,setContact]=useState<number|null>(null);
 const [split,setSplit]=useState(false),[offset,setOffset]=useState(1000);
 const [monitor,setMonitor]=useState(false);
 const txHz=hz+(split?offset:0);
 const canvas=useRef<HTMLCanvasElement>(null), rig=useRef<{ctx:AudioContext;voices:Voice[];stations:Station[];busy:Set<number>}|null>(null);
 const settings=useRef({...props,width});settings.current={...props,width,hz:split&&monitor?txHz:hz};
 const baseline=useRef('');
 useEffect(()=>{
  if(!on)return;
  const stations=makeStations();
  const ctx=new AudioContext(),voices=stations.map((s,i)=>voice(ctx,s,i));
  const busy=new Set<number>();
  const rivals=stations.flatMap((s,i)=>s.split?s.rivals.map((call,n)=>{
   const station={...s,call,hz:s.hz+s.split+(n?40:-30),wpm:19+4*n,power:.45+.1*n};
   return {station,voice:voice(ctx,station,i,true),target:i};
  }):[]);
  const traffic=stations.map(()=>({phase:'idle',next:ctx.currentTime+2,winner:0}));
  const signals=[...stations.map((station,i)=>({station,voice:voices[i]})),...rivals];
  const noise=ctx.createBufferSource(),noiseGain=ctx.createGain();
  const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  noise.buffer=buffer;noise.loop=true;noiseGain.gain.value=0;
  noise.connect(noiseGain).connect(ctx.destination);noise.start();
  rig.current={ctx,voices,stations,busy};
  void ctx.resume().catch(()=>{if(rig.current?.ctx===ctx){setFeedback('No se pudo activar el audio. Vuelve a abrir la banda.');setOn(false)}});
  const screen=canvas.current!,g=screen.getContext('2d')!;
  g.fillStyle='#071820';g.fillRect(0,0,screen.width,screen.height);
  const timer=window.setInterval(()=>{
   const p=settings.current,t=ctx.currentTime;
   noiseGain.gain.setTargetAtTime(p.volume*p.qrn/500,t,.02);
   g.drawImage(screen,0,0,screen.width,screen.height-1,0,1,screen.width,screen.height-1);
   g.fillStyle='#071820';g.fillRect(0,0,screen.width,1);
   for(let n=0;n<25+p.qrn;n++){g.fillStyle='#20404a';g.fillRect(Math.random()*screen.width,0,1,1)}
   stations.forEach((s,i)=>{
    const turn=traffic[i],dx=voices[i];
    if(!s.split||t<turn.next)return;
    const callers=rivals.filter(r=>r.target===i);
    if(turn.phase==='idle'){
     if(busy.has(i)||!dx.signal.listening(t))return;
     busy.add(i);turn.phase='calling';turn.winner=Math.floor(Math.random()*callers.length);
     for(const r of callers)r.voice.signal=r.voice.send(r.station.call,0,false);
     dx.signal=dx.send('E',.5,false);
    }else if(turn.phase==='calling'){
     if(!callers.every(r=>r.voice.signal.finished(t)))return;
     dx.signal=dx.send(callers[turn.winner].station.call+' 599 K',0,false);turn.phase='report';
    }else if(turn.phase==='report'){
     if(!dx.signal.finished(t))return;
     const winner=callers[turn.winner].voice;
     winner.signal=winner.send('R 599 TU',0,false);turn.phase='reply';
    }else{
     if(!callers[turn.winner].voice.signal.finished(t))return;
     dx.signal=dx.cq();busy.delete(i);turn.phase='idle';turn.next=t+35+Math.random()*20;
    }
   });
   signals.forEach(({voice:v,station:s},i)=>{
    const offset=s.hz-p.hz;
    const fade=1-p.qsb/100*(.5+.5*Math.sin(t*(.6+i*.13)+i));
    const response=1/Math.sqrt(1+Math.pow(2*offset/p.width,8));
    v.osc.frequency.setTargetAtTime(Math.max(30,p.tone+offset),t,.012);
    v.gain.gain.setTargetAtTime(p.volume*s.power*fade*response,t,.012);
    g.fillStyle='rgba(114,255,194,'+v.signal.level(t)*s.power*fade+')';
    g.fillRect((s.hz-low)/(high-low)*screen.width-2,0,5,1);
   });
  },25);
  return ()=>{clearInterval(timer);rig.current=null;signals.forEach(s=>s.voice.close());noise.stop();void ctx.close()};
 },[on]);
 function transmit(){
  const radio=rig.current;if(!radio)return;
  const words=tx.trim().toUpperCase().split(/\s+/), own=call.trim().toUpperCase();
  const index=radio.stations.findIndex(s=>Math.abs(s.hz-hz)<=70);
  if(index<0){setFeedback('Sin respuesta. Afina la frecuencia y vuelve a llamar.');return}
  const station=radio.stations[index],v=radio.voices[index];
  if(Math.abs(txHz-station.hz-station.split)>70){setFeedback('Sin respuesta en TX. Escucha si anuncia UP y ajusta el desplazamiento.');return}
  if(radio.busy.has(index)&&contact!==index){setFeedback('Está trabajando a otro operador. Escucha el intercambio y espera el siguiente CQ.');return}
  if(!v.signal.listening(radio.ctx.currentTime)){setFeedback('La estación está transmitiendo. Espera el cambio.');return}
  if(contact===null){
   if(!/^[A-Z0-9/]{3,12}$/.test(own)||words[0]!==station.call||words[1]!=='DE'||!words.slice(2,-1).includes(own)||!['K','KN'].includes(words[words.length-1]||'')){setFeedback('Sin respuesta. Comprueba los indicativos, DE y el cambio K.');return}
   v.signal=v.send(own+' DE '+station.call+' UR RST 579 NAME '+station.name+' QTH '+station.qth+' KN');
   radio.busy.add(index);setContact(index);setFeedback('Te ha contestado. Copia el intercambio y envía tu RST en la pausa.');
  }else{
   if(index!==contact||!words.some(w=>/^[1-5][1-9][1-9]$/.test(w))){setFeedback('Vuelve al corresponsal y envía un reporte RST.');return}
   v.signal=v.send(own+' TU 73 SK');
   const farewell=v.signal;
   const check=()=>{if(rig.current!==radio||v.signal!==farewell)return;if(farewell.listening(radio.ctx.currentTime)){v.signal=v.cq();radio.busy.delete(index)}else window.setTimeout(check,100)};
   window.setTimeout(check,100);
   setContact(null);setFeedback('QSO completado con '+station.call+'.');
  }
  setTx('');baseline.current=settings.current.decoded;
 }
 return <section className="band"><div className="row"><h3>Banda de 40 m</h3><button onClick={()=>{setOn(!on);setSplit(false);setMonitor(false);setContact(null);setFeedback('');setTx('');baseline.current=props.decoded}}>{on?'Cerrar banda':'Abrir banda'}</button></div>
 <p>Pulsa sobre un trazo para sintonizar. Afina con las flechas del VFO y escucha el indicativo antes de llamar.</p>
 <div className="band-scope" onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();tune(Math.max(low,Math.min(high,Math.round(low+(e.clientX-r.left)/r.width*(high-low)))))}}>
 <canvas ref={canvas} width="900" height="144" aria-label="Waterfall de la banda simulada"/><i style={{left:((split&&monitor?txHz:hz)-low)/(high-low)*100+'%',width:width/(high-low)*100+'%'}}/>{split&&txHz>=low&&txHz<=high&&<b className="tx-marker" style={{left:(txHz-low)/(high-low)*100+'%'}}>TX</b>}</div>
 <div className="band-scale"><span>7.024,0 kHz</span><span>7.026,5 kHz</span></div>
 <label>VFO · paso de 10 Hz<input type="range" min={low} max={high} step={10} value={hz} onChange={e=>tune(+e.target.value)}/></label>
 <label><input type="checkbox" checked={split} onChange={e=>setSplit(e.target.checked)}/> Split · TX independiente</label>
 {split&&<label>Desplazamiento TX +{offset} Hz · {txHz.toLocaleString('de-DE')} Hz<input type="range" min={0} max={1500} step={10} value={offset} onChange={e=>setOffset(+e.target.value)}/></label>}
 {split&&<label><input type="checkbox" checked={monitor} onChange={e=>setMonitor(e.target.checked)}/> Escuchar en la frecuencia TX</label>}
 <label>Filtro CW<select value={width} onChange={e=>setWidth(+e.target.value)}>{[100,250,500,1000].map(n=><option key={n} value={n}>{n} Hz</option>)}</select></label>
 {on&&<form onSubmit={e=>{e.preventDefault();transmit()}}><label>Indicativo de operador<input className="textinput" maxLength={12} value={call} onChange={e=>props.setCall(e.target.value.toUpperCase())}/></label><label>Llamada en frecuencia<input className="textinput" value={tx} onChange={e=>setTx(e.target.value.toUpperCase())} placeholder="Indicativo DE tu indicativo K"/></label><div className="row"><button disabled={!tx.trim()}>Transmitir</button><button type="button" onClick={()=>setTx(props.decoded.startsWith(baseline.current)?props.decoded.slice(baseline.current.length).trim():props.decoded)}>Capturar paletas</button></div></form>}
 <p role="status">{feedback}</p></section>;
}
