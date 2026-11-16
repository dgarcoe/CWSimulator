import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {playCw,type Playback} from './cwPlayback';

type Lever = 'dit'|'dah';
const KOCH='KMRSUAPTLOWI.NJEF0YVG5/Q9ZH38B?427C1D6X'.replace(/[^A-Z0-9]/g,'');
const MORSE: Record<string,string> = {'.-':'A','-...':'B','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G','....':'H','..':'I','.---':'J','-.-':'K','.-..':'L','--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R','...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y','--..':'Z','-----':'0','.----':'1','..---':'2','...--':'3','....-':'4','.....':'5','-....':'6','--...':'7','---..':'8','----.':'9'};
function App(){
 const [rawSymbols,setRawSymbols]=useState('');
 const [page,setPage]=useState<'academy'|'radio'|'hardware'>('academy');
 const [wpm,setWpm]=useState(20),[tone,setTone]=useState(700),[volume,setVolume]=useState(.2),[mode,setMode]=useState<'A'|'B'>('B');
 const [status,setStatus]=useState('Sin conectar'),[events,setEvents]=useState<string[]>([]),[decoded,setDecoded]=useState(''),[keys,setKeys]=useState<Record<Lever,boolean>>({dit:false,dah:false});
 const [lesson,setLesson]=useState(()=>{try{return Math.max(2,Math.min(KOCH.length,Number(localStorage.getItem('cw-lesson'))||2))}catch{return 2}}),[trainingMode,setTrainingMode]=useState<'receive'|'send'>('receive'),[trainingWpm,setTrainingWpm]=useState(20),[effectiveWpm,setEffectiveWpm]=useState(8),[target,setTarget]=useState(''),[answer,setAnswer]=useState(''),[trainingResult,setTrainingResult]=useState(''),[correct,setCorrect]=useState(0),[attempts,setAttempts]=useState(0);
 const [history,setHistory]=useState<{mode:string;lesson:number;score:number;target?:string;actual?:string;date?:string}[]>(()=>{try{return JSON.parse(localStorage.getItem('cw-academy-history')||'[]')}catch{return []}});
 const [autoAdvance,setAutoAdvance]=useState(true);
 const [exerciseChecked,setExerciseChecked]=useState(false);
 useEffect(()=>{localStorage.setItem('cw-lesson',String(lesson))},[lesson]);
 useEffect(()=>{localStorage.setItem('cw-academy-history',JSON.stringify(history))},[history]);
 const [weaknesses,setWeaknesses]=useState<Record<string,number>>(()=>{try{return JSON.parse(localStorage.getItem('cw-weaknesses')||'{}')}catch{return {}}});
 useEffect(()=>{localStorage.setItem('cw-weaknesses',JSON.stringify(weaknesses))},[weaknesses]);
 const [rxMessage,setRxMessage]=useState('CQ CQ DE EA1TEST EA1TEST K'),[rxPlaying,setRxPlaying]=useState(false);
 const rxPlayback=useRef<Playback|null>(null),rxTimeout=useRef<number|undefined>(undefined);
 const [deviceInfo,setDeviceInfo]=useState(''),[qrn,setQrn]=useState(0),[qsb,setQsb]=useState(0);
 const [mapping,setMapping]=useState<Record<Lever,string>>(()=>{try{const v=JSON.parse(localStorage.getItem('cw-keyboard-map')||'null');if(v&&typeof v.dit==='string'&&typeof v.dah==='string')return v}catch{}return {dit:'KeyZ',dah:'KeyX'}});
 const [learning,setLearning]=useState<Lever|null>(null);
 useEffect(()=>{localStorage.setItem('cw-keyboard-map',JSON.stringify(mapping))},[mapping]);
 const audio=useRef<AudioContext|null>(null),osc=useRef<OscillatorNode|null>(null),gain=useRef<GainNode|null>(null);
 const down=useRef<Record<Lever,boolean>>({dit:false,dah:false}),last=useRef<Lever>('dah'),timer=useRef<number|undefined>(undefined),running=useRef(false),sounding=useRef(false),pending=useRef<Record<Lever,boolean>>({dit:false,dah:false}),squeezed=useRef(false),extra=useRef<Lever|null>(null),sequence=useRef(''),letterTimer=useRef<number|undefined>(undefined),wordTimer=useRef<number|undefined>(undefined),wpmRef=useRef(wpm),modeRef=useRef(mode),volumeRef=useRef(volume),toneRef=useRef(tone);
 useEffect(()=>{wpmRef.current=wpm;modeRef.current=mode;volumeRef.current=volume;toneRef.current=tone;gain.current?.gain.setTargetAtTime(sounding.current?volume:0,audio.current!.currentTime,.01);osc.current?.frequency.setTargetAtTime(tone,audio.current!.currentTime,.01)},[wpm,mode,volume,tone]);
 function log(s:string){setEvents(p=>[new Date().toLocaleTimeString()+' '+s,...p].slice(0,40))}
 async function initAudio(){if(!audio.current){const ctx=new AudioContext();const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=toneRef.current;g.gain.value=0;o.connect(g).connect(ctx.destination);o.start();audio.current=ctx;osc.current=o;gain.current=g}await audio.current.resume()}
 function sidetone(on:boolean){sounding.current=on;const c=audio.current,g=gain.current;if(c&&g)g.gain.setTargetAtTime(on?volumeRef.current:0,c.currentTime,.003)}
 function flushLetter(){if(!sequence.current)return;const pattern=sequence.current;const char=MORSE[pattern]||'?';setRawSymbols(pattern);setDecoded(p=>p+char);sequence.current=''}
 function newExercise(){
  stopStation();
  const pool=KOCH.slice(0,lesson);
  const sample=Array.from({length:5},()=>{const weights=pool.split('').map(ch=>1+Math.min(6,weaknesses[ch]||0));const total=weights.reduce((a,b)=>a+b,0);let draw=Math.random()*total;return pool.split('').find((ch,i)=>(draw-=weights[i])<0)||pool[pool.length-1]}).join('');
  setTarget(sample);setAnswer('');setTrainingResult('');setExerciseChecked(false);
  if(trainingMode==='send'){sequence.current='';setDecoded('');window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current)}
  else void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,sample,trainingWpm,toneRef.current,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)});
 }
 function replayExercise(){if(!target)return;stopStation();void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,target,trainingWpm,toneRef.current,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)})}
 function checkExercise(){
  if(!target||exerciseChecked)return;
  const actual=(trainingMode==='receive'?answer:decoded).replace(/\s/g,'').toUpperCase();
  const count=Array.from(target).filter((ch,i)=>ch===actual[i]).length;
  const score=Math.round(100*count/Math.max(target.length,actual.length));
  setAttempts(p=>p+1);if(score===100)setCorrect(p=>p+1);setExerciseChecked(true);
  const updated=[...history,{mode:trainingMode,lesson,score,target,actual,date:new Date().toISOString()}].slice(-100);
  setHistory(updated);
  setWeaknesses(prev=>{const next={...prev};for(let i=0;i<target.length;i++){const ch=target[i];next[ch]=Math.max(0,(next[ch]||0)+(actual[i]===ch?-0.25:1))}return next});
  const recent=updated.filter(h=>h.lesson===lesson&&h.mode===trainingMode).slice(-10);
  if(autoAdvance&&recent.length===10&&recent.reduce((a,h)=>a+h.score,0)/10>=90&&lesson<KOCH.length){setLesson(p=>p+1);setTrainingResult('Lección superada. Nuevo carácter desbloqueado. '+score+'% · esperado: '+target+' · recibido: '+(actual||'—'));return}
  setTrainingResult(score+'% de coincidencia · esperado: '+target+' · recibido: '+(actual||'—'));
 }
 function scheduleSpacing(dot:number){
  window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);
  letterTimer.current=window.setTimeout(flushLetter,dot*3);
  wordTimer.current=window.setTimeout(()=>{flushLetter();setDecoded(p=>p&&!p.endsWith(' ')?p+' ':p)},dot*7);
 }
 async function transmitStation(){
  await initAudio();
  rxPlayback.current?.stop();window.clearTimeout(rxTimeout.current);
  rxPlayback.current=playCw(audio.current!,rxMessage,wpmRef.current,toneRef.current+110,Math.min(.35,volumeRef.current));
  setRxPlaying(true);
  rxTimeout.current=window.setTimeout(()=>{setRxPlaying(false);rxPlayback.current=null},(rxPlayback.current.duration+.15)*1000);
 }
 function stopStation(){rxPlayback.current?.stop();rxPlayback.current=null;window.clearTimeout(rxTimeout.current);setRxPlaying(false)}
 function next(){
  const active=down.current;
  const remembered=pending.current;
  let lever:Lever|null=null;
  if(extra.current){lever=extra.current;extra.current=null}
  else if(active.dit&&active.dah)lever=last.current==='dit'?'dah':'dit';
  else if(remembered.dit&&remembered.dah)lever=last.current==='dit'?'dah':'dit';
  else if(remembered.dit||remembered.dah)lever=remembered.dit?'dit':'dah';
  else if(active.dit||active.dah)lever=active.dit?'dit':'dah';
  if(!lever){running.current=false;sidetone(false);return}
  running.current=true;
  window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);
  pending.current[lever]=false;
  last.current=lever;
  const dot=1200/wpmRef.current;
  const duration=lever==='dit'?dot:dot*3;
  sidetone(true);
  sequence.current+=lever==='dit'?'.':'-';
  timer.current=window.setTimeout(()=>{
   sidetone(false);
   scheduleSpacing(dot);
   timer.current=window.setTimeout(next,dot);
  },duration);
 }
 function setLever(lever:Lever,pressed:boolean){
  if(down.current[lever]===pressed)return;
  down.current[lever]=pressed;
  setKeys({...down.current});
  log(lever.toUpperCase()+' '+(pressed?'DOWN':'UP'));
  if(pressed){
   pending.current[lever]=true;
   if(down.current.dit&&down.current.dah)squeezed.current=true;
   if(!running.current){running.current=true;void initAudio().then(()=>{if(running.current)next()}).catch(()=>{running.current=false})}
  }else if(!down.current.dit&&!down.current.dah){
   if(squeezed.current&&modeRef.current==='B'&&running.current){
    extra.current=last.current==='dit'?'dah':'dit';
   }
   squeezed.current=false;
  }
 }
 const leverRef=useRef(setLever);leverRef.current=setLever;
 useEffect(()=>{const pressed=new Map<string,Lever>();function kd(e:KeyboardEvent){if(learning){e.preventDefault();if(e.repeat)return;setMapping(prev=>({...prev,[learning]:e.code}));setLearning(null);log('Asignada '+learning.toUpperCase()+' a '+e.code);return}const k:Lever|undefined=e.code===mapping.dit?'dit':e.code===mapping.dah?'dah':undefined;if(k){e.preventDefault();if(!pressed.has(e.code)){pressed.set(e.code,k);leverRef.current(k,true)}}}function ku(e:KeyboardEvent){const k=pressed.get(e.code);if(k){e.preventDefault();pressed.delete(e.code);leverRef.current(k,false)}}function blur(){pressed.clear();leverRef.current('dit',false);leverRef.current('dah',false)}window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);return()=>{blur();window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur)}},[mapping,learning]);
 async function connectSerial(){try{const nav=navigator as Navigator&{serial?:{requestPort:()=>Promise<any>}};if(!nav.serial){setStatus('Web Serial no disponible');return}const port=await nav.serial.requestPort();const info=port.getInfo();setDeviceInfo('USB serie VID '+info.usbVendorId+' PID '+info.usbProductId);setStatus('Puerto seleccionado; protocolo pendiente de identificar');log('Puerto serie seleccionado. No se envían comandos ni se abre el puerto sin conocer el protocolo.')}catch(e){setStatus('Serie: '+String(e))}}
 async function connectHid(){try{const nav=navigator as Navigator&{hid?:{requestDevice:(o:{filters:object[]})=>Promise<any[]>}};if(!nav.hid){setStatus('WebHID no disponible');return}const devices=await nav.hid.requestDevice({filters:[]});if(!devices.length)return;const d=devices[0];setDeviceInfo(d.productName+' VID '+d.vendorId+' PID '+d.productId);setStatus('HID identificado; falta asignar bits de las levas');log('HID seleccionado: '+d.productName)}catch(e){setStatus('HID: '+String(e))}}
 useEffect(()=>()=>{window.clearTimeout(timer.current);window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);window.clearTimeout(rxTimeout.current);rxPlayback.current?.stop();void audio.current?.close()},[]);
 return <main className="app-shell">
  <aside className="sidebar">
   <div className="identity"><div className="mark">CW</div><div><strong>CW / LAB</strong><small>RECEPCIÓN · TRANSMISIÓN</small></div></div>
   <p className="nav-caption">ESTACIÓN DE APRENDIZAJE</p>
   <nav aria-label="Navegación principal">
    <button className={page==='academy'?'nav-item selected':'nav-item'} onClick={()=>setPage('academy')}><span>01</span> Academia</button>
    <button className={page==='radio'?'nav-item selected':'nav-item'} onClick={()=>setPage('radio')}><span>02</span> Estación</button>
    <button className={page==='hardware'?'nav-item selected':'nav-item'} onClick={()=>setPage('hardware')}><span>03</span> Manipulador</button>
   </nav>
   <div className="sidebar-bottom"><div className="live-dot"/> OPERACIÓN LOCAL <p>Una estación para aprender a escuchar antes de contar.</p></div>
  </aside>
  <div className="workspace">
   <header className="topbar"><div><span className="eyebrow">CW LAB / {page==='academy'?'ACADEMIA':page==='radio'?'ESTACIÓN':'HARDWARE'}</span><h1>{page==='academy'?'Entrena el oído.':page==='radio'?'En el aire.':'Tu manipulador.'}</h1><p>{page==='academy'?'Reconoce el ritmo, no los signos.':page==='radio'?'Prueba el receptor y la transmisión CW.':'Configura las levas una sola vez.'}</p></div><div className="topbar-meta"><span className="status-light"/> {wpm} WPM <span className="separator">/</span> {tone} Hz</div></header>
   {page==='academy'&&<div className="content-grid">
    <section className="panel hero-panel">
     <div className="panel-kicker">01 / ENTRENAMIENTO</div><h2>Aprender escuchando</h2><p className="muted">Koch + Farnsworth. Cada carácter conserva su sonido natural, con pausas más largas al principio.</p>
     <div className="mode-switch"><button className={trainingMode==='receive'?'chosen':''} onClick={()=>{stopStation();setTrainingMode('receive');setTarget('');setTrainingResult('')}}>◉ Escucha</button><button className={trainingMode==='send'?'chosen':''} onClick={()=>{stopStation();setTrainingMode('send');setTarget('');setTrainingResult('')}}>⌁ Transmisión</button></div>
     <div className="exercise">
      <span className="eyebrow">{trainingMode==='receive'?'RECEPCIÓN / 5 CARACTERES':'ENVÍO / 5 CARACTERES'}</span>
      <div className="exercise-target">{!target?'LISTO':trainingMode==='receive'?'♫  ♫  ♫':target}</div>
      <p className="muted">{!target?'Prepara tus auriculares y empieza una sesión.':trainingMode==='receive'?'Escucha el grupo completo y escribe lo que has reconocido.':'Transmite el grupo con tus paletas; luego comprueba el resultado.'}</p>
      {target&&trainingMode==='receive'&&<input className="textinput answer" aria-label="Respuesta escuchada" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value.toUpperCase())} maxLength={10} placeholder="Escribe lo que escuchas"/>}
      <div className="row"><button className="primary" onClick={newExercise}>{target?'Siguiente grupo':'Empezar ejercicio'}</button>{target&&trainingMode==='receive'&&<button onClick={replayExercise}>Repetir sonido</button>}{target&&<button onClick={checkExercise} disabled={exerciseChecked}>Comprobar</button>}</div>
      {trainingResult&&<p className="result" role="status">{trainingResult}</p>}
     </div>
    </section>
    <section className="panel settings-panel"><div className="panel-kicker">02 / AJUSTES DE LA SESIÓN</div><h2>Tu ritmo</h2>
     <label>Lección Koch <b>{lesson} / {KOCH.length}</b><input type="range" min="2" max={KOCH.length} value={lesson} onChange={e=>setLesson(+e.target.value)}/></label>
     <p className="character-set">CARACTERES ACTIVOS<br/><strong>{KOCH.slice(0,lesson).split('').join('  ')}</strong></p>
     <label>Velocidad del carácter <b>{trainingWpm} WPM</b><input type="range" min="15" max="35" value={trainingWpm} onChange={e=>setTrainingWpm(+e.target.value)}/></label>
     <label>Velocidad efectiva <b>{Math.min(effectiveWpm,trainingWpm)} WPM</b><input type="range" min="5" max={trainingWpm} value={Math.min(effectiveWpm,trainingWpm)} onChange={e=>setEffectiveWpm(+e.target.value)}/></label>
     <label className="checkbox-label"><input type="checkbox" checked={autoAdvance} onChange={e=>setAutoAdvance(e.target.checked)}/> Avanzar automáticamente tras 10 ejercicios con ≥90% de media</label><p className="fineprint">Consejo: mantén 20 WPM de carácter y empieza con 8 WPM efectivos. Sube de lección tras alcanzar un 90% de precisión de forma consistente.</p>
    </section>
    <section className="panel full-width"><div className="panel-kicker">03 / TU PROGRESO</div><div className="stats"><div><strong>{history.length}</strong><span>Ejercicios registrados</span></div><div><strong>{history.length?Math.round(history.reduce((sum,h)=>sum+h.score,0)/history.length):'—'}{history.length?'%':''}</strong><span>Precisión media</span></div><div><strong>{history.slice(-10).length?Math.round(history.slice(-10).reduce((sum,h)=>sum+h.score,0)/history.slice(-10).length)+'%':'—'}</strong><span>Últimos diez</span></div></div><p className="fineprint">Los caracteres con más errores aparecen con mayor frecuencia en nuevos ejercicios. El historial se conserva en este navegador. Puedes activar o desactivar el avance automático.</p></section>
   </div>}
   {page==='radio'&&<div className="content-grid">
    <section className="panel"><div className="panel-kicker">01 / TRANSCEPTOR</div><h2>Banco de radio</h2><div className="frequency"><span>VFO A · CW</span><strong>7.025.000 <small>Hz</small></strong><span>RX · {tone} Hz · {wpm} WPM</span></div>
     <label>Velocidad <b>{wpm} WPM</b><input type="range" min="10" max="40" value={wpm} onChange={e=>setWpm(+e.target.value)}/></label><label>Tono <b>{tone} Hz</b><input type="range" min="400" max="900" step="25" value={tone} onChange={e=>setTone(+e.target.value)}/></label><label>Volumen <b>{Math.round(volume*100)}%</b><input type="range" min="0" max=".6" step=".01" value={volume} onChange={e=>setVolume(+e.target.value)}/></label><label>Modo iámbico<select value={mode} onChange={e=>setMode(e.target.value as 'A'|'B')}><option>A</option><option>B</option></select></label><button onClick={()=>void initAudio()}>Activar audio</button>
    </section>
    <section className="panel"><div className="panel-kicker">02 / ESTACIÓN REMOTA</div><h2>Escucha una llamada</h2><p className="muted">Una estación transmite un mensaje de prueba. Todavía no responde a tu indicativo.</p><label>Mensaje CW<input className="textinput" value={rxMessage} onChange={e=>setRxMessage(e.target.value.toUpperCase())} maxLength={100}/></label><div className="row"><button className="primary" disabled={rxPlaying} onClick={()=>void transmitStation()}>Escuchar CQ</button><button disabled={!rxPlaying} onClick={stopStation}>Detener</button></div>
     <div className="panel-kicker space-top">PROPAGACIÓN · PRÓXIMAMENTE</div><p className="muted">QRN y QSB todavía no modifican el sonido.</p><label>QRN <b>{qrn}%</b><input type="range" value={qrn} onChange={e=>setQrn(+e.target.value)}/></label><label>QSB <b>{qsb}%</b><input type="range" value={qsb} onChange={e=>setQsb(+e.target.value)}/></label>
    </section>
    <section className="panel full-width"><div className="panel-kicker">03 / TU TRANSMISIÓN</div><h2>Texto recibido del manipulador</h2><div className="decoded">{decoded||'A la espera de una transmisión…'}</div><p className="fineprint">Último carácter: {rawSymbols?rawSymbols.length+' elementos detectados':'sin datos'} · O = 3 rayas; 0 = 5 rayas. Si aparece O al transmitir 0, comprueba que el keyer ha generado las cinco rayas antes de soltar la leva.</p><div className="row"><button onClick={()=>{sequence.current='';window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);setDecoded('');setRawSymbols('')}}>Limpiar texto</button><button onClick={()=>setPage('hardware')}>Configurar paletas</button></div></section>
   </div>}
   {page==='hardware'&&<div className="content-grid">
    <section className="panel"><div className="panel-kicker">01 / MAPEO</div><h2>Aprendizaje de teclas</h2><p className="muted">Selecciona una leva y púlsala en tu manipulador. El navegador guardará el código de tecla.</p><div className="mapping"><button onClick={()=>setLearning('dit')}>{learning==='dit'?'Pulsa la leva…':'Aprender DIT'}<small>{mapping.dit}</small></button><button onClick={()=>setLearning('dah')}>{learning==='dah'?'Pulsa la leva…':'Aprender DAH'}<small>{mapping.dah}</small></button></div><button onClick={()=>setMapping(p=>({dit:p.dah,dah:p.dit}))}>Intercambiar levas</button>{mapping.dit===mapping.dah&&<p role="alert">Las dos levas usan la misma tecla.</p>}
    </section>
    <section className="panel"><div className="panel-kicker">02 / PRUEBA</div><h2>Estado de las paletas</h2><p className="muted">Puedes pulsar los botones con el ratón o utilizar el manipulador USB.</p><div className="paddles"><button className={keys.dit?'active':''} onPointerDown={()=>setLever('dit',true)} onPointerUp={()=>setLever('dit',false)} onPointerLeave={()=>setLever('dit',false)}>DIT<span>·</span></button><button className={keys.dah?'active':''} onPointerDown={()=>setLever('dah',true)} onPointerUp={()=>setLever('dah',false)} onPointerLeave={()=>setLever('dah',false)}>DAH<span>—</span></button></div><div className="decoded">{decoded||'Esperando…'}</div><p className="fineprint">Último carácter: {rawSymbols?rawSymbols.length+' elementos':'—'} · 0 requiere cinco rayas.</p>
    </section>
    <section className="panel"><div className="panel-kicker">03 / OTROS PROTOCOLOS</div><h2>Identificación USB</h2><p className="muted">La detección HID y serie identifica dispositivos, pero la lectura de sus datos aún está pendiente.</p><div className="row"><button onClick={connectSerial}>Buscar USB serie</button><button onClick={connectHid}>Buscar USB HID</button></div><p><b>{status}</b></p><p className="muted">{deviceInfo}</p></section>
    <section className="panel"><div className="panel-kicker">04 / DIAGNÓSTICO</div><h2>Eventos recientes</h2><div className="log">{events.length?events.map((e,i)=><div key={i}>{e}</div>):'Sin eventos'}</div></section>
   </div>}
   <footer>CW SIMULATOR <span>PROTOTIPO LOCAL / SIN TRANSMISIÓN RF</span></footer>
  </div>
 </main>
}
createRoot(document.getElementById('root')!).render(<App/>);
