export type CopyMark={expected:string;actual:string;kind:'hit'|'changed'|'missing'|'extra'};

export function alignCopy(expected:string,actual:string):CopyMark[]{
 const rows=Array.from({length:expected.length+1},()=>new Uint32Array(actual.length+1));
 for(let j=0;j<=actual.length;j++)rows[0][j]=j;
 for(let i=1;i<=expected.length;i++){
  rows[i][0]=i;
  for(let j=1;j<=actual.length;j++){
   const cost=Number(expected[i-1]!==actual[j-1]);
   rows[i][j]=Math.min(rows[i-1][j-1]+cost,rows[i-1][j]+1,rows[i][j-1]+1);
  }
 }
 const marks:CopyMark[]=[];
 let i=expected.length,j=actual.length;
 while(i||j){
  const same=expected[i-1]===actual[j-1];
  if(i&&j&&rows[i][j]===rows[i-1][j-1]+Number(!same)){
   marks.push({expected:expected[--i],actual:actual[--j],kind:same?'hit':'changed'});
  }else if(i&&rows[i][j]===rows[i-1][j]+1){
   marks.push({expected:expected[--i],actual:'',kind:'missing'});
  }else{
   marks.push({expected:'',actual:actual[--j],kind:'extra'});
  }
 }
 return marks.reverse();
}
