import React, {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {playCw,type Playback} from './cwPlayback';

type Lever = 'dit'|'dah';
const KOCH='KMRSUAPTLOWI.NJEF0YVG5/Q9ZH38B?427C1D6X'.replace(/[^A-Z0-9]/g,'');
const MORSE: Record<string,string> = {'.-':'A','-...':'B','-.-.':'C','-..':'D','.':'E','..-.':'F','--.':'G','....':'H','..':'I','.---':'J','-.-':'K','.-..':'L','--':'M','-.':'N','---':'O','.--.':'P','--.-':'Q','.-.':'R','...':'S','-':'T','..-':'U','...-':'V','.--':'W','-..-':'X','-.--':'Y','--..':'Z','-----':'0','.----':'1','..---':'2','...--':'3','....-':'4','.....':'5','-....':'6','--...':'7','---..':'8','----.':'9'};
function App(){
 const [palette,setPalette]=useState<'paper'|'slate'|'sand'>(()=>{const v=localStorage.getItem('cw-palette');return v==='paper'||v==='sand'?v:'slate'});
 const [trainingTone,setTrainingTone]=useState(()=>Number(localStorage.getItem('cw-training-tone'))||600);
 useEffect(()=>{localStorage.setItem('cw-palette',palette)},[palette]);
 useEffect(()=>{localStorage.setItem('cw-training-tone',String(trainingTone))},[trainingTone]);
 const [machineActive,setMachineActive]=useState(false),[machineChar,setMachineChar]=useState(''),[machineAttempts,setMachineAttempts]=useState(0),[machineHits,setMachineHits]=useState(0),[machineFeedback,setMachineFeedback]=useState('');
 const machineRef=useRef({active:false,char:'',busy:false});
 const [sessionSize,setSessionSize]=useState(10),[sessionRemaining,setSessionRemaining]=useState(0),[sessionScores,setSessionScores]=useState<number[]>([]);
 const [rawSymbols,setRawSymbols]=useState('');
 const [page,setPage]=useState<'academy'|'radio'|'hardware'>('academy');
 const [wpm,setWpm]=useState(20),[tone,setTone]=useState(700),[volume,setVolume]=useState(.2),[mode,setMode]=useState<'A'|'B'>('B');
 const [status,setStatus]=useState('Sin conectar'),[events,setEvents]=useState<string[]>([]),[decoded,setDecoded]=useState(''),[keys,setKeys]=useState<Record<Lever,boolean>>({dit:false,dah:false});
 const [lesson,setLesson]=useState(()=>{try{return Math.max(2,Math.min(KOCH.length,Number(localStorage.getItem('cw-lesson'))||2))}catch{return 2}}),[trainingMode,setTrainingMode]=useState<'receive'|'send'|'machine'>('receive'),[trainingWpm,setTrainingWpm]=useState(20),[effectiveWpm,setEffectiveWpm]=useState(8),[target,setTarget]=useState(''),[answer,setAnswer]=useState(''),[trainingResult,setTrainingResult]=useState(''),[correct,setCorrect]=useState(0),[attempts,setAttempts]=useState(0);
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
  else void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,sample,trainingWpm,trainingTone,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)});
 }
 function replayExercise(){if(!target)return;stopStation();void initAudio().then(()=>{rxPlayback.current=playCw(audio.current!,target,trainingWpm,trainingTone,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)})}
 function checkExercise(){
  if(!target||exerciseChecked)return;
  const actual=(trainingMode==='receive'?answer:decoded).replace(/\s/g,'').toUpperCase();
  const count=Array.from(target).filter((ch,i)=>ch===actual[i]).length;
  const score=Math.round(100*count/Math.max(target.length,actual.length));
  setAttempts(p=>p+1);if(score===100)setCorrect(p=>p+1);setExerciseChecked(true);
  const updated=[...history,{mode:trainingMode,lesson,score,target,actual,date:new Date().toISOString()}].slice(-100);
  setHistory(updated);
  if(sessionRemaining>0){setSessionScores(p=>[...p,score]);setSessionRemaining(p=>p-1)}
  setWeaknesses(prev=>{const next={...prev};for(let i=0;i<target.length;i++){const ch=target[i];next[ch]=Math.max(0,(next[ch]||0)+(actual[i]===ch?-0.25:1))}return next});
  const recent=updated.filter(h=>h.lesson===lesson&&h.mode===trainingMode).slice(-10);
  if(autoAdvance&&recent.length===10&&recent.reduce((a,h)=>a+h.score,0)/10>=90&&lesson<KOCH.length){setLesson(p=>p+1);setTrainingResult('Lección superada. Nuevo carácter desbloqueado. '+score+'% · esperado: '+target+' · recibido: '+(actual||'—'));return}
  setTrainingResult(score+'% de coincidencia · esperado: '+target+' · recibido: '+(actual||'—'));
 }
 function startSession(){setSessionScores([]);setSessionRemaining(sessionSize);newExercise()}
 function chooseMachineChar(){const pool=KOCH.slice(0,lesson);const weights=pool.split('').map(ch=>1+Math.min(8,weaknesses[ch]||0));let draw=Math.random()*weights.reduce((a,b)=>a+b,0);return pool.split('').find((ch,i)=>(draw-=weights[i])<0)||pool[pool.length-1]}
 async function soundMachine(ch:string){stopStation();await initAudio();rxPlayback.current=playCw(audio.current!,ch,trainingWpm,trainingTone,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>{setRxPlaying(false);rxPlayback.current=null},(rxPlayback.current!.duration+.15)*1000)}
 function startMachine(){const ch=chooseMachineChar();machineRef.current={active:true,char:ch,busy:false};setMachineActive(true);setMachineChar(ch);setMachineAttempts(0);setMachineHits(0);setMachineFeedback('Escucha y pulsa el carácter correspondiente.');void soundMachine(ch)}
 function stopMachine(){machineRef.current.active=false;setMachineActive(false);stopStation()}
 function answerMachine(value:string){
  const current=machineRef.current;if(!current.active||current.busy)return;
  const ch=value.toUpperCase();if(!/^[A-Z0-9]$/.test(ch))return;
  const correctAnswer=ch===current.char;setMachineAttempts(p=>p+1);
  if(correctAnswer){setMachineHits(p=>p+1);setMachineFeedback('Correcto · '+current.char);setWeaknesses(p=>({...p,[current.char]:Math.max(0,(p[current.char]||0)-.3)}));current.busy=true;
   window.setTimeout(()=>{if(!machineRef.current.active)return;const nextChar=chooseMachineChar();machineRef.current.char=nextChar;machineRef.current.busy=false;setMachineChar(nextChar);setMachineFeedback('Escucha el siguiente carácter.');void soundMachine(nextChar)},450);
  }else{setMachineFeedback(ch+' no es correcto. Vuelve a escuchar.');setWeaknesses(p=>({...p,[current.char]:(p[current.char]||0)+1}));void soundMachine(current.char)}
 }
 const confusions:Record<string,number>={};
 for(const h of history){if(!h.target||h.actual===undefined)continue;for(let i=0;i<h.target.length;i++){const expected=h.target[i],got=h.actual[i]||'∅';if(expected!==got){const key=expected+' → '+got;confusions[key]=(confusions[key]||0)+1}}}
 const topConfusions=Object.entries(confusions).sort((a,b)=>b[1]-a[1]).slice(0,8);
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
 const machineAnswerRef=useRef(answerMachine);machineAnswerRef.current=answerMachine;
 const leverRef=useRef(setLever);leverRef.current=setLever;
 useEffect(()=>{const pressed=new Map<string,Lever>();function kd(e:KeyboardEvent){if(machineRef.current.active&&!e.repeat&&/^[a-z0-9]$/i.test(e.key)&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){e.preventDefault();machineAnswerRef.current(e.key);return}if(learning){e.preventDefault();if(e.repeat)return;setMapping(prev=>({...prev,[learning]:e.code}));setLearning(null);log('Asignada '+learning.toUpperCase()+' a '+e.code);return}const k:Lever|undefined=e.code===mapping.dit?'dit':e.code===mapping.dah?'dah':undefined;if(k){e.preventDefault();if(!pressed.has(e.code)){pressed.set(e.code,k);leverRef.current(k,true)}}}function ku(e:KeyboardEvent){const k=pressed.get(e.code);if(k){e.preventDefault();pressed.delete(e.code);leverRef.current(k,false)}}function blur(){pressed.clear();leverRef.current('dit',false);leverRef.current('dah',false)}window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);window.addEventListener('blur',blur);return()=>{blur();window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);window.removeEventListener('blur',blur)}},[mapping,learning]);
 async function connectSerial(){try{const nav=navigator as Navigator&{serial?:{requestPort:()=>Promise<any>}};if(!nav.serial){setStatus('Web Serial no disponible');return}const port=await nav.serial.requestPort();const info=port.getInfo();setDeviceInfo('USB serie VID '+info.usbVendorId+' PID '+info.usbProductId);setStatus('Puerto seleccionado; protocolo pendiente de identificar');log('Puerto serie seleccionado. No se envían comandos ni se abre el puerto sin conocer el protocolo.')}catch(e){setStatus('Serie: '+String(e))}}
 async function connectHid(){try{const nav=navigator as Navigator&{hid?:{requestDevice:(o:{filters:object[]})=>Promise<any[]>}};if(!nav.hid){setStatus('WebHID no disponible');return}const devices=await nav.hid.requestDevice({filters:[]});if(!devices.length)return;const d=devices[0];setDeviceInfo(d.productName+' VID '+d.vendorId+' PID '+d.productId);setStatus('HID identificado; falta asignar bits de las levas');log('HID seleccionado: '+d.productName)}catch(e){setStatus('HID: '+String(e))}}
 useEffect(()=>()=>{window.clearTimeout(timer.current);window.clearTimeout(letterTimer.current);window.clearTimeout(wordTimer.current);window.clearTimeout(rxTimeout.current);rxPlayback.current?.stop();void audio.current?.close()},[]);
 const trend=history.slice(-24);
 const plotPoints=trend.map((h,i)=>`${30+(trend.length===1?0:i*600/(trend.length-1))},${160-h.score*1.35}`).join(' ');
 const weakTop=Object.entries(weaknesses).filter(([ch])=>KOCH.slice(0,lesson).includes(ch)).sort((a,b)=>b[1]-a[1]).slice(0,6);
 return <main className={'app-shell theme-'+palette}>
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
   <header className="topbar"><div><span className="eyebrow">CW LAB / {page==='academy'?'ACADEMIA':page==='radio'?'ESTACIÓN':'HARDWARE'}</span><h1>{page==='academy'?'Entrena el oído.':page==='radio'?'En el aire.':'Tu manipulador.'}</h1><p>{page==='academy'?'Reconoce el ritmo, no los signos.':page==='radio'?'Prueba el receptor y la transmisión CW.':'Configura las levas una sola vez.'}</p></div><div className="topbar-meta"><label className="theme-select">Apariencia <select aria-label="Apariencia" value={palette} onChange={e=>setPalette(e.target.value as 'paper'|'slate'|'sand')}><option value="paper">Papel</option><option value="slate">Pizarra</option><option value="sand">Arena</option></select></label></div></header>
   {page==='academy'&&<div className="content-grid">
    <section className="panel hero-panel">
     <div className="panel-kicker">01 / ENTRENAMIENTO</div><h2>Aprender escuchando</h2><p className="muted">Koch + Farnsworth. Cada carácter conserva su sonido natural, con pausas más largas al principio.</p>
     <div className="mode-switch"><button className={trainingMode==='receive'?'chosen':''} onClick={()=>{stopStation();stopMachine();setTrainingMode('receive');setTarget('');setTrainingResult('');setSessionRemaining(0)}}>◉ Escucha</button><button className={trainingMode==='send'?'chosen':''} onClick={()=>{stopStation();stopMachine();setTrainingMode('send');setTarget('');setTrainingResult('');setSessionRemaining(0)}}>⌁ Transmisión</button><button className={trainingMode==='machine'?'chosen':''} onClick={()=>{stopStation();setTrainingMode('machine');setTarget('');setTrainingResult('');setSessionRemaining(0)}}>MorseMachine</button></div>
     {trainingMode==='keyboard'?<div className="exercise"><span className="eyebrow">CW KEYBOARD / TEXTO A SONIDO</span><h3>Escribe y escucha</h3><p className="muted">Convierte lo que escribes en CW, manteniendo la velocidad y el tono de la Academia. Útil para escuchar indicativos y palabras completas.</p><textarea className="textinput" rows={3} maxLength={120} value={keyboardText} onChange={e=>setKeyboardText(e.target.value.toUpperCase())} aria-label="Texto a transmitir en CW"/><div className="row"><button className="primary" onClick={playKeyboard}>Reproducir CW</button><button disabled={!rxPlaying} onClick={stopStation}>Detener</button></div></div>:<div className="exercise">
      <span className="eyebrow">{trainingMode==='receive'?'RECEPCIÓN / 5 CARACTERES':'ENVÍO / 5 CARACTERES'}</span>
      <div className="exercise-target">{!target?'LISTO':trainingMode==='receive'?'♫  ♫  ♫':target}</div>
      <p className="muted">{!target?'Prepara tus auriculares y empieza una sesión.':trainingMode==='receive'?'Escucha el grupo completo y escribe lo que has reconocido.':'Transmite el grupo con tus paletas; luego comprueba el resultado.'}</p>
      {target&&trainingMode==='receive'&&<input className="textinput answer" aria-label="Respuesta escuchada" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value.toUpperCase())} maxLength={10} placeholder="Escribe lo que escuchas"/>}
      <div className="row"><button className="primary" onClick={newExercise}>{target?'Siguiente grupo':'Ejercicio libre'}</button>{target&&trainingMode==='receive'&&<button onClick={replayExercise}>Repetir sonido</button>}{target&&<button onClick={checkExercise} disabled={exerciseChecked}>Comprobar</button>}</div>
      {trainingResult&&<p className="result" role="status">{trainingResult}</p>}
     </div>}
     {trainingMode!=='keyboard'&&<div className="guided-session"><div className="panel-kicker">SESIÓN GUIADA</div><label>Ejercicios por sesión <select value={sessionSize} onChange={e=>setSessionSize(+e.target.value)}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><div className="row"><button onClick={startSession}>Iniciar sesión</button>{sessionRemaining>0&&<button onClick={()=>setSessionRemaining(0)}>Terminar sesión</button>}</div>{sessionRemaining>0&&<p role="status">Quedan {sessionRemaining} ejercicios. Después de comprobar cada respuesta, pulsa «Siguiente grupo».</p>}{sessionScores.length>0&&<p>Sesión: {sessionScores.length} completados · {Math.round(sessionScores.reduce((a,b)=>a+b,0)/sessionScores.length)}% de precisión media{sessionRemaining===0?' · Finalizada':''}</p>}</div>}
    </section>
    <section className="panel settings-panel"><div className="panel-kicker">02 / AJUSTES DE LA SESIÓN</div><h2>Tu ritmo</h2>
     <label>Lección Koch <b>{lesson} / {KOCH.length}</b><input type="range" min="2" max={KOCH.length} value={lesson} onChange={e=>setLesson(+e.target.value)}/></label>
     <p className="character-set">CARACTERES ACTIVOS<br/><strong>{KOCH.slice(0,lesson).split('').join('  ')}</strong></p>
     <label>Velocidad del carácter <b>{trainingWpm} WPM</b><input type="range" min="15" max="35" value={trainingWpm} onChange={e=>setTrainingWpm(+e.target.value)}/></label>
     <label>Tono de escucha <b>{trainingTone} Hz</b><input type="range" min="350" max="1000" step="25" value={trainingTone} onChange={e=>setTrainingTone(+e.target.value)}/></label><button onClick={()=>{void initAudio().then(()=>{stopStation();rxPlayback.current=playCw(audio.current!,'VVV',trainingWpm,trainingTone,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)})}}>Probar tono</button><label>Velocidad efectiva <b>{Math.min(effectiveWpm,trainingWpm)} WPM</b><input type="range" min="5" max={trainingWpm} value={Math.min(effectiveWpm,trainingWpm)} onChange={e=>setEffectiveWpm(+e.target.value)}/></label>
     <label className="checkbox-label"><input type="checkbox" checked={autoAdvance} onChange={e=>setAutoAdvance(e.target.checked)}/> Avanzar automáticamente tras 10 ejercicios con ≥90% de media</label><p className="fineprint">Consejo: mantén 20 WPM de carácter y empieza con 8 WPM efectivos. Sube de lección tras alcanzar un 90% de precisión de forma consistente.</p>
    </section>
    <section className="panel full-width"><div className="panel-kicker">03 / TU PROGRESO</div><div className="stats"><div><strong>{history.length}</strong><span>Ejercicios registrados</span></div><div><strong>{history.length?Math.round(history.reduce((sum,h)=>sum+h.score,0)/history.length):'—'}{history.length?'%':''}</strong><span>Precisión media</span></div><div><strong>{history.slice(-10).length?Math.round(history.slice(-10).reduce((sum,h)=>sum+h.score,0)/history.slice(-10).length)+'%':'—'}</strong><span>Últimos diez</span></div></div><div className="analytics">
      <div><h3>Evolución de precisión</h3><p className="fineprint">Últimos {trend.length} ejercicios · cada punto es un ejercicio</p>
       {trend.length?<svg className="trend-chart" viewBox="0 0 660 190" role="img" aria-label="Evolución de la precisión en los últimos ejercicios">
        {[0,50,100].map(v=><g key={v}><line x1="30" x2="630" y1={160-v*1.35} y2={160-v*1.35} stroke="currentColor" strokeOpacity=".15"/><text x="3" y={164-v*1.35} fontSize="12" fill="currentColor">{v}</text></g>)}
        <line x1="30" y1="38.5" x2="630" y2="38.5" stroke="var(--accent)" strokeDasharray="5 6" strokeOpacity=".6"/>
        <polyline points={plotPoints} fill="none" stroke="var(--chart)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {trend.map((h,i)=><circle key={i} cx={30+(trend.length===1?0:i*600/(trend.length-1))} cy={160-h.score*1.35} r="4" fill="var(--chart)"><title>{h.score}% · lección {h.lesson} · {h.mode==='receive'?'escucha':'transmisión'}</title></circle>)}
       </svg>:<p className="empty-chart">Completa un ejercicio para comenzar a dibujar tu progreso.</p>}
      </div>
      <div><h3>Caracteres a reforzar</h3><p className="fineprint">Peso de repaso según errores acumulados</p>
       {weakTop.length&&weakTop.some(([,v])=>v>0)?<div className="weak-chart">{weakTop.map(([ch,value])=><div className="weak-row" key={ch}><span>{ch}</span><div className="weak-track"><div style={{width:Math.max(2,value/Math.max(1,...weakTop.map(([,n])=>n))*100)+'%'}}/></div><small>{value.toFixed(1)}</small></div>)}</div>:<p className="empty-chart">Los caracteres difíciles aparecerán aquí conforme practiques.</p>}
      </div>
     </div>
     <div className="confusions"><h3>Confusiones frecuentes</h3>{topConfusions.length?<div className="confusion-list">{topConfusions.map(([pair,n])=><div key={pair}><strong>{pair}</strong><span>{n} {n===1?'vez':'veces'}</span></div>)}</div>:<p className="fineprint">Cuando cometas errores, verás qué caracteres estás confundiendo y con qué frecuencia.</p>}</div><p className="fineprint">Los caracteres con más errores aparecen con mayor frecuencia en nuevos ejercicios. El historial se conserva en este navegador. Puedes activar o desactivar el avance automático.</p></section>
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
createRoot(document.getElementById('root')!).render(<App/>);{trainingMode==='machine'?<div className="exercise"><span className="eyebrow">MORSEMACHINE / RECONOCIMIENTO INMEDIATO</span><h3>Un sonido. Una respuesta.</h3><p className="muted">Escucha un carácter y pulsa su letra o número. Si fallas, escucharás el mismo carácter de nuevo. Si aciertas, avanzas al siguiente. Los caracteres difíciles aparecen más a menudo.</p><div className="machine-status">{machineActive?'● ESCUCHANDO':'PREPARADO'}</div><div className="row"><button className="primary" disabled={machineActive} onClick={startMachine}>Iniciar MorseMachine</button><button disabled={!machineActive} onClick={()=>void soundMachine(machineRef.current.char)}>Repetir</button><button disabled={!machineActive} onClick={stopMachine}>Terminar</button></div>{machineActive&&<><p className="machine-feedback" role="status">{machineFeedback}</p><input className="textinput" aria-label="Respuesta MorseMachine" placeholder="Escribe aquí el carácter escuchado" value="" onChange={e=>answerMachine(e.target.value.slice(-1))}/><p className="fineprint">También puedes usar las teclas A–Z y 0–9 directamente.</p></>}<p className="machine-score">Aciertos: {machineHits} / {machineAttempts} · {machineAttempts?Math.round(100*machineHits/machineAttempts):0}%</p></div>:<div className="exercise">
      <span className="eyebrow">{trainingMode==='receive'?'RECEPCIÓN / 5 CARACTERES':'ENVÍO / 5 CARACTERES'}</span>
      <div className="exercise-target">{!target?'LISTO':trainingMode==='receive'?'♫  ♫  ♫':target}</div>
      <p className="muted">{!target?'Prepara tus auriculares y empieza una sesión.':trainingMode==='receive'?'Escucha el grupo completo y escribe lo que has reconocido.':'Transmite el grupo con tus paletas; luego comprueba el resultado.'}</p>
      {target&&trainingMode==='receive'&&<input className="textinput answer" aria-label="Respuesta escuchada" autoComplete="off" value={answer} onChange={e=>setAnswer(e.target.value.toUpperCase())} maxLength={10} placeholder="Escribe lo que escuchas"/>}
      <div className="row"><button className="primary" onClick={newExercise}>{target?'Siguiente grupo':'Ejercicio libre'}</button>{target&&trainingMode==='receive'&&<button onClick={replayExercise}>Repetir sonido</button>}{target&&<button onClick={checkExercise} disabled={exerciseChecked}>Comprobar</button>}</div>
      {trainingResult&&<p className="result" role="status">{trainingResult}</p>}
     </div>}
     {trainingMode!=='keyboard'&&<div className="guided-session"><div className="panel-kicker">SESIÓN GUIADA</div><label>Ejercicios por sesión <select value={sessionSize} onChange={e=>setSessionSize(+e.target.value)}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label><div className="row"><button onClick={startSession}>Iniciar sesión</button>{sessionRemaining>0&&<button onClick={()=>setSessionRemaining(0)}>Terminar sesión</button>}</div>{sessionRemaining>0&&<p role="status">Quedan {sessionRemaining} ejercicios. Después de comprobar cada respuesta, pulsa «Siguiente grupo».</p>}{sessionScores.length>0&&<p>Sesión: {sessionScores.length} completados · {Math.round(sessionScores.reduce((a,b)=>a+b,0)/sessionScores.length)}% de precisión media{sessionRemaining===0?' · Finalizada':''}</p>}</div>}
    </section>
    <section className="panel settings-panel"><div className="panel-kicker">02 / AJUSTES DE LA SESIÓN</div><h2>Tu ritmo</h2>
     <label>Lección Koch <b>{lesson} / {KOCH.length}</b><input type="range" min="2" max={KOCH.length} value={lesson} onChange={e=>setLesson(+e.target.value)}/></label>
     <p className="character-set">CARACTERES ACTIVOS<br/><strong>{KOCH.slice(0,lesson).split('').join('  ')}</strong></p>
     <label>Velocidad del carácter <b>{trainingWpm} WPM</b><input type="range" min="15" max="35" value={trainingWpm} onChange={e=>setTrainingWpm(+e.target.value)}/></label>
     <label>Tono de escucha <b>{trainingTone} Hz</b><input type="range" min="350" max="1000" step="25" value={trainingTone} onChange={e=>setTrainingTone(+e.target.value)}/></label><button onClick={()=>{void initAudio().then(()=>{stopStation();rxPlayback.current=playCw(audio.current!,'VVV',trainingWpm,trainingTone,volumeRef.current,effectiveWpm);setRxPlaying(true);rxTimeout.current=window.setTimeout(()=>setRxPlaying(false),(rxPlayback.current!.duration+.15)*1000)})}}>Probar tono</button><label>Velocidad efectiva <b>{Math.min(effectiveWpm,trainingWpm)} WPM</b><input type="range" min="5" max={trainingWpm} value={Math.min(effectiveWpm,trainingWpm)} onChange={e=>setEffectiveWpm(+e.target.value)}/></label>
     <label className="checkbox-label"><input type="checkbox" checked={autoAdvance} onChange={e=>setAutoAdvance(e.target.checked)}/> Avanzar automáticamente tras 10 ejercicios con ≥90% de media</label><p className="fineprint">Consejo: mantén 20 WPM de carácter y empieza con 8 WPM efectivos. Sube de lección tras alcanzar un 90% de precisión de forma consistente.</p>
    </section>
    <section className="panel full-width"><div className="panel-kicker">03 / TU PROGRESO</div><div className="stats"><div><strong>{history.length}</strong><span>Ejercicios registrados</span></div><div><strong>{history.length?Math.round(history.reduce((sum,h)=>sum+h.score,0)/history.length):'—'}{history.length?'%':''}</strong><span>Precisión media</span></div><div><strong>{history.slice(-10).length?Math.round(history.slice(-10).reduce((sum,h)=>sum+h.score,0)/history.slice(-10).length)+'%':'—'}</strong><span>Últimos diez</span></div></div><div className="analytics">
      <div><h3>Evolución de precisión</h3><p className="fineprint">Últimos {trend.length} ejercicios · cada punto es un ejercicio</p>
       {trend.length?<svg className="trend-chart" viewBox="0 0 660 190" role="img" aria-label="Evolución de la precisión en los últimos ejercicios">
        {[0,50,100].map(v=><g key={v}><line x1="30" x2="630" y1={160-v*1.35} y2={160-v*1.35} stroke="currentColor" strokeOpacity=".15"/><text x="3" y={164-v*1.35} fontSize="12" fill="currentColor">{v}</text></g>)}
        <line x1="30" y1="38.5" x2="630" y2="38.5" stroke="var(--accent)" strokeDasharray="5 6" strokeOpacity=".6"/>
        <polyline points={plotPoints} fill="none" stroke="var(--chart)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {trend.map((h,i)=><circle key={i} cx={30+(trend.length===1?0:i*600/(trend.length-1))} cy={160-h.score*1.35} r="4" fill="var(--chart)"><title>{h.score}% · lección {h.lesson} · {h.mode==='receive'?'escucha':'transmisión'}</title></circle>)}
       </svg>:<p className="empty-chart">Completa un ejercicio para comenzar a dibujar tu progreso.</p>}
      </div>
      <div><h3>Caracteres a reforzar</h3><p className="fineprint">Peso de repaso según errores acumulados</p>
       {weakTop.length&&weakTop.some(([,v])=>v>0)?<div className="weak-chart">{weakTop.map(([ch,value])=><div className="weak-row" key={ch}><span>{ch}</span><div className="weak-track"><div style={{width:Math.max(2,value/Math.max(1,...weakTop.map(([,n])=>n))*100)+'%'}}/></div><small>{value.toFixed(1)}</small></div>)}</div>:<p className="empty-chart">Los caracteres difíciles aparecerán aquí conforme practiques.</p>}
      </div>
     </div>
     <div className="confusions"><h3>Confusiones frecuentes</h3>{topConfusions.length?<div className="confusion-list">{topConfusions.map(([pair,n])=><div key={pair}><strong>{pair}</strong><span>{n} {n===1?'vez':'veces'}</span></div>)}</div>:<p className="fineprint">Cuando cometas errores, verás qué caracteres estás confundiendo y con qué frecuencia.</p>}</div><p className="fineprint">Los caracteres con más errores aparecen con mayor frecuencia en nuevos ejercicios. El historial se conserva en este navegador. Puedes activar o desactivar el avance automático.</p></section>
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
