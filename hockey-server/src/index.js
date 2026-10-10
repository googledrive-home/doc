import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";

class Player extends Schema {
  constructor() { super(); this.sessionId=""; this.name="Player"; this.team=0; this.x=0; this.y=0; this.vx=0; this.vy=0; this.inputX=0; this.inputY=0; this.skin=0; this.trail=0; this.ready=false; }
}
defineTypes(Player, { sessionId:"string", name:"string", team:"number", x:"number", y:"number", vx:"number", vy:"number", inputX:"number", inputY:"number", skin:"number", trail:"number", ready:"boolean" });
class Puck extends Schema {
  constructor(){ super(); this.x=450; this.y=300; this.vx=0; this.vy=0; this.score1=0; this.score2=0; }
}
defineTypes(Puck,{x:"number",y:"number",vx:"number",vy:"number",score1:"number",score2:"number"});
class MatchState extends Schema {
  constructor(){super();this.players=new MapSchema();this.puck=new Puck();this.mode="1v1";this.status="waiting";this.hostId="";this.private=false;this.map="Classic";this.teamName1="Blue Blades";this.teamName2="Red Wolves";this.countdown=30;this.matchTime=180;this.difficulty="medium";this.training="none";this.competition=false;this.playerSpeed=1;this.playerPower=1;this.playerControl=1;this.aiSpeed=1;this.aiPower=1;this.aiAccuracy=1;}
}
defineTypes(MatchState,{players:{map:Player},puck:Puck,mode:"string",status:"string",hostId:"string",private:"boolean",map:"string",code:"string",teamName1:"string",teamName2:"string",countdown:"number",matchTime:"number",difficulty:"string",training:"string",competition:"boolean",playerSpeed:"number",playerPower:"number",playerControl:"number",aiSpeed:"number",aiPower:"number",aiAccuracy:"number"});

