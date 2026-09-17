export const WIDTH = 800, HEIGHT = 780, DT = 1 / 120;
export class SpatialGrid {
  constructor(size = 64) { this.size = size; this.buckets = new Map(); }
  cells(body) {
    const keys = [];
    for (let y = Math.floor((body.y-body.r)/this.size); y <= Math.floor((body.y+body.r)/this.size); y++)
      for (let x = Math.floor((body.x-body.r)/this.size); x <= Math.floor((body.x+body.r)/this.size); x++) keys.push(`${x},${y}`);
    return keys;
  }
  insert(body) { for (const key of this.cells(body)) { if (!this.buckets.has(key)) this.buckets.set(key,new Set()); this.buckets.get(key).add(body); } }
  remove(body) { for (const key of this.cells(body)) { const bucket = this.buckets.get(key); bucket?.delete(body); if (bucket?.size === 0) this.buckets.delete(key); } }
  query(body) { const found = new Set(); for (const key of this.cells(body)) for (const item of this.buckets.get(key) || []) if(item !== body) found.add(item); return [...found]; }
}
export function resolve(a,b) {
  const dx=b.x-a.x, dy=b.y-a.y, radius=a.r+b.r, distance=Math.hypot(dx,dy);
  if(distance >= radius) return false;
  const nx=distance ? dx/distance : 1, ny=distance ? dy/distance : 0;
  const share=b.static ? 1 : .5, depth=radius-distance;
  a.x-=nx*depth*share; a.y-=ny*depth*share;
  if(!b.static) { b.x+=nx*depth*share; b.y+=ny*depth*share; }
  const approach=((b.vx||0)-a.vx)*nx+((b.vy||0)-a.vy)*ny;
  if(approach<0) { const impulse=-(1+.72)*approach*share; a.vx-=impulse*nx; a.vy-=impulse*ny; if(!b.static){ b.vx+=impulse*nx; b.vy+=impulse*ny; } }
  return true;
}
export class World {
  constructor() {
    this.balls=[]; this.pegs=[]; this.nextId=1; this.grid=new SpatialGrid(); this.method='grid'; this.stats={tests:0,budget:0,contacts:0};
    for(let row=0;row<11;row++) for(let col=0;col<12;col++) { const x=48+col*64+(row%2)*32; if(x<WIDTH-30)this.pegs.push({id:`P${this.pegs.length+1}`,x,y:140+row*48,r:6,static:true}); }
  }
  spawn(count=1) { for(let i=0;i<count && this.balls.length<180;i++){ let ball; for(let attempt=0;attempt<30;attempt++){ball={id:`B${this.nextId}`,x:32+Math.random()*(WIDTH-64),y:25+Math.random()*65,r:7,vx:(Math.random()-.5)*40,vy:5,trail:[]}; if(!this.balls.some(b=>Math.hypot(b.x-ball.x,b.y-ball.y)<16))break; ball=null;} if(ball){this.nextId++;this.balls.push(ball);} } }
  rebuild(){ this.grid.buckets.clear(); for(const b of [...this.pegs,...this.balls]) this.grid.insert(b); }
  constrain(b){ if(b.x<b.r+16){b.x=b.r+16;b.vx=Math.abs(b.vx)*.72;} if(b.x>WIDTH-16-b.r){b.x=WIDTH-16-b.r;b.vx=-Math.abs(b.vx)*.72;} }
  tick(){
    for(const b of this.balls){ b.vy+=420*DT; const speed=Math.hypot(b.vx,b.vy); if(speed>550){b.vx*=550/speed;b.vy*=550/speed;} b.x+=b.vx*DT;b.y+=b.vy*DT;this.constrain(b); }
    this.rebuild(); let tests=0,contacts=0; const seen=new Set();
    for(const a of this.balls){ const candidates=this.method==='grid'?this.grid.query(a):[...this.pegs,...this.balls.filter(b=>b!==a)];
      for(const b of candidates){const key=[a.id,b.id].sort().join(':');if(seen.has(key))continue;seen.add(key);tests++;
        // Remove before correction and reinsert afterward: moving bodies must never leave stale buckets.
        this.grid.remove(a);if(!b.static)this.grid.remove(b);
        if(resolve(a,b))contacts++;
        this.constrain(a);if(!b.static)this.constrain(b);
        this.grid.insert(a);if(!b.static)this.grid.insert(b);
      }
    }
    const n=this.balls.length;this.stats={tests,contacts,budget:n*this.pegs.length+n*(n-1)/2};
    for(const b of this.balls){b.trail.push({x:b.x,y:b.y});if(b.trail.length>70)b.trail.shift();if(b.y>HEIGHT+15){this.grid.remove(b);b.x=32+Math.random()*(WIDTH-64);b.y=-20-Math.random()*60;b.vy=30;b.vx=(Math.random()-.5)*35;b.trail=[];this.grid.insert(b);}}
  }
  inspect(ball){const cells=this.grid.cells(ball);const candidates=this.method==='grid'?this.grid.query(ball):[...this.pegs,...this.balls.filter(b=>b!==ball)];return {cells,candidates,checks:candidates.map(b=>({body:b,distance:Math.hypot(b.x-ball.x,b.y-ball.y),hit:Math.hypot(b.x-ball.x,b.y-ball.y)<b.r+ball.r}))};}
}
