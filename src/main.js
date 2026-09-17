import {World, WIDTH, HEIGHT, DT} from './physics.js';
const $=id=>document.getElementById(id), canvas=$('world'),ctx=canvas.getContext('2d');
const world=new World();let selected=null,paused=false,accumulator=0,last=0,spawnClock=0,uiClock=0,frameRate=60;
world.spawn(30);world.rebuild();selected=world.balls[0];
function resize(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(canvas.clientWidth*dpr);canvas.height=Math.round(canvas.clientHeight*dpr);}
new ResizeObserver(resize).observe(canvas);
function select(ball){selected=ball;updateUI();}
canvas.addEventListener('pointerdown',event=>{const box=canvas.getBoundingClientRect();const x=(event.clientX-box.left)/box.width*WIDTH,y=(event.clientY-box.top)/box.height*HEIGHT;const nearest=world.balls.reduce((best,b)=>Math.hypot(b.x-x,b.y-y)<(best?Math.hypot(best.x-x,best.y-y):24)?b:best,null);if(nearest)select(nearest);});
$('follow').onclick=()=>{const i=world.balls.indexOf(selected);select(world.balls[(i+1)%world.balls.length]);};
$('drop').onclick=()=>{world.spawn(10);world.rebuild();updateUI();};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';accumulator=0;};
$('step').onclick=()=>{paused=true;$('pause').textContent='Resume';world.tick();updateUI();};
$('reset').onclick=()=>{world.balls=[];world.nextId=1;world.spawn(30);world.rebuild();selected=world.balls[0];world.stats={tests:0,budget:0,contacts:0};spawnClock=0;updateUI();};
$('method').onchange=()=>{world.method=$('method').value;$('explanation').textContent=world.method==='grid'?'Objects occupy every grid cell touched by their bounds. Only objects sharing the ball’s cells need an exact circle test.':'Brute force tests every ball against every peg and other ball. Each unique pair is tested once per physics tick.';updateUI();};
$('cell').oninput=()=>{world.grid.size=+$('cell').value;$('cell-value').textContent=`${world.grid.size} px`;world.rebuild();updateUI();};
function updateUI(){const s=world.stats,r=s.budget?Math.max(0,100*(1-s.tests/s.budget)):0;$('reduction').textContent=r.toFixed(1);$('meter').style.width=`${r}%`;for(const key of ['tests','budget','contacts'])$(key).textContent=s[key].toLocaleString();$('population').textContent=`${world.balls.length} / 180 BALLS`;$('fps').textContent=`${Math.round(frameRate)} FPS`;
 if(!selected)return;const info=world.inspect(selected);$('selected').textContent=`Ball ${selected.id.slice(1).padStart(3,'0')}`;$('instruction').textContent='Live snapshot of exact circle checks at the current position. Balls recirculate and keep their ID.';$('position').textContent=`${selected.x.toFixed(0)}, ${selected.y.toFixed(0)} px`;$('velocity').textContent=`${Math.hypot(selected.vx,selected.vy).toFixed(0)} px/s`;$('cells').textContent=world.method==='grid'?info.cells.join(' · '):'All objects';$('candidates').textContent=info.candidates.length;$('hits').textContent=info.checks.filter(c=>c.hit).length;
 const sorted=info.checks.sort((a,b)=>a.distance-b.distance);$('check-list').replaceChildren(...sorted.map(c=>{const row=document.createElement('div');row.className=c.hit?'hit':'';row.textContent=`${c.hit?'●':'○'} ${c.body.id.padEnd(4)} d=${c.distance.toFixed(1)} ${c.hit?'<':'≥'} ${selected.r+c.body.r} · ${c.hit?'contact':'clear'}`;return row;}));if(!sorted.length)$('check-list').textContent='No nearby candidates. No circle tests needed.';
}
function circle(b,color,r=b.r){ctx.beginPath();ctx.arc(b.x,b.y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function draw(){ctx.setTransform(canvas.width/WIDTH,0,0,canvas.height/HEIGHT,0,0);ctx.fillStyle='#101924';ctx.fillRect(0,0,WIDTH,HEIGHT);const info=selected?world.inspect(selected):null;
 if(info&&world.method==='grid'){ctx.fillStyle='#6ee3b415';for(const cell of info.cells){const [x,y]=cell.split(',').map(Number);ctx.fillRect(x*world.grid.size,y*world.grid.size,world.grid.size,world.grid.size);ctx.strokeStyle='#6ee3b45a';ctx.strokeRect(x*world.grid.size,y*world.grid.size,world.grid.size,world.grid.size);}}
 if($('grid').checked){ctx.lineWidth=.7;ctx.strokeStyle='#253446';ctx.beginPath();for(let x=0;x<=WIDTH;x+=world.grid.size){ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);}for(let y=0;y<=HEIGHT;y+=world.grid.size){ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);}ctx.stroke();ctx.fillStyle='#52667c';ctx.font='9px monospace';for(let x=0;x<WIDTH;x+=world.grid.size)ctx.fillText(String(x/world.grid.size),x+5,12);}
 ctx.strokeStyle='#3b5066';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,25);ctx.lineTo(16,HEIGHT-38);ctx.moveTo(WIDTH-16,25);ctx.lineTo(WIDTH-16,HEIGHT-38);ctx.stroke();
 ctx.fillStyle='#6d8196';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText('D R O P   Z O N E',WIDTH/2,32);ctx.textAlign='left';
 for(let x=48;x<WIDTH;x+=64){ctx.strokeStyle='#344457';ctx.beginPath();ctx.moveTo(x,690);ctx.lineTo(x,730);ctx.stroke();}
 ctx.fillStyle='#657b90';ctx.font='9px monospace';ctx.textAlign='center';ctx.fillText('↓  BALLS RECIRCULATE  ↓',WIDTH/2,746);ctx.textAlign='left';
 if(selected&&selected.trail.length){ctx.strokeStyle='#63e5df66';ctx.lineWidth=2;ctx.beginPath();selected.trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
 if(info&&$('links').checked){ctx.lineWidth=1;for(const c of info.checks){ctx.strokeStyle=c.hit?'#ff7fa2aa':'#f1bd692f';ctx.beginPath();ctx.moveTo(selected.x,selected.y);ctx.lineTo(c.body.x,c.body.y);ctx.stroke();}}
 const candidateIds=new Set(info?.candidates.map(b=>b.id)),hitIds=new Set(info?.checks.filter(c=>c.hit).map(c=>c.body.id));
 for(const peg of world.pegs){circle(peg,'#1e3042',9);circle(peg,hitIds.has(peg.id)?'#ff7fa2':candidateIds.has(peg.id)?'#f1bd69':'#6c819b');circle({x:peg.x-1.5,y:peg.y-2,r:1.5},'#ffffff45');}
 for(const b of world.balls){circle(b,b===selected?'#63e5df':hitIds.has(b.id)?'#ff7fa2':candidateIds.has(b.id)?'#f1bd69':'#b5c7df');if(b===selected){ctx.strokeStyle='#63e5df';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(b.x,b.y,13,0,Math.PI*2);ctx.stroke();ctx.font='bold 10px monospace';ctx.fillStyle='#63e5df';ctx.fillText(b.id,b.x+18,b.y-9);}}
}
function frame(time){const elapsed=last?Math.min((time-last)/1000,.1):0;last=time;if(elapsed)frameRate=frameRate*.95+(1/elapsed)*.05;if(!paused){const delta=elapsed*+$('speed').value;accumulator+=delta;spawnClock+=delta;if($('auto').checked&&spawnClock>.65){world.spawn();spawnClock=0;}let steps=0;while(accumulator>=DT&&steps++<24){world.tick();accumulator-=DT;}}uiClock+=elapsed;if(uiClock>.12){updateUI();uiClock=0;}draw();requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});updateUI();requestAnimationFrame(frame);
