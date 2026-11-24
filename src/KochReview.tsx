import {useState} from 'react';
import type {CopyMark} from './copyReview';

export function KochReview({text,marks,play,next,pool}:{text:string;marks:CopyMark[];play:(s:string)=>void;next:()=>void;pool:string}){
 const [pair,setPair]=useState(''),[challenge,setChallenge]=useState(''),[feedback,setFeedback]=useState('');
 let cursor=0;
 const groups=text.split(' ').map((word,i,words)=>{
  const begin=cursor;
  let consumed=0;
  while(cursor<marks.length&&(consumed<word.length||i===words.length-1)){
   if(marks[cursor++].expected)consumed++;
  }
  return {word,items:marks.slice(begin,cursor)};
 });
 const pairs=new Map<string,number>();
 for(const mark of marks){
  if(mark.kind==='hit')continue;
  const first=mark.expected||mark.actual;
  const second=mark.actual&&mark.actual!==first&&pool.includes(mark.actual)?mark.actual:Array.from(pool).find(c=>c!==first);
  if(!second||!pool.includes(first))continue;
  const key=[first,second].sort().join('');
  pairs.set(key,(pairs.get(key)||0)+1);
 }
 function draw(){const ch=pair[Math.floor(Math.random()*2)];setChallenge(ch);setFeedback('');play(ch)}
 return <>
  <div className="koch-review-groups">{groups.map(({word,items},i)=><div key={i}>
   <button type="button" onClick={()=>play(word)} aria-label={'Escuchar grupo '+(i+1)}>▶ Grupo {i+1}</button>
   <div className="copy-review">{items.map((m,j)=><span key={j} className={'copy-'+m.kind}>{m.kind==='changed'?m.actual+'→'+m.expected:m.kind==='missing'?'+'+m.expected:m.kind==='extra'?'−'+m.actual:m.actual}</span>)}</div>
  </div>)}</div>
  {pairs.size>0&&<fieldset><legend>Repasar mis errores</legend><div className="row">{Array.from(pairs).sort((a,b)=>b[1]-a[1]).map(([key])=><button key={key} aria-pressed={pair===key} onClick={()=>{setPair(key);setChallenge('');setFeedback('')}}>Practicar {key[0]} / {key[1]}</button>)}</div>
  {pair&&<><div className="row">{Array.from(pair).map(c=><button key={c} onClick={()=>play(c)}>Escuchar {c}</button>)}<button onClick={draw}>Identificar al azar</button></div>
  {challenge&&<div className="row">{Array.from(pair).map(c=><button key={c} onClick={()=>{setFeedback(c===challenge?'Correcto: '+challenge:'Sonó '+challenge+'. Elegiste '+c+'.');setChallenge('')}}>{c}</button>)}</div>}
  <p role="status">{feedback}</p><button onClick={next}>Volver a un grupo de la lección</button></>}
  </fieldset>}
 </>;
}
