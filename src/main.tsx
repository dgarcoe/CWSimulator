import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {playCw,type Playback} from './cwPlayback';

type Lever = 'dit'|'dah';
const KOCH='KMRSUAPTLOWI.NJEF0YVG5/Q9ZH38B?427C1D6X'.replace(/[^A-Z0-9]/g,'');
const MORSE: Record<string,string> = {'.-':'A','-...':'B','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G','....':'H','..':'I','.---':'J','-.-':'K','.-..':'L','--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R','...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y','--..':'Z','-----':'0','.----':'1','..---':'2','...--':'3','....-':'4','.....':'5','-....':'6','--...':'7','---..':'8','----.':'9'};
function App(){
 const [wpm,setWpm]=useState(20),[tone,setTone]=useState(700),[volume,setVolume]=useState(.2),[mode,setMode]=useState<'A'|'B'>('B');
 const [status,setStatus]=useState('Sin conectar'),[events,setEvents]=useState<string[]>([]),[decoded,setDecoded]=useState(''),[keys,setKeys]=useState<Record<Lever,boolean>>({dit:false,dah:false});
 const [lesson,setLesson]=useState(2),[trainingMode,setTrainingMode]=useState<'receive'|'send'>('receive'),[trainingWpm,setTrainingWpm]=useState(20),[effectiveWpm,setEffectiveWpm]=useState(8),[target,setTarget]=useState(''),[answer,setAnswer]=useState(''),[trainingResult,setTrainingResult]=useState(''),[correct,setCorrect]=useState(0),[attempts,setAttempts]=useState(0);
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
 function flushLetter(){if(!sequence.current)return;const char=MORSE[sequence.current]||'?';setDecoded(p=>p+char);sequence.current=''}
 function newExercise(){
  stopStation();
  const pool=KOCH.slice(0,lesson);
  const sample=Array.from({length:5},()=>pool[Math.floor(Math.random()*pool.length)]).join('');
  setTarget(sample);setAnswer('');setTrainingResult('');
  if(trainingMode==='send'){sequence.current='';setDecoded('');window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current)}
  else void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,sample,trainingWpm,toneRef.current,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)});
 }
 function replayExercise(){if(!target)return;stopStation();void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,target,trainingWpm,toneRef.current,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)})}
 function checkExercise(){
  const actual=(trainingMode==='receive'?answer:decoded).replace(/\s/g,'').toUpperCase();
  const count=Array.from(target).filter((ch,i)=>ch===actual[i]).length;
  const score=Math.round(100*count/Math.max(target.length,actual.length));
  setAttempts(p=>p+1);if(score===100)setCorrect(p=>p+1);
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
 return <main><header><div><small>AMATEUR RADIO · HARDWARE LAB</small><h1>CW Simulator <span>v0.1</span></h1><p>Diagnóstico USB y banco de pruebas para paletas iámbicas</p></div><span className="pill">LOCAL · SIN SERVIDOR</span></header><section className="grid"><article><h2>Transceptor virtual</h2><div className="display"><small>VFO A · CW</small><strong>7.025.000 <em>Hz</em></strong><p>RX · Sidetone {tone} Hz · {wpm} WPM</p></div><label>Velocidad: {wpm} WPM<input type="range" min="10" max="40" value={wpm} onChange={e=>setWpm(+e.target.value)}/></label><label>Tono: {tone} Hz<input type="range" min="400" max="900" step="25" value={tone} onChange={e=>setTone(+e.target.value)}/></label><label>Volumen: {Math.round(volume*100)}%<input type="range" min="0" max=".6" step=".01" value={volume} onChange={e=>setVolume(+e.target.value)}/></label><label>Modo iámbico<select value={mode} onChange={e=>setMode(e.target.value as 'A'|'B')}><option>A</option><option>B</option></select></label><div className="row"><button onClick={()=>void initAudio()}>Activar audio</button><button onClick={()=>{sequence.current='';window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);setDecoded('')}}>Limpiar texto</button></div></article><article><h2>Interfaz USB</h2><p className="muted">Primero prueba si el adaptador actúa como teclado: Z / X o Ctrl izquierdo / derecho. Para otros protocolos, identifica el dispositivo.</p><div className="row"><button onClick={connectSerial}>Buscar USB serie</button><button onClick={connectHid}>Buscar USB HID</button></div><p><b>Estado:</b> {status}</p><p className="muted">{deviceInfo}</p><h3>Configuración de teclado USB</h3><p className="muted">Asigna cada leva pulsando el botón y después la paleta. Se guarda en este navegador. Se detecta el código físico de la tecla, no el carácter impreso.</p><div className="row"><button onClick={()=>setLearning('dit')}>{learning==='dit'?'Pulsa ahora DIT…':'Aprender DIT'} ({mapping.dit})</button><button onClick={()=>setLearning('dah')}>{learning==='dah'?'Pulsa ahora DAH…':'Aprender DAH'} ({mapping.dah})</button><button onClick={()=>setMapping(p=>({dit:p.dah,dah:p.dit}))}>Intercambiar</button></div>{mapping.dit===mapping.dah&&<p role="alert">DIT y DAH tienen la misma tecla. Configura dos distintas.</p>}<h3>Estado de las levas</h3><div className="row"><button className={keys.dit?'active':''} onPointerDown={()=>setLever('dit',true)} onPointerUp={()=>setLever('dit',false)} onPointerLeave={()=>setLever('dit',false)}>● DIT</button><button className={keys.dah?'active':''} onPointerDown={()=>setLever('dah',true)} onPointerUp={()=>setLever('dah',false)} onPointerLeave={()=>setLever('dah',false)}>━ DAH</button></div><p className="muted">Botones táctiles y teclas Z/X disponibles para probar sin hardware.</p><h3>Texto decodificado (experimental)</h3><div className="display output">{decoded||'Esperando transmisión…'}</div></article></section><section className="grid"><article><h2>Academia CW · Koch + Farnsworth</h2><p className="muted">Aprende a reconocer el sonido completo de cada carácter. Los patrones de puntos y rayas no se muestran durante el ejercicio.</p><label>Modalidad<select value={trainingMode} onChange={e=>{setTrainingMode(e.target.value as 'receive'|'send');setTarget('');setTrainingResult('')}}><option value="receive">Escucha</option><option value="send">Transmisión con paletas</option></select></label><label>Lección Koch: {lesson} caracteres<input type="range" min="2" max={KOCH.length} value={lesson} onChange={e=>setLesson(+e.target.value)}/></label><p className="muted">Caracteres disponibles: {KOCH.slice(0,lesson).split('').join(' ')}</p><label>Velocidad de carácter: {trainingWpm} WPM<input type="range" min="15" max="35" value={trainingWpm} onChange={e=>setTrainingWpm(+e.target.value)}/></label><label>Velocidad efectiva: {Math.min(effectiveWpm,trainingWpm)} WPM<input type="range" min="5" max={trainingWpm} value={Math.min(effectiveWpm,trainingWpm)} onChange={e=>setEffectiveWpm(+e.target.value)}/></label><div className="row"><button onClick={newExercise}>Nuevo ejercicio</button>{trainingMode==='receive'&&<button onClick={replayExercise} disabled={!target}>Repetir audio</button>}</div>{target&&<><p><b>{trainingMode==='receive'?'Escucha y escribe los cinco caracteres':'Transmite con las paletas: '+target}</b></p>{trainingMode==='receive'?<input className="textinput" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value.toUpperCase())} maxLength={10} placeholder="Lo que has escuchado"/>:<p className="muted">Se evaluará el texto que aparece en el decodificador de transmisión.</p>}<button onClick={checkExercise}>Comprobar</button></>}{trainingResult&&<p role="status">{trainingResult}</p>}<p className="muted">Ejercicios perfectos: {correct}/{attempts}. Avanza de lección cuando tengas al menos un 90% de acierto sostenido.</p></article><article><h2>Estación virtual · recepción CW</h2><p className="muted">Primera prueba de recepción: una estación transmite un mensaje Morse audible. Todavía no responde automáticamente a tu indicativo.</p><label>Mensaje de la estación<input className="textinput" value={rxMessage} onChange={e=>setRxMessage(e.target.value.toUpperCase())} maxLength={100}/></label><div className="row"><button disabled={rxPlaying} onClick={()=>void transmitStation()}>Escuchar transmisión</button><button disabled={!rxPlaying} onClick={stopStation}>Detener</button></div><p className="muted">Velocidad de recepción: {wpm} WPM · frecuencia de audio: {tone+110} Hz</p></article><article><h2>Canal HF · preparación</h2><p className="muted">Parámetros reservados para el motor de propagación. Aún no afectan al audio.</p><label>QRN {qrn}%<input type="range" value={qrn} onChange={e=>setQrn(+e.target.value)}/></label><label>QSB {qsb}%<input type="range" value={qsb} onChange={e=>setQsb(+e.target.value)}/></label></article><article><h2>Registro de eventos</h2><div className="log">{events.length?events.map((e,i)=><div key={i}>{e}</div>):'Sin eventos'}</div></article></section><footer>Prototipo de diagnóstico · No transmite RF · El keyer y el decodificador requieren calibración y pruebas con hardware real.</footer></main>
}
createRoot(document.getElementById('root')!).render(<App/>);
