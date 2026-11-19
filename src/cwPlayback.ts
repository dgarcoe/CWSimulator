export const CW_CODES: Record<string,string> = {'?':'..--..',A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.'};
export type Playback = {stop:()=>void; duration:number};
export function playCw(ctx:AudioContext, message:string, wpm:number, pitch:number, volume:number,effectiveWpm=wpm, channel?:{qrn:number;qsb:number}):Playback {
 const dot=1.2/wpm;
 const effectiveDot=1.2/Math.min(wpm,effectiveWpm);
 const gap=Math.max(3*dot,(60/effectiveWpm-31*dot)/19*3);
 let t=ctx.currentTime+0.08;
 const start=t;
 const oscillator=ctx.createOscillator();
 const envelope=ctx.createGain();
 oscillator.type='sine';oscillator.frequency.value=pitch;
 envelope.gain.setValueAtTime(0,t);
 oscillator.connect(envelope).connect(ctx.destination);
 oscillator.start(t);
 const chars=message.toUpperCase().split('');
 for(let i=0;i<chars.length;i++){
  const ch=chars[i];
  if(ch===' '){t+=Math.max(4*dot,gap*4/3);continue}
  const code=CW_CODES[ch];
  if(!code)continue;
  for(let j=0;j<code.length;j++){
   const fade=1-(channel?.qsb??0)/100*(0.5-0.5*Math.cos((t-start)*2));
   const level=volume*fade;
   const len=code[j]==='.'?dot:3*dot;
   envelope.gain.setValueAtTime(0,t);
   envelope.gain.linearRampToValueAtTime(level,t+Math.min(.005,len/8));
   envelope.gain.setValueAtTime(level,t+len-Math.min(.005,len/8));
   envelope.gain.linearRampToValueAtTime(0,t+len);
   t+=len;
   if(j<code.length-1)t+=dot;
  }
  if(i<chars.length-1)t+=gap;
 }
 let noise:AudioBufferSourceNode|undefined;
 if(channel && channel.qrn>0){
  const buffer=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*volume*channel.qrn/200;
  noise=ctx.createBufferSource();
  noise.buffer=buffer;
  noise.loop=true;
  noise.connect(ctx.destination);
  noise.onended=()=>noise?.disconnect();
  noise.start(start);
  noise.stop(t+.02);
 }
 oscillator.stop(t+.02);
 let stopped=false;
 return {duration:t-start,stop:()=>{if(stopped)return;stopped=true;try{noise?.stop();envelope.gain.cancelScheduledValues(ctx.currentTime);envelope.gain.setTargetAtTime(0,ctx.currentTime,.005);oscillator.stop(ctx.currentTime+.04)}catch{}}};
}
