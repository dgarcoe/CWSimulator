import {RadioKnob} from './RadioKnob';
import {spectrumDisplay} from './scope';
import {useEffect,useRef,useState} from 'react';
import {CW_CODES} from './cwPlayback';

import {pathFromMadrid,pathGain,multipath} from './propagation';

const low=7024000, high=7026500;
const channels=[
 {split:0,prefix:'EA1',wpm:15,power:.8,name:'ANA',qth:'VIGO',path:pathFromMadrid(42.24,-8.72)},
 {split:1000,prefix:'F4',wpm:21,power:.55,name:'LUC',qth:'LYON',path:pathFromMadrid(45.76,4.84)},
 {split:500,prefix:'DL2',wpm:25,power:.35,name:'MAX',qth:'BONN',path:pathFromMadrid(50.74,7.10)}
];
function makeStations(){
 const used=new Set<string>();
 function callsign(prefix:string){
  let call:string;
  do{call=prefix+Array.from({length:3},()=>String.fromCharCode(65+Math.floor(Math.random()*26))).join('')}while(used.has(call));
  used.add(call);return call;
 }
 // Keep two nearby CQ signals and reserve room for the split callers.
 const slot=(min:number,max:number)=>10*(min+Math.floor(Math.random()*(max-min+1)));
 const base=low+slot(12,46);
 const frequencies=[base,base+slot(19,30),low+slot(188,195)];
 return channels.map((channel,i)=>({...channel,hz:frequencies[i],call:callsign(channel.prefix),rivals:[callsign('G3'),callsign('I2')]}));
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
type Turn={phase:string;next:number;winner:number;offer?:{call:string;offset:number}};
function copyLevel(power:number,offset:number,path:number,time:number,qsb:number,qrn:number){
 return power*multipath(time,path,qsb)/(1+(offset/65)**2)/(.12+qrn/180);
}
type Props={children:React.ReactNode;setQrn:(n:number)=>void;setQsb:(n:number)=>void;setLever:(lever:'dit'|'dah',down:boolean)=>void;paddleFeed:{current:((event:boolean|string)=>void)|null};onState:(state:'RX'|'TX'|null)=>void;wpm:number;hz:number;tune:(n:number)=>void;tone:number;volume:number;qrn:number;qsb:number;call:string;setCall:(call:string)=>void;decoded:string};
export function Band(props:Props){
 const {hz,tune,call}=props;
 const [on,setOn]=useState(false),[width,setWidth]=useState(500),[tx,setTx]=useState(''),[feedback,setFeedback]=useState(''),[contact,setContact]=useState<number|null>(null);
 const [split,setSplit]=useState(false),[offset,setOffset]=useState(1000);
 const [monitor,setMonitor]=useState(false);
 const txHz=hz+(split?offset:0);
 const afterTx=useRef<null|(()=>void)>(null);
 const [sending,setSending]=useState(false);
 useEffect(()=>{props.onState(on?(sending?'TX':'RX'):null);return ()=>props.onState(null)},[on,sending,props.onState]);
 const [direct,setDirect]=useState(true);
 const manual=useRef({active:false,down:false,text:'',lastEdge:0,rx:0,tx:0,start:0});
 const finishManual=useRef(()=>{});
 finishManual.current=()=>{
  const m=manual.current;
  if(!m.active)return;
  m.active=false;m.down=false;setSending(false);
  if(m.text.trim())transmit(m.text,true);
 };
 useEffect(()=>{
  if(!on||!direct)return;
  props.paddleFeed.current=event=>{
   const radio=rig.current,m=manual.current;
   if(!radio||afterTx.current)return;
   if(typeof event==='string'){if(m.active)m.text+=event;return}
   if(event&&!m.active){
    m.active=true;m.text='';m.rx=hz;m.tx=txHz;m.start=radio.ctx.currentTime;
    setSending(true);setFeedback('TX · Paletas');
   }
   if(m.active&&event!==m.down){m.down=event;m.lastEdge=radio.ctx.currentTime}
  };
  return ()=>{props.paddleFeed.current=null};
 },[on,direct,hz,txHz,props.paddleFeed]);
 const [showSpeeds,setShowSpeeds]=useState(false);
 const [spots,setSpots]=useState<{hz:number;wpm:number}[]>([]);
 const canvas=useRef<HTMLCanvasElement>(null), rig=useRef<{ctx:AudioContext;voices:Voice[];stations:Station[];traffic:Turn[];busy:Set<number>;firstCaller:number;ownTx:Voice;ownStation:Station;activeCallers:number[];occupied:(hz:number)=>boolean}|null>(null);
 const [hour,setHour]=useState(17),[storm,setStorm]=useState(false);
 const [copy,setCopy]=useState('');
 type Entry={utc:number;km:number;rx:number;tx:number;call:string;sent:string;copy:string;expected:string};
 const [log,setLog]=useState<Entry[]>(()=>{try{const rows=JSON.parse(localStorage.getItem('cw-band-log')||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.expected==='string'&&typeof r.copy==='string'&&typeof r.call==='string'):[]}catch{return []}});
 const [storageError,setStorageError]=useState(false);
 const report=useRef('');
 const settings=useRef({...props,width,hour,storm});settings.current={...props,width,hour,storm,hz:split&&monitor?txHz:hz};
 const baseline=useRef('');
 const partial=useRef<{index:number;call:string;until:number}|null>(null);
 function answer(v:Voice,station:Station,index:number,own:string,unclear:boolean,time:number){
  if(unclear){
   v.signal=v.send(own.slice(0,2)+'? AGN K',0,false);
   partial.current={index,call:own,until:time+18};
   setFeedback('El DX pide una repetición. Escucha el parcial y repite tu indicativo durante la pausa.');
  }else{
   const strength=pathGain(station.path,settings.current.hour)*station.power;
   report.current='5'+Math.max(1,Math.min(9,Math.round(9+3*Math.log10(strength))))+'9';
   setCopy('');
   v.signal=v.send(own+' DE '+station.call+' UR RST '+report.current+' NAME '+station.name+' QTH '+station.qth+' KN');
   setContact(index);setFeedback('Te ha contestado. Copia el intercambio y envía tu RST en la pausa.');
  }
 }
 useEffect(()=>{
  if(!on)return;
  const stations=makeStations();
  const ctx=new AudioContext(),voices=stations.map((s,i)=>voice(ctx,s,i));
  const busy=new Set<number>();
  const rivals=stations.flatMap((s,i)=>s.split?s.rivals.map((call,n)=>{
   const station={...s,call,path:n?pathFromMadrid(45.46,9.19):pathFromMadrid(51.51,-.13),hz:s.hz+s.split+(n?40:-30),wpm:19+4*n,power:.45+.1*n};
   return {station,voice:voice(ctx,station,i,true),target:i};
  }):[]);
  const traffic:Turn[]=stations.map(()=>({phase:'idle',next:ctx.currentTime+2,winner:0}));
  const signals=[...stations.map((station,i)=>({station,voice:voices[i]})),...rivals];
  const firstCaller=stations.length;
  for(const [i,location] of ['LEEDS','PAVIA'].entries()){
   const station={...stations[0],call:stations[0].rivals[i],hz:0,qth:location,name:i?'LUCA':'BEN',path:i?pathFromMadrid(45.19,9.16):pathFromMadrid(53.80,-1.55),wpm:17+i*3,power:.8-i*.2};
   const incoming=voice(ctx,station,i,true);
   stations.push(station);voices.push(incoming);traffic.push({phase:'idle',next:0,winner:0});
   signals.push({station,voice:incoming});
  }
  const ownStation={...stations[0],hz:0,power:1};
  const ownTx=voice(ctx,ownStation,0,true);
  signals.push({station:ownStation,voice:ownTx});
  const occupied=(frequency:number)=>stations.slice(0,firstCaller).some(s=>
   Math.abs(s.hz-frequency)<=100||Math.abs(s.hz+s.split-frequency)<=100);
  const noise=ctx.createBufferSource(),noiseGain=ctx.createGain();
  const buffer=ctx.createBuffer(1,8000,8000);
  const data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
  noise.buffer=buffer;noise.loop=true;noiseGain.gain.value=0;
  const passband=ctx.createBiquadFilter();passband.type='bandpass';
  noise.connect(passband).connect(noiseGain).connect(ctx.destination);noise.start();
  rig.current={ctx,voices,stations,busy,traffic,firstCaller,ownTx,ownStation,activeCallers:[],occupied};
  void ctx.resume().catch(()=>{if(rig.current?.ctx===ctx){setFeedback('No se pudo activar el audio. Vuelve a abrir la banda.');setOn(false)}});
  const scope=spectrumDisplay(canvas.current!);
  let lastSpotScan=-1,spotSignature='';
  let stormEnvelope=0;
  const timer=window.setInterval(()=>{
   const p=settings.current,t=ctx.currentTime;
   passband.frequency.setTargetAtTime(p.tone,t,.03);
   passband.Q.setTargetAtTime(p.tone/p.width,t,.03);
   if(partial.current&&!manual.current.active&&t>partial.current.until){
    const i=partial.current.index;partial.current=null;busy.delete(i);
    if(i>=firstCaller){stations[i].hz=0;rig.current!.activeCallers=[]}else voices[i].signal=voices[i].cq();
    setFeedback(i>=firstCaller?'El corresponsal ha dejado de llamar.':'El DX ha vuelto a llamar CQ.');
   }
   const m=manual.current;
   if(m.active&&!m.down&&t-m.lastEdge>Math.max(1.4,18*1.2/p.wpm))finishManual.current();
   const keyed=m.active||!ownTx.signal.finished(t);
   if(!keyed&&afterTx.current){
    const done=afterTx.current;afterTx.current=null;setSending(false);done();
   }
   const strike=p.storm&&Math.random()<.025;
   stormEnvelope=p.storm?(strike?1:stormEnvelope*.65):0;
   const channelNoise=p.qrn/40+stormEnvelope*4;
   noiseGain.gain.setTargetAtTime((keyed?0:p.volume)*channelNoise,t,.008);
   scope.begin(channelNoise);
   stations.forEach((s,i)=>{
    const turn=traffic[i],dx=voices[i];
    if(!s.split||t<turn.next)return;
    if(m.active&&Math.abs(s.hz-m.rx)<=70&&Math.abs(s.hz+s.split-m.tx)<=70)return;
    const callers=rivals.filter(r=>r.target===i);
    if(turn.phase==='idle'){
     if(busy.has(i)||!dx.signal.listening(t))return;
     busy.add(i);turn.phase='calling';turn.offer=undefined;
     for(const r of callers)r.voice.signal=r.voice.send(r.station.call,0,false);
     dx.signal=dx.send('E',.5,false);
    }else if(turn.phase==='calling'){
     if(turn.offer&&keyed)return;
     if(!callers.every(r=>r.voice.signal.finished(t)))return;
     const scores=callers.map(r=>copyLevel(r.station.power,r.station.hz-s.hz-s.split,signals.indexOf(r),t,p.qsb,p.qrn));
     turn.winner=scores[0]>=scores[1]?0:1;
     if(turn.offer){
      const {call,offset}=turn.offer;turn.offer=undefined;
      const level=copyLevel(.75*pathGain(s.path,p.hour),offset,i,t,p.qsb,p.qrn);
      if(level>=scores[turn.winner]){
       turn.phase='idle';turn.next=t+15;
       answer(dx,s,i,call,level<1.5||level<2*scores[turn.winner],t);
       return;
      }
      setFeedback('El DX ha copiado a otro operador. Espera su siguiente CQ.');
     }
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
   if(t-lastSpotScan>=.25){
    lastSpotScan=t;
    const visible=signals.filter(({station,voice},i)=>station!==ownStation&&station.hz>=low&&station.hz<=high&&
     (i<firstCaller||!voice.signal.finished(t)||rig.current?.activeCallers.some(idx=>stations[idx]===station)));
    const entries=visible.map(({station})=>({hz:station.hz,wpm:station.wpm})).sort((a,b)=>a.hz-b.hz);
    const signature=entries.map(s=>s.hz+'-'+s.wpm).join(',');
    if(signature!==spotSignature){spotSignature=signature;setSpots(entries)}
   }
   signals.forEach(({voice:v,station:s},i)=>{
    const manualTrace=s===ownStation&&m.active;
    const frequency=manualTrace?m.tx:s.hz;
    const offset=s===ownStation?0:s.hz-p.hz;
    const fade=s===ownStation?1:multipath(t,i,p.qsb)*pathGain(s.path,p.hour);
    const response=1/Math.sqrt(1+Math.pow(2*offset/p.width,8));
    v.osc.frequency.setTargetAtTime(Math.max(30,p.tone+offset),t,.012);
    v.gain.gain.setTargetAtTime((keyed&&s!==ownStation?0:p.volume)*s.power*fade*response,t,.012);
    const level=manualTrace?Number(m.down):v.signal.level(t);
    scope.signal((frequency-low)/(high-low),level*s.power*fade);
   });
   scope.draw();
  },25);
  return ()=>{clearInterval(timer);manual.current.active=false;manual.current.down=false;afterTx.current=null;partial.current=null;rig.current=null;signals.forEach(s=>s.voice.close());noise.stop();void ctx.close()};
 },[on]);
 function transmit(message=tx,fromPaddle=false){
  const hz=fromPaddle?manual.current.rx:props.hz;
  const txHz=fromPaddle?manual.current.tx:hz+(split?offset:0);
  const radio=rig.current;if(!radio)return;
  const words=message.trim().toUpperCase().split(/\s+/), own=call.trim().toUpperCase();
  const now=radio.ctx.currentTime;
  if(manual.current.active||afterTx.current||!radio.ownTx.signal.finished(now)){setFeedback('Tu estación está transmitiendo.');return}
  function sendThen(done:()=>void){
   if(!radio)return;
   if(fromPaddle){baseline.current=settings.current.decoded;done();return}
   radio.ownStation.hz=txHz;radio.ownStation.wpm=props.wpm;
   radio.ownTx.signal=radio.ownTx.send(words.join(' '),0,false);
   afterTx.current=done;setSending(true);setTx('');baseline.current=settings.current.decoded;
   setFeedback('TX · '+words.join(' '));
  }
  const query=words.join(' ')==='QRL?';
  if(query||words[0]==='CQ'){
   if(contact!==null||partial.current||radio.traffic.some(t=>t.offer)){setFeedback('Completa primero el intercambio en curso.');return}
   if(split){setFeedback('Desactiva split para llamar en simplex.');return}
   if(!query&&(!/^[A-Z0-9/]{3,12}$/.test(own)||!words.includes(own)||words[words.length-1]!=='K')){setFeedback('Envía CQ DE seguido de tu indicativo y K.');return}
   if(!query&&radio.occupied(hz)){setFeedback('Frecuencia ocupada. Busca un hueco en la banda.');return}
   for(const idx of radio.activeCallers){radio.stations[idx].hz=0}
   radio.activeCallers=[];
   sendThen(()=>{
    if(query){
     setFeedback(radio.occupied(hz)?'Frecuencia ocupada.':'Sin respuesta a QRL?. Puedes llamar CQ.');
     if(radio.occupied(hz)){const idx=radio.firstCaller;radio.stations[idx].hz=hz;radio.voices[idx].signal=radio.voices[idx].send('QRL',0,false)}
     return;
    }
    const count=Math.random()<.5?1:2;
    for(let n=0;n<count;n++){
     const idx=radio.firstCaller+n,caller=radio.stations[idx];
     caller.hz=hz+(n?(hz+40>high?-40:40):0);
     radio.voices[idx].signal=radio.voices[idx].send(own+' DE '+caller.call+' '+caller.call+' K',0,false);
     radio.activeCallers.push(idx);
    }
    setFeedback('Escucha quién te llama. Contesta con su indicativo, DE, tu indicativo y K. Para pedir una repetición, envía el prefijo seguido de ?.');
   });return;
  }
  const nearby=radio.activeCallers.filter(idx=>Math.abs(radio.stations[idx].hz-hz)<=70);
  if(contact===null&&!partial.current&&nearby.length&&/^[A-Z0-9]{1,6}\?$/.test(words.join(' '))){
   const matches=nearby.filter(idx=>radio.stations[idx].call.startsWith(words[0].slice(0,-1)));
   sendThen(()=>{
    for(const idx of matches)radio.voices[idx].signal=radio.voices[idx].send(radio.stations[idx].call+' K',0,false);
   setFeedback(matches.length?'Escucha la repetición.':'Sin respuesta a ese parcial.');
   });return;
  }
  const currentIndex=contact??partial.current?.index;
  const index=currentIndex!=null&&Math.abs(radio.stations[currentIndex].hz-hz)<=70?currentIndex:
   nearby.find(idx=>radio.stations[idx].call===words[0])??radio.stations.slice(0,radio.firstCaller).findIndex(s=>Math.abs(s.hz-hz)<=70);
  if(index<0){setFeedback('Sin respuesta. Afina la frecuencia y vuelve a llamar.');return}
  const station=radio.stations[index],v=radio.voices[index];
  if(Math.abs(txHz-station.hz-station.split)>70){setFeedback('Sin respuesta en TX. Escucha si anuncia UP y ajusta el desplazamiento.');return}
  const time=fromPaddle?manual.current.start:radio.ctx.currentTime, turn=radio.traffic[index], pending=partial.current;
  if(pending){
   if(index!==pending.index||own!==pending.call||!words.includes(pending.call)){setFeedback('Repite tu indicativo completo al corresponsal que pidió el parcial.');return}
   if(!v.signal.finished(time)){setFeedback('Espera a que termine la petición.');return}
   partial.current=null;sendThen(()=>answer(v,station,index,own,false,radio.ctx.currentTime));
  }else if(contact===null){
   const competing=turn.phase==='calling';
   if(radio.traffic.some(other=>other.offer)){setFeedback('Espera la respuesta del DX a tu llamada.');return}
   if(radio.busy.has(index)&&!competing){setFeedback('Está trabajando a otro operador. Espera el siguiente CQ.');return}
   if(!competing&&!(index>=radio.firstCaller?v.signal.finished(time):v.signal.listening(time))){setFeedback('La estación está transmitiendo. Espera el cambio.');return}
   if(!/^[A-Z0-9/]{3,12}$/.test(own)||words[0]!==station.call||words[1]!=='DE'||!words.slice(2,-1).includes(own)||!['K','KN'].includes(words[words.length-1]||'')){setFeedback('Sin respuesta. Comprueba los indicativos, DE y el cambio K.');return}
   const offset=txHz-station.hz-station.split;
   if(competing){
    turn.offer={call:own,offset};sendThen(()=>setFeedback('Escucha a quién responde el DX.'));
   }else{
    if(index>=radio.firstCaller){for(const idx of nearby)if(idx!==index)radio.stations[idx].hz=0;radio.activeCallers=[index]}
    radio.busy.add(index);
    v.signal=v.send('E',.5,false);
    sendThen(()=>answer(v,station,index,own,copyLevel(.75*pathGain(station.path,hour),offset,index,time,props.qsb,props.qrn)<1.5,radio.ctx.currentTime));
   }
  }else{
   if(index!==contact){setFeedback('Vuelve a la frecuencia del corresponsal.');return}
   if(!v.signal.listening(time)){setFeedback('Espera a que termine el reporte.');return}
   const request=words.join(' ').match(/^(RST|NAME|QTH)(?: AGN)?\?$/);
   if(request){
    const fields:Record<string,string>={RST:report.current,NAME:station.name,QTH:station.qth};
    v.signal=v.send('E',.5,false);
    sendThen(()=>{v.signal=v.send(request[1]+' '+fields[request[1]]+' KN');setFeedback('RX · Repetición del corresponsal.');});return;
   }
   const sent=words.find(w=>/^[1-5][1-9][1-9]$/.test(w));
   if(!sent){setFeedback('Envía tu RST o pide RST AGN?, NAME? o QTH?.');return}
   const entry={utc:hour,km:station.path.km,rx:hz,tx:txHz,call:station.call,sent,copy:copy.trim().toUpperCase(),expected:[report.current,station.name,station.qth].join(' ')};
   v.signal=v.send('E',.5,false);
   sendThen(()=>{
   const rows=[entry,...log];setLog(rows);
   try{localStorage.setItem('cw-band-log',JSON.stringify(rows));setStorageError(false)}catch{setStorageError(true)}
   v.signal=v.send(own+' TU 73 SK');
   const farewell=v.signal;
   const check=()=>{if(rig.current!==radio||v.signal!==farewell)return;if(farewell.listening(radio.ctx.currentTime)){if(index>=radio.firstCaller){station.hz=0;radio.activeCallers=radio.activeCallers.filter(i=>i!==index)}else v.signal=v.cq();radio.busy.delete(index)}else window.setTimeout(check,100)};
   window.setTimeout(check,100);
   setContact(null);setFeedback('QSO completado con '+station.call+'.');
   });
  }
  setTx('');baseline.current=settings.current.decoded;
 }
 return <section className="band"><div className="row"><h3>Banda de 40 m</h3><button onClick={()=>{setSpots([]);setOn(!on);setSending(false);setSplit(false);setMonitor(false);setContact(null);setFeedback('');setTx('');baseline.current=props.decoded}}>{on?'Cerrar banda':'Abrir banda'}</button></div>
 <p>Pulsa sobre un trazo para sintonizar. Afina con las flechas del VFO y escucha el indicativo antes de llamar.</p>
 <label className="scope-option"><input type="checkbox" checked={showSpeeds} onChange={e=>setShowSpeeds(e.target.checked)}/> Mostrar marcadores WPM</label>
 <div className="band-scope" onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();tune(Math.max(low,Math.min(high,Math.round(low+(e.clientX-r.left)/r.width*(high-low)))))}}>
 {on&&showSpeeds&&<div className="scope-markers" aria-label="Velocidades de las estaciones">{spots.map((s,i)=><span key={s.hz+'-'+s.wpm} style={{left:'clamp(25px, '+((s.hz-low)/(high-low)*100)+'%, calc(100% - 25px))',top:2+(i%3)*16}}>{s.wpm} WPM</span>)}</div>}
 <canvas key={on?'live':'idle'} ref={canvas} width="900" height="246" aria-label="Espectro y waterfall de la banda simulada"/><i style={{left:((split&&monitor?txHz:hz)-low)/(high-low)*100+'%',width:width/(high-low)*100+'%'}}/>{split&&txHz>=low&&txHz<=high&&<b className="tx-marker" style={{left:(txHz-low)/(high-low)*100+'%'}}>TX</b>}</div>
 <div className="band-scale"><span>7.024,0 kHz</span><span>7.026,5 kHz</span></div>
 <div className="scope-controls"><RadioKnob label="Ruido QRN" value={props.qrn} min={0} max={100} step={1} readout={props.qrn+'%'} change={props.setQrn}/><RadioKnob label="Desvanecimiento QSB" value={props.qsb} min={0} max={100} step={1} readout={props.qsb+'%'} change={props.setQsb}/> <fieldset className="radio-keys"><legend>Filtro CW</legend>{[100,250,500,1000].map(n=><button key={n} aria-pressed={width===n} onClick={()=>setWidth(n)}>{n} Hz</button>)}</fieldset>{props.children}</div>
 <details className="channel-options"><summary>Condiciones de propagación</summary>
 <label>Hora UTC simulada · {hour}:00<input type="range" min="0" max="23" value={hour} onChange={e=>setHour(+e.target.value)}/></label>
 <small>Receptor en Madrid · escenario de equinoccio. Cambia la hora para comparar los mismos trayectos.</small>
 <label><input type="checkbox" checked={storm} onChange={e=>setStorm(e.target.checked)}/> Tormenta · QRN impulsivo</label>
 </details>
 <label><input type="checkbox" checked={split} onChange={e=>setSplit(e.target.checked)}/> Split · TX independiente</label>
 {split&&<label>Desplazamiento TX +{offset} Hz · {txHz.toLocaleString('de-DE')} Hz<input type="range" min={0} max={1500} step={10} value={offset} onChange={e=>setOffset(+e.target.value)}/></label>}
 {split&&<label><input type="checkbox" checked={monitor} onChange={e=>setMonitor(e.target.checked)}/> Escuchar en la frecuencia TX</label>}

 {on&&<div className="band-paddles"><label><input type="checkbox" checked={direct} disabled={sending} onChange={e=>setDirect(e.target.checked)}/> Transmisión directa con paletas</label>{direct&&<><p>Manipula con tus teclas asignadas o con estas levas. Una pausa larga da el cambio automáticamente.</p><div className="row">{(['dit','dah'] as const).map(lever=><button key={lever} type="button" style={{touchAction:'none'}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);props.setLever(lever,true)}} onLostPointerCapture={()=>props.setLever(lever,false)}>{lever.toUpperCase()}</button>)}</div></>}</div>}
 {on&&<form onSubmit={e=>{e.preventDefault();transmit()}}><label>Indicativo de operador<input className="textinput" maxLength={12} value={call} onChange={e=>props.setCall(e.target.value.toUpperCase())}/></label><label>Llamada en frecuencia<input className="textinput" value={tx} onChange={e=>setTx(e.target.value.toUpperCase())} placeholder="Indicativo DE tu indicativo K"/></label><div className="row"><button disabled={sending||!tx.trim()}>Transmitir</button><button type="button" disabled={sending} onClick={()=>transmit('QRL?')}>QRL?</button><button type="button" disabled={sending} onClick={()=>transmit('CQ CQ DE '+call.trim().toUpperCase()+' K')}>Llamar CQ</button><button type="button" onClick={()=>setTx(props.decoded.startsWith(baseline.current)?props.decoded.slice(baseline.current.length).trim():props.decoded)}>Capturar paletas</button></div></form>}
 {contact!==null&&<label>Copia del intercambio (RST, nombre y QTH)<input className="textinput" value={copy} onChange={e=>setCopy(e.target.value)} placeholder="Puedes pedir RST AGN?, NAME? o QTH?"/></label>}
 {log.length>0&&<details><summary>Libro de guardia · {log.length}</summary>{storageError&&<p>El navegador solo ha conservado esta entrada en memoria.</p>}{log.map((r,i)=><p key={i}><strong>{r.call}</strong> · {r.utc}:00 UTC · {r.km} km · RX {r.rx} / TX {r.tx} Hz · RST enviado {r.sent}<br/>Tu copia: {r.copy||'—'} · Transmitido: {r.expected}</p>)}</details>}
 <p role="status">{feedback}</p></section>;
}