const app=express();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
app.get("/",(_req,res)=>res.json({name:"Hockey Multiplayer",status:"ok",protocol:"Colyseus WebSocket",version:1}));
app.get("/health",(_req,res)=>res.status(200).json({ok:true}));
const httpServer=createServer(app);
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer})});
const CAPACITY={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":1 };
const TOTAL_SLOTS={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":4 };
const codes=new Map();
app.get("/room/:code",(req,res)=>{const roomId=codes.get(String(req.params.code||"").toUpperCase());if(!roomId)return res.status(404).json({error:"Room code not found"});res.json({roomId});});
const cleanName=v=>String(v??"Player").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,18)||"Player";
function makeCode(){let code;do{code=randomBytes(3).toString("hex").toUpperCase()}while(codes.has(code));return code}
function addAI(room,team,index){
 const p=new Player();p.sessionId="ai-"+team+"-"+index;p.name="CPU "+index;p.team=team;p.x=team===1?130:770;p.y=180+index*65;room.state.players.set(p.sessionId,p);
}
class HockeyRoom extends (await import("@colyseus/core")).Room {
 onCreate(options){
  this.maxClients=6;this.autoDispose=true;this.setState(new MatchState());
  const mode=CAPACITY[options.mode]?options.mode:"1v1";
  this.state.mode=mode;this.state.private=!!options.private;this.state.map=String(options.map||"Classic").slice(0,24);this.state.teamName1=cleanName(options?.teamName1||"Blue Blades");this.state.teamName2=cleanName(options?.teamName2||"Red Wolves");this.state.matchTime=Number.isFinite(Number(options?.matchTime))?Math.max(60,Math.min(600,Number(options.matchTime))):180;this.state.difficulty=["easy","medium","hard","extrahard"].includes(options?.difficulty)?options.difficulty:"medium";this.state.training=["none","warmup","conditioning","speed"].includes(options?.training)?options.training:"none";this.state.competition=!!options?.competition;const clampStat=(v,lo=.65,hi=1.7)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):1));this.state.playerSpeed=clampStat(options?.playerSpeed, .65,1.6);this.state.playerPower=clampStat(options?.playerPower,.65,1.7);this.state.playerControl=clampStat(options?.playerControl,.65,1.6);this.state.aiSpeed=clampStat(options?.aiSpeed,.65,1.6);this.state.aiPower=clampStat(options?.aiPower,.65,1.7);this.state.aiAccuracy=clampStat(options?.aiAccuracy,.65,1.6);this.state.countdown=30;this.waitSeconds=30;this.startSeconds=0;this.goalPause=0;
  this.state.hostId="";this.roomCode=options.code||makeCode();this.state.code=this.roomCode;codes.set(this.roomCode,this.roomId);this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode});
  if(mode==="2v2-ai"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}

  this.onMessage("move",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||this.state.status==="finished")return;
   p.inputX=Math.max(-1,Math.min(1,Number(msg?.x)||0));p.inputY=Math.max(-1,Math.min(1,Number(msg?.y)||0));
  });
  this.onMessage("customize",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.name=cleanName(msg?.name);p.skin=Math.max(0,Math.min(99,Number(msg?.skin)||0));p.trail=Math.max(0,Math.min(20,Number(msg?.trail)||0));});
  this.onMessage("ready",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(p)p.ready=!!msg?.ready;});
  this.onMessage("shoot",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||this.state.status!=="playing")return;const puck=this.state.puck,dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);if(d>70)return;let ax=Math.max(-1,Math.min(1,Number(msg?.x)||0)),ay=Math.max(-1,Math.min(1,Number(msg?.y)||0)),n=Math.hypot(ax,ay)||1;ax/=n;ay/=n;const isAI=p.sessionId.startsWith("ai-"),diffScale=this.state.difficulty==="easy"?.72:this.state.difficulty==="hard"?1.16:this.state.difficulty==="extrahard"?1.32:1,power=isAI?this.state.aiPower*diffScale:this.state.playerPower;puck.vx=ax*650*power+p.vx*.65;puck.vy=ay*650*power+p.vy*.65;puck.x=p.x+ax*31;puck.y=p.y+ay*31;});
  this.setSimulationInterval(dt=>this.tick(Math.min(dt,50)/1000),1000/30);
 }
 onJoin(client,options){
  const humanCount=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;
  if(humanCount>=CAPACITY[this.state.mode]){client.leave(4001,"Lobby full");return}
  const team=this.state.mode==="2v2-ai"?1:(humanCount%2===0?1:2);
  const p=new Player();p.sessionId=client.sessionId;p.name=cleanName(options?.name);p.team=team;p.x=team===1?130:770;p.y=150+humanCount*55;p.skin=Math.max(0,Math.min(13,Number(options?.skin)||0));p.trail=Math.max(0,Math.min(7,Number(options?.trail)||0));
  this.state.players.set(client.sessionId,p);if(!this.state.hostId)this.state.hostId=client.sessionId;
  if(!this.aiFillTimer){
   this.aiCountdown=setInterval(()=>{if(!this.state||this.state.status!=="waiting")return;this.state.countdown=Math.max(0,Math.ceil(this.waitSeconds));this.broadcast("countdown",{seconds:this.state.countdown});},1000);
   this.aiFillTimer=setTimeout(()=>{if(!this.state)return;const humans=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")).length;if(!humans)return;const mode=this.state.mode,capacity=TOTAL_SLOTS[mode]||CAPACITY[mode];let n=1;while(this.state.players.size<capacity){let team=mode==="1v1"?2:(this.state.players.size%2===0?1:2);while(this.state.players.has("ai-"+team+"-"+n))n++;addAI(this,team,n++);}this.startFaceoff();this.broadcast("lobby",{code:this.roomCode,mode,private:this.state.private,players:this.state.players.size,capacity});},30000);
  }
  const humansNow=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")).length;
  if(humansNow>=CAPACITY[this.state.mode]){clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);this.aiFillTimer=null;this.aiCountdown=null;this.startFaceoff();}

  this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});
 }
 onLeave(client){this.state.players.delete(client.sessionId);if(this.state.hostId===client.sessionId){const next=this.state.players.keys().next();this.state.hostId=next.done?"":next.value;}this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});}
 tick(dt){
  const state=this.state,puck=state.puck;
  if(state.status==="waiting"){this.waitSeconds=Math.max(0,this.waitSeconds-dt);state.countdown=Math.ceil(this.waitSeconds);return;}
  if(state.status==="countdown"){
   this.startSeconds=Math.max(0,this.startSeconds-dt);state.countdown=Math.ceil(this.startSeconds);
   if(this.startSeconds<=0){state.status="playing";state.countdown=0;this.broadcast("faceoff",{seconds:0});}
   return;
  }
  if(state.status==="goal"){
   this.goalPause=Math.max(0,this.goalPause-dt);
   if(this.goalPause<=0)this.startFaceoff();
   return;
  }
  if(state.status!=="playing")return;
  state.matchTime=Math.max(0,state.matchTime-dt);
  if(state.matchTime<=0){state.status="finished";this.broadcast("finished",{score1:puck.score1,score2:puck.score2});return;}
  const rinkW=900,rinkH=600,playerR=19,puckR=10,diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,trainingScale=state.training==="warmup"?.82:state.training==="speed"?1.18:state.training==="conditioning"?1.05:1;
  const ps=Array.from(state.players.values());
  for(const p of ps){
   if(p.sessionId.startsWith("ai-")){
    const teamDir=p.team===1?1:-1,index=Number(p.sessionId.split("-")[2])||1;
    const tx=Math.max(50,Math.min(850,puck.x-teamDir*(index===1?24:75))),ty=Math.max(55,Math.min(545,puck.y+(index===1?-22:35)));
    let dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1;p.inputX=dx/d*.86;p.inputY=dy/d*.86;
    if(Math.hypot(puck.x-p.x,puck.y-p.y)<48&&Math.random()<.06){const gx=teamDir===1?880:20,deviation=90/Math.max(.55,state.aiAccuracy*diffScale),gy=300+(Math.random()-.5)*deviation,gd=Math.hypot(gx-puck.x,gy-puck.y)||1;puck.vx=(gx-puck.x)/gd*570*state.aiPower*diffScale;puck.vy=(gy-puck.y)/gd*570*state.aiPower*diffScale;}
   }
   const len=Math.hypot(p.inputX,p.inputY)||1,scale=len>1?1/len:1,ax=p.inputX*scale,ay=p.inputY*scale,isAI=p.sessionId.startsWith("ai-"),speed=isAI?state.aiSpeed*diffScale:state.playerSpeed*trainingScale,control=isAI?1:state.playerControl;
   p.vx+=ax*720*speed*control*dt;p.vy+=ay*720*speed*control*dt;
   const friction=Math.pow(.13/control,dt);p.vx*=friction;p.vy*=friction;
   const vmax=365*speed,sp=Math.hypot(p.vx,p.vy);if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
   p.x=Math.max(40,Math.min(860,p.x+p.vx*dt));p.y=Math.max(50,Math.min(550,p.y+p.vy*dt));
  }
  // Elastic player collisions with soft separation and limited impulse.
  for(let pass=0;pass<3;pass++)for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
   const a=ps[i],b=ps[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>=playerR*2||d<.001)continue;const nx=dx/d,ny=dy/d,over=(playerR*2-d+.1)*.5;
   a.x=Math.max(40,Math.min(860,a.x-nx*over));a.y=Math.max(50,Math.min(550,a.y-ny*over));
   b.x=Math.max(40,Math.min(860,b.x+nx*over));b.y=Math.max(50,Math.min(550,b.y+ny*over));
   const closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(closing<0){const impulse=-closing*.58;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}
  }
  // Damped puck motion, player contact, boards, and the two goals.
  puck.x+=puck.vx*dt;puck.y+=puck.vy*dt;puck.vx*=Math.pow(.34,dt);puck.vy*=Math.pow(.34,dt);
  const goalTop=rinkH/2-46,goalBottom=rinkH/2+46;
  if(puck.y<35||puck.y>rinkH-35){puck.y=Math.max(35,Math.min(rinkH-35,puck.y));puck.vy*=-.86;}
  if(puck.x<25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x=25;puck.vx=Math.abs(puck.vx)*.86;}
  if(puck.x>rinkW-25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x= rinkW-25;puck.vx=-Math.abs(puck.vx)*.86;}
  for(const p of ps){
   let dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);
   if(d<playerR+puckR+2&&d>.001){const nx=dx/d,ny=dy/d,over=playerR+puckR+2-d;puck.x+=nx*over;puck.y+=ny*over;const speed=Math.hypot(p.vx,p.vy);puck.vx+=nx*(100+speed*.5)+p.vx*.48;puck.vy+=ny*(100+speed*.5)+p.vy*.48;}
  }
  const puckSpeed=Math.hypot(puck.vx,puck.vy);if(puckSpeed>760){puck.vx=puck.vx/puckSpeed*760;puck.vy=puck.vy/puckSpeed*760;}
  if(puck.x<2&&puck.y>goalTop&&puck.y<goalBottom){puck.score2++;this.broadcast("goal",{team:2,score1:puck.score1,score2:puck.score2});this.resetPuck();if(state.competition&&puck.score2>=5){state.status="finished";this.broadcast("finished",{score1:puck.score1,score2:puck.score2});}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
  else if(puck.x>rinkW-2&&puck.y>goalTop&&puck.y<goalBottom){puck.score1++;this.broadcast("goal",{team:1,score1:puck.score1,score2:puck.score2});this.resetPuck();if(state.competition&&puck.score1>=5){state.status="finished";this.broadcast("finished",{score1:puck.score1,score2:puck.score2});}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
 }
 startFaceoff(){this.startSeconds=3;this.state.status="countdown";this.state.countdown=3;this.broadcast("faceoff",{seconds:3,team1:this.state.teamName1,team2:this.state.teamName2});}
 resetPuck(){this.state.puck.x=450;this.state.puck.y=300;this.state.puck.vx=0;this.state.puck.vy=0;}

 onDispose(){clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);}
}
gameServer.define("hockey",HockeyRoom);
gameServer.define("hockey_public",HockeyRoom).filterBy(["mode","map"]);
const port=Number(process.env.PORT||2567);
await gameServer.listen(port,"0.0.0.0");
console.log("Hockey multiplayer listening on",port);
