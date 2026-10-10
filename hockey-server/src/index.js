import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";

class Player extends Schema {
  constructor() { super(); this.sessionId=""; this.name="Player"; this.team=0; this.x=0; this.y=0; this.vx=0; this.vy=0; this.skin=0; this.trail=0; this.ready=false; }
}
defineTypes(Player, { sessionId:"string", name:"string", team:"number", x:"number", y:"number", vx:"number", vy:"number", skin:"number", trail:"number", ready:"boolean" });
class Puck extends Schema {
  constructor(){ super(); this.x=450; this.y=300; this.vx=0; this.vy=0; this.score1=0; this.score2=0; }
}
defineTypes(Puck,{x:"number",y:"number",vx:"number",vy:"number",score1:"number",score2:"number"});
class MatchState extends Schema {
  constructor(){super();this.players=new MapSchema();this.puck=new Puck();this.mode="1v1";this.status="waiting";this.hostId="";this.private=false;this.map="Classic";}
}
defineTypes(MatchState,{players:{map:Player},puck:Puck,mode:"string",status:"string",hostId:"string",private:"boolean",map:"string",code:"string"});

const app=express();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
app.get("/",(_req,res)=>res.json({name:"Hockey Multiplayer",status:"ok",protocol:"Colyseus WebSocket",version:1}));
app.get("/health",(_req,res)=>res.status(200).json({ok:true}));
const httpServer=createServer(app);
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer})});
const CAPACITY={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":2 };
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
  this.state.mode=mode;this.state.private=!!options.private;this.state.map=String(options.map||"Classic").slice(0,24);
  this.state.hostId="";this.roomCode=options.code||makeCode();this.state.code=this.roomCode;codes.set(this.roomCode,this.roomId);this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode});
  if(mode==="2v2-ai"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}
  this.aiFillTimer=setTimeout(()=>{if(!this.state)return;const humans=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;if(!humans)return;const capacity=mode==="2v2-ai"?4:CAPACITY[mode];let n=1;while(this.state.players.size<capacity){let team=mode==="1v1"?2:(this.state.players.size%2===0?1:2);while(this.state.players.has("ai-"+team+"-"+n))n++;addAI(this,team,n++);}this.state.status="playing";this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,players:this.state.players.size,capacity});},30000);
  this.onMessage("move",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||this.state.status==="finished")return;
   p.vx=Math.max(-1,Math.min(1,Number(msg?.x)||0));p.vy=Math.max(-1,Math.min(1,Number(msg?.y)||0));
  });
  this.onMessage("customize",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.name=cleanName(msg?.name);p.skin=Math.max(0,Math.min(99,Number(msg?.skin)||0));p.trail=Math.max(0,Math.min(20,Number(msg?.trail)||0));});
  this.onMessage("ready",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(p)p.ready=!!msg?.ready;});
  this.onMessage("shoot",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||this.state.status!=="playing")return;const dx=Math.max(-1,Math.min(1,Number(msg?.x)||0)),dy=Math.max(-1,Math.min(1,Number(msg?.y)||0));const d=Math.hypot(dx,dy)||1;this.state.puck.vx=dx/d*480;this.state.puck.vy=dy/d*480;});
  this.setSimulationInterval(dt=>this.tick(Math.min(dt,50)/1000),1000/30);
 }
 onJoin(client,options){
  const humanCount=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;
  if(humanCount>=CAPACITY[this.state.mode]){client.leave(4001,"Lobby full");return}
  const team=this.state.mode==="2v2-ai"?1:(humanCount%2===0?1:2);
  const p=new Player();p.sessionId=client.sessionId;p.name=cleanName(options?.name);p.team=team;p.x=team===1?130:770;p.y=150+humanCount*55;p.skin=Math.max(0,Math.min(99,Number(options?.skin)||0));p.trail=Math.max(0,Math.min(20,Number(options?.trail)||0));
  this.state.players.set(client.sessionId,p);if(!this.state.hostId)this.state.hostId=client.sessionId;
  this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});
 }
 onLeave(client){this.state.players.delete(client.sessionId);if(this.state.hostId===client.sessionId){const next=this.state.players.keys().next();this.state.hostId=next.done?"":next.value;}this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});}
 tick(dt){
  if(this.state.status==="waiting"){
   const humans=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;
   if(humans>=2||(this.state.mode==="2v2-ai"&&humans>=1))this.state.status="playing";
  }
  const puck=this.state.puck;
  for(const p of this.state.players.values()){
   if(p.sessionId.startsWith("ai-")){
    const defend=p.team===1?Math.min(450,puck.x):Math.max(450,puck.x);
    const tx=puck.x+(p.team===1?-35:35),ty=puck.y+(Number(p.sessionId.split("-")[2])===2?55:-55);
    const dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1;
    p.vx=Math.max(-1,Math.min(1,dx/d*.72));p.vy=Math.max(-1,Math.min(1,dy/d*.72));
   }
   p.x=Math.max(28,Math.min(872,p.x+p.vx*250*dt));p.y=Math.max(48,Math.min(552,p.y+p.vy*250*dt));
  }
  puck.x+=puck.vx*dt;puck.y+=puck.vy*dt;puck.vx*=Math.pow(.985,dt*60);puck.vy*=Math.pow(.985,dt*60);
  if(puck.y<24||puck.y>576){puck.vy*=-.86;puck.y=Math.max(24,Math.min(576,puck.y));}
  if(puck.x<8){puck.score2++;this.resetPuck()}else if(puck.x>892){puck.score1++;this.resetPuck()}else if(puck.x<24||puck.x>876){puck.vx*=-.85;puck.x=Math.max(24,Math.min(876,puck.x));}
  for(const p of this.state.players.values()){
   const dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);
   if(d<30&&d>0){
    const speed=Math.hypot(p.vx,p.vy);
    puck.vx+=dx/d*(95+speed*85)+p.vx*100;
    puck.vy+=dy/d*(95+speed*85)+p.vy*100;
    const mag=Math.hypot(puck.vx,puck.vy);if(mag>650){puck.vx=puck.vx/mag*650;puck.vy=puck.vy/mag*650;}
   }
  }
 }
 resetPuck(){this.state.puck.x=450;this.state.puck.y=300;this.state.puck.vx=0;this.state.puck.vy=0;}
 onDispose(){clearTimeout(this.aiFillTimer);if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);}
}
gameServer.define("hockey",HockeyRoom);
gameServer.define("hockey_public",HockeyRoom).filterBy(["mode","map"]);
const port=Number(process.env.PORT||2567);
await gameServer.listen(port,"0.0.0.0");
console.log("Hockey multiplayer listening on",port);
