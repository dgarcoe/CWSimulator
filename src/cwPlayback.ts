export const CW_CODES: Record<string,string> = {'.':'.-.-.-',',':'--..--','=':'-...-','/':'-..-.','?':'..--..',A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.'};
type Channel={qrn:number;qsb:number};
export function fading(time:number,path:number,depth:number){
 const phase=time*(1.5+path*.13)+path;
 const dip=.5+.36*Math.sin(phase)+.14*Math.sin(phase*.39+path);
 return 10**(-32*(depth/100)*dip/20);
}
export type Playback = {stop:()=>void; duration:number;setChannel?:(value:Channel)=>void};
function spacing(wpm:number,effectiveWpm:number){
 const dot=1.2/wpm;
 const effectiveDot=1.2/Math.min(wpm,effectiveWpm);
 return {dot,gap:Math.max(3*dot,(60/effectiveWpm-31*dot)/19*3)};
}
export function timedGroups(pool:string,wpm:number,effective:number,seconds:number,groupSize=5){
 if(!Number.isInteger(groupSize)||groupSize<1||groupSize>10)throw new RangeError("Invalid Koch group size");
 const {dot,gap}=spacing(wpm,effective);
 const groups:string[]=[];
 let elapsed=0;
 while(true){
  let group='',duration=(groupSize-1)*gap;
  for(let i=0;i<groupSize;i++){
   const char=pool[Math.floor(Math.random()*pool.length)],code=CW_CODES[char];
   group+=char;
   duration+=dot*(code.length-1+Array.from(code).reduce((n,c)=>n+(c==='.'?1:3),0));
  }
  if(groups.length)duration+=gap*7/3;
  if(elapsed+duration>seconds)break;
  groups.push(group);elapsed+=duration;
 }
 return {text:groups.join(' '),extraGap:(seconds-elapsed)/(groups.length>1?groups.length-1:Math.max(1,groupSize-1))};
}
export function playCw(ctx:AudioContext, message:string, wpm:number, pitch:number, volume:number,effectiveWpm=wpm, channel?:Channel,extraGap=0):Playback {
 const {dot,gap}=spacing(wpm,effectiveWpm);
 let t=ctx.currentTime+0.08;
 const start=t;
 const oscillator=ctx.createOscillator();
 const envelope=ctx.createGain();
 oscillator.type='sine';oscillator.frequency.value=pitch;
 envelope.gain.setValueAtTime(0,t);
 const signal=ctx.createGain();
 oscillator.connect(envelope).connect(signal).connect(ctx.destination);
 oscillator.start(t);
 const chars=message.toUpperCase().split('');
 const letterGap=chars.includes(' ')?gap:gap+extraGap;
 for(let i=0;i<chars.length;i++){
  const ch=chars[i];
  if(ch===' '){t+=Math.max(4*dot,gap*4/3)+extraGap;continue}
  const code=CW_CODES[ch];
  if(!code)continue;
  for(let j=0;j<code.length;j++){
   const level=volume;
   const len=code[j]==='.'?dot:3*dot;
   envelope.gain.setValueAtTime(0,t);
   envelope.gain.linearRampToValueAtTime(level,t+Math.min(.005,len/8));
   envelope.gain.setValueAtTime(level,t+len-Math.min(.005,len/8));
   envelope.gain.linearRampToValueAtTime(0,t+len);
   t+=len;
   if(j<code.length-1)t+=dot;
  }
  if(i<chars.length-1)t+=letterGap;
 }
 let noise:AudioBufferSourceNode|undefined;
 let setChannel:Playback['setChannel'];
 if(channel){
  const buffer=ctx.createBuffer(1,8000,8000);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  const noiseGain=ctx.createGain(),filter=ctx.createBiquadFilter();
  filter.type='bandpass';filter.frequency.value=pitch;filter.Q.value=pitch/500;
  noiseGain.gain.value=0;
  noise=ctx.createBufferSource();noise.buffer=buffer;noise.loop=true;
  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.onended=()=>{noise?.disconnect();filter.disconnect();noiseGain.disconnect()};
  noise.start(start);noise.stop(t+.02);
  setChannel=({qrn,qsb})=>{
   const now=ctx.currentTime;
   noiseGain.gain.setTargetAtTime(volume*qrn/40,now,.02);
   signal.gain.cancelScheduledValues(now);
   for(let at=now;at<t+.05;at+=.05)
    signal.gain.setTargetAtTime(fading(at-start,0,qsb),at,.025);
  };
  setChannel(channel);
 }
 oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();signal.disconnect()};
 oscillator.stop(t+.02);
 let stopped=false;
 return {setChannel,duration:t-start,stop:()=>{if(stopped)return;stopped=true;try{noise?.stop();envelope.gain.cancelScheduledValues(ctx.currentTime);envelope.gain.setTargetAtTime(0,ctx.currentTime,.005);oscillator.stop(ctx.currentTime+.04)}catch{}}};
}
