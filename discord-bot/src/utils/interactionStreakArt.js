/**
 * Ilustração vetorial local das sete chamas. Redesenho das referências aprovadas
 * (mascote, moldura, asas/coroas). Nenhum fundo, nome ou avatar é incorporado.
 * Coordenadas do renderizador original são preservadas.
 */
const styles={
  0:{dark:'#a92f64',main:'#ff5d91',light:'#ffc0ae',edge:'#ffe3eb',kind:'petal'},
  3:{dark:'#b64819',main:'#ff913e',light:'#ffd27c',edge:'#ffefc8',kind:'ember'},
  7:{dark:'#a86b13',main:'#f9bf35',light:'#fff19e',edge:'#fff7cd',kind:'crown'},
  14:{dark:'#b22d73',main:'#f565af',light:'#ffbddb',edge:'#ffe8f3',kind:'petal'},
  30:{dark:'#2054a8',main:'#42b9f4',light:'#a9eeff',edge:'#e3faff',kind:'ice'},
  60:{dark:'#6631aa',main:'#b275f8',light:'#e7bdff',edge:'#f4e7ff',kind:'wing'},
  100:{dark:'#7260b6',main:'#90e6ed',light:'#f6c6f4',edge:'#eeffff',kind:'opal'},
};
const style=t=>styles[t]??styles[0];
function path(c,d,fill,stroke=null,w=1){const p=new Path2D(d);if(fill){c.fillStyle=fill;c.fill(p);}if(stroke){c.strokeStyle=stroke;c.lineWidth=w;c.lineJoin='round';c.stroke(p);}}
import {Path2D} from '@napi-rs/canvas';
function grad(c,x1,y1,x2,y2,s){
  const g=c.createLinearGradient(x1,y1,x2,y2);g.addColorStop(0,s.edge);g.addColorStop(.28,s.light);g.addColorStop(.58,s.main);g.addColorStop(1,s.dark);return g;
}
function ellipse(c,x,y,rx,ry,fill){c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();}
function sparkle(c,x,y,r,color){c.save();c.translate(x,y);c.scale(r/5,r/5);path(c,'M0 -5 Q1 -1 5 0 Q1 1 0 5 Q-1 1 -5 0 Q-1 -1 0 -5Z',color);c.restore();}
function crown(c,x,y,scale,s){c.save();c.translate(x,y);c.scale(scale,scale);path(c,'M-13 0 L-16 -10 -7 -5 0 -15 7 -5 16 -10 13 0 Z',grad(c,-12,-15,12,3,s),s.edge,1);path(c,'M-12 2 H12 V5 H-12Z',s.main,s.dark,1);for(const [a,b] of [[-16,-10],[0,-15],[16,-10]])ellipse(c,a,b,1.6,1.6,s.edge);c.restore();}
function fireShape(c,s){
  path(c,'M0 -32 C3 -22 14 -20 16 -10 C18 -12 19 -17 19 -20 C25 -10 28 -3 26 7 C26 21 15 29 1 29 C-17 29 -28 19 -27 4 C-26 -7 -20 -16 -14 -23 C-14 -14 -8 -10 -7 -6 C-4 -16 4 -21 0 -32 Z',grad(c,-16,-28,12,31,s),s.edge,1.15);
  path(c,'M-8 23 C-23 14 -19 4 -13 -3 Q-11 4 -6 5 Q-8 -7 3 -14 Q4 -3 13 3 C25 17 13 26 0 26 Z',grad(c,0,-12,0,30,{...s,dark:s.main,main:s.light,light:'#fff5d9'}),null);
  path(c,'M-15 -8 Q-21 -2 -20 5',null,s.edge,2.6);
  ellipse(c,-8,11,3.5,4,'#352337');ellipse(c,8,11,3.5,4,'#352337');
  ellipse(c,-9,9.7,1.2,1.2,'#ffffff');ellipse(c,7,9.7,1.2,1.2,'#ffffff');
  ellipse(c,-13,17,3.5,1.7,'#f78aa4');ellipse(c,13,17,3.5,1.7,'#f78aa4');
  path(c,'M-4 17 Q0 21 4 17 Q3 24 0 24 Q-3 24 -4 17Z','#7b364d');
}
export function drawEvolutionFlame(c,x,y,t){
  const s=style(t);c.save();c.translate(x,y);c.scale(.83,.83);
  if(t===60){c.strokeStyle=s.light;c.lineWidth=2;c.beginPath();c.ellipse(0,12,31,9,-.18,0,Math.PI*2);c.stroke();}
  if(t===100){for(const sign of [-1,1]){c.save();c.scale(sign,1);path(c,'M20 18 Q30 4 35 0 Q34 12 24 23 L34 17 Q30 30 16 28Z',grad(c,16,0,35,28,s),s.edge,1);c.restore();}}
  fireShape(c,s);
  if(t===7||t===100)crown(c,0,-21,.65,{...styles[7]});
  if(t===14){ellipse(c,8,11,5,4,s.light);path(c,'M5 12 Q8 8 11 12',null,'#352337',1.8);}
  sparkle(c,-29,-10,t>=30?5:3.5,s.edge);sparkle(c,28,-18,t>=7?4.5:3,s.light);
  if(t>=30)sparkle(c,32,5,2.5,s.edge);
  c.restore();
}
function wing(c,s,t){
  const fill=grad(c,-57,-13,-28,48,s);
  if(t>=60) {
    path(c,'M-33 43 Q-56 37 -60 19 Q-47 28 -43 26 Q-59 13 -60 0 Q-48 15 -40 14 Q-49 1 -46 -9 Q-33 8 -31 22 Q-24 32 -33 43Z',fill,s.edge,1);
    path(c,'M-55 10 Q-43 25 -34 28 M-54 28 Q-44 35 -35 36',null,s.edge,1.1);
  }else if(t===7){
    for(let i=0;i<4;i++){c.save();c.translate(-49+i*3,10+i*8);c.rotate(-.45+i*.13);path(c,'M0 0 Q-9 -10 -1 -20 Q8 -12 0 0Z',fill,s.edge,.7);c.restore();}
    path(c,'M-53 5 Q-50 31 -29 45',null,s.light,2);
  }else{
    path(c,'M-30 44 Q-56 37 -57 14 Q-51 22 -47 24 Q-56 7 -49 -3 Q-46 12 -39 14 Q-44 0 -36 -10 Q-36 7 -28 18 Q-23 29 -30 44Z',fill,s.edge,.9);
    path(c,'M-51 17 Q-43 33 -30 39',null,s.light,1.4);
    if(t===30)path(c,'M-48 12 L-53 -6 -43 2 -37 20Z',fill,s.edge,.9);
  }
}
export function drawEvolutionFrame(c,x,y,t){
  const s=style(t);c.save();c.translate(x,y);
  // Limite visual: não cobre nomes nem áreas de texto.
  c.beginPath();c.arc(0,0,49,0,Math.PI*2);c.strokeStyle=grad(c,-40,-44,38,48,s);c.lineWidth=3.2;c.stroke();
  c.beginPath();c.arc(0,0,46.7,0,Math.PI*2);c.strokeStyle=s.light;c.lineWidth=.9;c.stroke();
  for(const sign of [-1,1]){c.save();c.scale(sign,1);wing(c,s,t);c.restore();}
  if(t===7||t===100)crown(c,0,-47,.48,styles[7]);
  if(t===60||t===100){sparkle(c,-45,-33,3,s.edge);sparkle(c,46,-31,3,s.light);}
  c.save();c.translate(0,48);c.scale(.19,.19);fireShape(c,s);c.restore();
  c.restore();
}
