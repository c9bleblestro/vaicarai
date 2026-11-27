export const DAY=86400000;
export const REWARD_PERIODS=Object.freeze({
  daily:{field:'lastDaily',cooldown:DAY,label:'Daily',min:1000,max:2000},
  weekly:{field:'lastWeekly',cooldown:7*DAY,label:'Semanal',min:3000,max:6000},
  monthly:{field:'lastMonthly',cooldown:30*DAY,label:'Mensal',min:15000,max:30000},
  work:{field:'lastWork',cooldown:3600000,label:'Trabalho'}
});
export function rewardStatus(eco={},now=Date.now()){
  return Object.entries(REWARD_PERIODS).map(([key,p])=>{
    const last=eco?.[p.field]?new Date(eco[p.field]).getTime():0;
    const next=last?last+p.cooldown:now;
    return {key,label:p.label,next,remaining:Math.max(0,next-now),ready:next<=now};
  });
}
export function activeStreak(eco={},now=Date.now()){
  const last=eco?.lastDaily?new Date(eco.lastDaily).getTime():0;
  return last&&now-last<2*DAY?Math.max(0,Number(eco.dailyStreak)||0):0;
}
export function dailyMilestones(streak){
  return [7,14,30].map(day=>({day,achieved:streak>=day}));
}
export function timeLeft(ms){
  if(ms<=0)return 'Disponível';
  const m=Math.ceil(ms/60000),d=Math.floor(m/1440),h=Math.floor(m%1440/60);
  return d?d+'d '+h+'h':h?h+'h '+m%60+'min':m+'min';
}
export function workProgressValue(xp){
  const total=Math.max(0,Number(xp)||0);
  return {level:Math.min(10,Math.floor(total/100)+1),progress:total>=900?1:(total%100)/100};
}
export function makeWorkChallenge(job,random=Math.random){
  const pick=a=>a[Math.floor(random()*a.length)];
  let prompt,correct,options;
  if(job==='entregador'){
    const address=pick(['Rua das Flores, 12','Av. Lunar, 35','Rua do Sol, 84','Praça Rosa, 21']);
    prompt='Pedido: entregue a pizza em '+address+'. Qual endereço consta no pedido?';
    correct=address;options=['Rua das Flores, 12','Av. Lunar, 35','Rua do Sol, 84','Praça Rosa, 21'];
  }else if(job==='freelancer'){
    const n=pick([3,4,5,6,7,8]);prompt='O programa recebe '+n+' e devolve o dobro mais 1. Qual a saída?';
    correct=String(n*2+1);options=[correct,String(n*2),String(n+1),String(n*2+2)];
  }else if(job==='investidor'){
    const a=pick([100,200,300,400]),b=pick([20,30,40,50]);prompt='Mercado fictício: comprou por '+a+' e vendeu por '+(a+b)+'. Qual foi o lucro?';
    correct=String(b);options=[correct,String(a),String(a+b),String(b+10)];
  }else if(job==='gerente'){
    const order=pick(['Cliente A','Cliente B','Cliente C','Cliente D']);
    prompt=order+' tem o prazo mais próximo. Qual pedido deve ser priorizado?';
    correct=order;options=['Cliente A','Cliente B','Cliente C','Cliente D'];
  }else if(job==='magnata'){
    const cost=pick([200,300,400,500]),profit=pick([50,60,80,90]);prompt='Negócio virtual: receita de '+(cost+profit)+' coins e custo de '+cost+'. Qual o lucro líquido?';
    correct=String(profit);options=[correct,String(cost),String(cost+profit),String(profit+10)];
  }else throw Error('Profissão inválida');
  options=[...options];for(let i=options.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
  return {prompt,options,correctIndex:options.indexOf(correct)};
}
