import {useRef} from 'react';

type Props={label:string;value:number;min:number;max:number;step:number;readout:string;change:(value:number)=>void;large?:boolean};
export function RadioKnob({label,value,min,max,step,readout,change,large}:Props){
 const drag=useRef<{y:number;value:number;id:number}|null>(null);
 const angle=-135+270*(value-min)/(max-min);
 return <label className={'radio-knob'+(large?' tuning-knob':'')}>
  <span>{label}</span>
  <span className="knob-ring">
   <span className="knob-face" style={{transform:'rotate('+angle+'deg)'}}/>
   <input type="range" min={min} max={max} step={step} value={value}
    aria-label={label} aria-valuetext={readout} title="Arrastra arriba o abajo, o usa las flechas"
    onChange={e=>change(Number(e.target.value))}
    onPointerDown={e=>{
     if(e.button!==0||drag.current)return;
     e.preventDefault();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);
     drag.current={y:e.clientY,value,id:e.pointerId};
    }}
    onPointerMove={e=>{
     const start=drag.current;if(!start||start.id!==e.pointerId)return;
     const delta=Math.round((start.y-e.clientY)*(max-min)/(160*step))*step;
     change(Math.min(max,Math.max(min,start.value+delta)));
    }}
    onLostPointerCapture={()=>{drag.current=null}}/>
  </span>
  <b>{readout}</b>
 </label>;
}
