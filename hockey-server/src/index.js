import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

class Player extends Schema {
  constructor() { super(); this.sessionId=""; this.name="Player"; this.team=0; this.x=0; this.y=0; this.vx=0; this.vy=0; this.inputX=0; this.inputY=0; this.skin=0; this.trail=0; this.ready=false; }
}
defineTypes(Player, { sessionId:"string", name:"string", team:"number", x:"number", y:"number", vx:"number", vy:"number", inputX:"number", inputY:"number", skin:"number", trail:"number", ready:"boolean" });
class Puck extends Schema {
  constructor(){ super(); this.x=450; this.y=300; this.vx=0; this.vy=0; this.score1=0; this.score2=0; }
}
defineTypes(Puck,{x:"number",y:"number",vx:"number",vy:"number",score1:"number",score2:"number"});
class MatchState extends Schema {
  constructor(){super();this.players=new MapSchema();this.puck=new Puck();this.mode="1v1";this.status="practice";this.hostId="";this.private=false;this.lobbyName="Hockey Lobby";this.map="Classic";this.teamName1="Team 1";this.teamName2="Team 2";this.countdown=0;this.matchTime=180;this.matchLength=180;this.difficulty="medium";this.training="none";this.competition=false;this.playerSpeed=1;this.playerPower=1;this.playerControl=1;this.aiSpeed=1;this.aiPower=1;this.aiAccuracy=1;}
}
defineTypes(MatchState,{players:{map:Player},puck:Puck,mode:"string",status:"string",hostId:"string",private:"boolean",lobbyName:"string",map:"string",code:"string",teamName1:"string",teamName2:"string",countdown:"number",matchTime:"number",matchLength:"number",difficulty:"string",training:"string",competition:"boolean",playerSpeed:"number",playerPower:"number",playerControl:"number",aiSpeed:"number",aiPower:"number",aiAccuracy:"number"});

const app=express();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
app.use(express.json({limit:"4kb"}));
app.get("/",(_req,res)=>res.json({name:"Hockey Multiplayer",status:"ok",protocol:"Colyseus WebSocket",version:1}));
app.get("/health",(_req,res)=>res.status(200).json({ok:true}));
const httpServer=createServer(app);
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer})});
const CAPACITY={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":1 };
const TOTAL_SLOTS={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":4 };
const codes=new Map();
const activeRooms=new Map();
app.get("/rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(st.private||!["practice","matchmaking","waiting"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,skin:p.skin,bot:p.sessionId.startsWith("ai-")}));const humans=people.filter(p=>!p.bot),capacity=CAPACITY[st.mode]||2;if(humans.length>=capacity)continue;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Public Lobby",mode:st.mode,map:st.map,status:st.status,playerCount:humans.length,capacity,players:humans.map(p=>p.name),roster:people.map(p=>({name:p.name,team:p.team,bot:p.bot}))});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
app.get("/private-rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(!st.private||!["practice","matchmaking","waiting"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-")}));const humans=people.filter(p=>!p.bot),capacity=CAPACITY[st.mode]||2;if(humans.length>=capacity)continue;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Private Lobby",mode:st.mode,map:st.map,status:st.status,playerCount:humans.length,capacity,players:humans.map(p=>p.name),roster:people});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
function findRoomByCode(code){const roomId=codes.get(code);return (roomId&&activeRooms.get(roomId))||Array.from(activeRooms.values()).find(candidate=>candidate.roomCode===code)||null;}
function roomSummary(room){const st=room.state,players=Array.from(st.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).map(p=>({name:p.name,team:p.team,skin:p.skin}));return {roomId:room.roomId,code:room.roomCode,private:st.private,lobbyName:st.lobbyName||"Hockey Lobby",mode:st.mode,map:st.map,status:st.status,playerCount:players.length,capacity:CAPACITY[st.mode]||2,players,roster:Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-")})),teamName1:st.teamName1,teamName2:st.teamName2};}
app.get("/room/:code",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found"});if(room.state.private)return res.status(401).json({error:"This private lobby requires its password."});res.json(roomSummary(room));});
app.post("/room/:code/join",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found or lobby has closed."});if(!room.state.private)return res.status(400).json({error:"That code belongs to a public lobby."});if(!room.matchesPrivatePassword(req.body?.password))return res.status(401).json({error:"Incorrect private lobby password."});if(!["practice","matchmaking","waiting"].includes(room.state.status))return res.status(409).json({error:"That lobby has already started a match."});const humans=Array.from(room.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;if(humans>=(CAPACITY[room.state.mode]||2))return res.status(409).json({error:"That lobby is full."});res.json(roomSummary(room));});
const cleanName=v=>String(v??"Player").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,18)||"Player";
const cleanRoomName=v=>String(v??"Hockey Lobby").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,32)||"Hockey Lobby";
function makeCode(){let code;do{code=randomBytes(3).toString("hex").toUpperCase()}while(codes.has(code));return code}
function addAI(room,team,index){
 const p=new Player();p.sessionId="ai-"+team+"-"+index;p.name="CPU "+index;p.team=team;p.x=team===1?130:770;p.y=180+index*65;p.skin=(team===1?index+3:index+5)%14;p.trail=(index+team)%8;room.state.players.set(p.sessionId,p);
}
class HockeyRoom extends (await import("@colyseus/core")).Room {
 onCreate(options){
  this.maxClients=6;this.autoDispose=true;this.setState(new MatchState());
  const mode=CAPACITY[options.mode]?options.mode:"1v1";
  this.state.mode=mode;this.state.private=!!options.private;this.state.lobbyName=cleanRoomName(options?.lobbyName||(cleanName(options?.name)+"’s Lobby"));this.state.map=String(options.map||"Classic").slice(0,24);this.state.teamName1="Team 1";this.state.teamName2="Team 2";this.state.matchTime=Number.isFinite(Number(options?.matchTime))?Math.max(60,Math.min(600,Number(options.matchTime))):180;this.state.matchLength=this.state.matchTime;this.state.difficulty=["easy","medium","hard","extrahard"].includes(options?.difficulty)?options.difficulty:"medium";this.state.training=["none","warmup","conditioning","speed"].includes(options?.training)?options.training:"none";this.state.competition=!!options?.competition;const clampStat=(v,lo=.65,hi=1.7)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):1));this.state.playerSpeed=clampStat(options?.playerSpeed, .65,1.6);this.state.playerPower=clampStat(options?.playerPower,.65,1.7);this.state.playerControl=clampStat(options?.playerControl,.65,1.6);this.state.aiSpeed=clampStat(options?.aiSpeed,.65,1.6);this.state.aiPower=clampStat(options?.aiPower,.65,1.7);this.state.aiAccuracy=clampStat(options?.aiAccuracy,.65,1.6);this.state.countdown=0;this.waitSeconds=30;this.startSeconds=0;this.goalPause=0;this.finishTimer=null;this.lastPuckTouchAt=0;this.lastShootAt=new Map();this.aiShotAt=new Map();this.puckContacts=new Set();
  this.privatePasswordSalt=null;this.privatePasswordHash=null;
  if(this.state.private){const password=String(options?.privatePassword||"").trim();if(password.length<4||password.length>64)throw new Error("Private lobby passwords must be between 4 and 64 characters.");this.privatePasswordSalt=randomBytes(16);this.privatePasswordHash=scryptSync(password,this.privatePasswordSalt,32);}
  this.state.hostId="";this.roomCode=options.code||makeCode();this.state.code=this.roomCode;codes.set(this.roomCode,this.roomId);activeRooms.set(this.roomId,this);this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode,lobbyName:this.state.lobbyName,difficulty:this.state.difficulty,training:this.state.training,competition:this.state.competition});
  if(mode==="2v2-ai"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}

  this.onMessage("move",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||this.state.status==="finished")return;
   p.inputX=Math.max(-1,Math.min(1,Number(msg?.x)||0));p.inputY=Math.max(-1,Math.min(1,Number(msg?.y)||0));
  });
  this.onMessage("customize",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.name=cleanName(msg?.name);p.skin=Math.max(0,Math.min(13,Number(msg?.skin)||0));p.trail=0;this.updateTeamNames();});
  this.onMessage("ready",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.ready=!!msg?.ready;if(p.ready)this.beginMatchmaking();});
  this.onMessage("play",(client)=>{const p=this.state.players.get(client.sessionId);if(!p||!["practice","waiting"].includes(this.state.status))return;p.ready=true;this.beginMatchmaking();});
  this.onMessage("shoot",(client,msg)=>{
   const p=this.state.players.get(client.sessionId);if(!p||!["practice","matchmaking","playing"].includes(this.state.status))return;
   const puck=this.state.puck,dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy),contactRadius=29;
   // Match the original game's HIT behaviour: a close physical touch sends the puck away from the skater.
   if(d>=contactRadius)return;
   const now=Date.now(),last=this.lastShootAt.get(client.sessionId)||0;if(now-last<180)return;this.lastShootAt.set(client.sessionId,now);
   let nx=0,ny=0;
   if(d>.001){nx=dx/d;ny=dy/d;}else{const n=Math.hypot(p.inputX,p.inputY);if(n>.001){nx=p.inputX/n;ny=p.inputY/n;}else{nx=p.team===1?1:-1;ny=0;}}
   const power=this.state.playerPower;
   puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*720*power+p.vx;puck.vy=ny*720*power+p.vy;
   this.puckContacts.add(client.sessionId);
   this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:720*power,player:p.name,shot:true});
  });
  this.setSimulationInterval(dt=>this.tick(Math.min(dt,50)/1000),1000/30);
 }
 onJoin(client,options){
  const humanCount=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;
  if(!["practice","matchmaking","waiting"].includes(this.state.status)){client.leave(4002,"Match already started");return;}
  if(humanCount>=CAPACITY[this.state.mode]){client.leave(4001,"Lobby full");return}
  const team=this.state.mode==="2v2-ai"?1:(humanCount%2===0?1:2);
  const p=new Player();p.sessionId=client.sessionId;p.name=cleanName(options?.name);p.team=team;p.x=team===1?130:770;p.y=150+humanCount*55;p.skin=Math.max(0,Math.min(13,Number(options?.skin)||0));p.trail=Math.max(0,Math.min(7,Number(options?.trail)||0));
  this.state.players.set(client.sessionId,p);if(!this.state.hostId)this.state.hostId=client.sessionId;this.updateTeamNames();
  const humansNow=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")).length;
  if(this.matchmakingStarted&&humansNow>=CAPACITY[this.state.mode])this.startFaceoff();
  this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});
 }
 onLeave(client){
  const leaving=this.state.players.get(client.sessionId);
  if(!leaving)return; // A rejected late/full-room join must not stop the current match.
  this.lastShootAt.delete(client.sessionId);this.aiShotAt.delete(client.sessionId);this.puckContacts.delete(client.sessionId);
  const leavingName=leaving.name||"A player",wasMatchActive=["matchmaking","countdown","playing","goal","finished"].includes(this.state.status);
  this.state.players.delete(client.sessionId);
  if(this.state.hostId===client.sessionId){const next=this.state.players.keys().next();this.state.hostId=next.done?"":next.value;}
  this.updateTeamNames();
  const humansRemaining=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length;
  if(!humansRemaining){
   clearTimeout(this.finishTimer);this.finishTimer=null;this.cancelMatchmaking();
   for(const id of Array.from(this.state.players.keys()))this.state.players.delete(id);
   this.state.hostId="";this.state.status="practice";this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.resetPuck();
   if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);activeRooms.delete(this.roomId);
   return;
  }
  if(wasMatchActive){
   clearTimeout(this.finishTimer);this.finishTimer=null;this.cancelMatchmaking();
   for(const [id,p] of Array.from(this.state.players.entries())){if(id.startsWith("ai-")){this.state.players.delete(id);continue;}p.ready=false;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;p.x=p.team===1?130:770;p.y=300;}
   this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.resetPuck();this.state.status="practice";this.state.countdown=0;
   this.broadcast("playerLeft",{name:leavingName,message:leavingName+" left. Match stopped — back to practice."});
  }else{
   if(this.matchmakingStarted&&Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")).length===0)this.cancelMatchmaking();
   this.broadcast("playerLeft",{name:leavingName,message:leavingName+" left the practice rink."});
  }
  this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});
 }
 matchesPrivatePassword(value){
  if(!this.state.private)return true;
  const supplied=String(value??"").trim();
  if(supplied.length<4||supplied.length>64||!this.privatePasswordSalt||!this.privatePasswordHash)return false;
  const candidate=scryptSync(supplied,this.privatePasswordSalt,32);
  return candidate.length===this.privatePasswordHash.length&&timingSafeEqual(candidate,this.privatePasswordHash);
 }
 onAuth(client,options){
  if(this.state.private&&!this.matchesPrivatePassword(options?.privatePassword))throw new Error("Incorrect private lobby password.");
  return true;
 }
 updateTeamNames(){
  const first={1:"",2:""};
  for(const p of this.state.players.values()){if(p.sessionId.startsWith("ai-"))continue;if(!first[p.team])first[p.team]=p.name||"Player";}
  this.state.teamName1=first[1]||"Team 1";this.state.teamName2=first[2]||"Team 2";
 }
 finishMatch(){
  const state=this.state;
  if(!state||state.status==="finished")return;
  this.cancelMatchmaking();state.status="finished";state.countdown=0;
  const result={score1:state.puck.score1,score2:state.puck.score2};
  this.broadcast("finished",result);
  clearTimeout(this.finishTimer);
  this.finishTimer=setTimeout(()=>{
   this.finishTimer=null;
   if(!this.state||this.state.status!=="finished")return;
   for(const [id,p] of Array.from(this.state.players.entries())){
    if(id.startsWith("ai-")&&this.state.mode!=="2v2-ai"){this.state.players.delete(id);continue;}
    p.ready=false;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;
   }
   this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.state.countdown=0;
   this.resetPuck();this.resetPlayers();this.state.status="practice";
   this.broadcast("lobbyReady",{message:"Match finished — back in the lobby. Press PLAY for a rematch."});
   this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length,capacity:CAPACITY[this.state.mode]});
  },3300);
 }
 tick(dt){
  const state=this.state;
  if(state.status==="practice"){this.simulateRink(dt,true);return;}
  if(state.status==="matchmaking"){this.waitSeconds=Math.max(0,this.waitSeconds-dt);state.countdown=Math.ceil(this.waitSeconds);this.simulateRink(dt,true);return;}
  if(state.status==="countdown"){this.startSeconds=Math.max(0,this.startSeconds-dt);state.countdown=Math.ceil(this.startSeconds);if(this.startSeconds<=0){state.status="playing";state.countdown=0;this.broadcast("matchStarted",{team1:state.teamName1,team2:state.teamName2});}return;}
  if(state.status==="goal"){this.goalPause=Math.max(0,this.goalPause-dt);if(this.goalPause<=0)this.startFaceoff();return;}
  if(state.status!=="playing")return;
  state.matchTime=Math.max(0,state.matchTime-dt);
  if(state.matchTime<=0){this.finishMatch();return;}
  this.simulateRink(dt,false);
 }
 simulateRink(dt,practice=false){
  const state=this.state,puck=state.puck;
  const rinkW=900,rinkH=600,playerR=19,puckR=10,diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,trainingScale=state.training==="warmup"?.82:state.training==="speed"?1.18:state.training==="conditioning"?1.05:1;
  const ps=Array.from(state.players.values());
  for(const p of ps){
   if(p.sessionId.startsWith("ai-")){
    const teamDir=p.team===1?1:-1,index=Number(p.sessionId.split("-")[2])||1;
    const tx=Math.max(50,Math.min(850,puck.x-teamDir*(index===1?24:75))),ty=Math.max(55,Math.min(545,puck.y+(index===1?-22:35)));
    let dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1;p.inputX=dx/d*.86;p.inputY=dy/d*.86;
    const puckDistance=Math.hypot(puck.x-p.x,puck.y-p.y),now=Date.now(),lastShot=this.aiShotAt.get(p.sessionId)||0;
    if(puckDistance<playerR+puckR&&now-lastShot>420&&Math.random()<.16){
     this.aiShotAt.set(p.sessionId,now);const gx=teamDir===1?880:20,deviation=90/Math.max(.55,state.aiAccuracy*diffScale),gy=300+(Math.random()-.5)*deviation,dx=gx-p.x,dy=gy-p.y,gd=Math.hypot(dx,dy)||1,nx=dx/gd,ny=dy/gd,power=state.aiPower*diffScale;
     puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*720*power+p.vx;puck.vy=ny*720*power+p.vy;this.puckContacts.add(p.sessionId);
     this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:720*power,player:p.name,shot:true});
    }
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
  puck.x+=puck.vx*dt;puck.y+=puck.vy*dt;puck.vx*=Math.pow(.35,dt);puck.vy*=Math.pow(.35,dt);
  const goalTop=rinkH/2-46,goalBottom=rinkH/2+46;
  if(puck.y<35||puck.y>rinkH-35){puck.y=Math.max(35,Math.min(rinkH-35,puck.y));puck.vy*=-.88;}
  if(puck.x<25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x=25;puck.vx=Math.abs(puck.vx)*.88;}
  if(puck.x>rinkW-25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x= rinkW-25;puck.vx=-Math.abs(puck.vx)*.88;}
  const activePuckContacts=new Set(),contactRadius=playerR+puckR;
  for(const p of ps){
   const dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);
   if(d>contactRadius+4)continue;
   activePuckContacts.add(p.sessionId);
   if(d>=contactRadius||d<=.001||this.puckContacts.has(p.sessionId))continue;
   // The original game hits the puck out from the point of contact. Never drag or repeatedly push it while overlapping.
   let nx=0,ny=0;if(d>.001){nx=dx/d;ny=dy/d;}else{const n=Math.hypot(p.inputX,p.inputY);if(n>.001){nx=p.inputX/n;ny=p.inputY/n;}else{nx=p.team===1?1:-1;ny=0;}}
   const isAI=p.sessionId.startsWith("ai-"),diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,power=isAI?state.aiPower*diffScale:1,force=360*power;
   puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*force+p.vx;puck.vy=ny*force+p.vy;this.puckContacts.add(p.sessionId);
   const now=Date.now();if(now-this.lastPuckTouchAt>80){this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:force,player:p.name,shot:false});}
  }
  for(const id of this.puckContacts)if(!activePuckContacts.has(id))this.puckContacts.delete(id);
  const puckSpeed=Math.hypot(puck.vx,puck.vy);if(puckSpeed>900){puck.vx=puck.vx/puckSpeed*900;puck.vy=puck.vy/puckSpeed*900;}
  const crossedLeft=puck.x<2&&puck.y>goalTop&&puck.y<goalBottom,crossedRight=puck.x>rinkW-2&&puck.y>goalTop&&puck.y<goalBottom;
  if(practice&&(crossedLeft||crossedRight)){this.resetPuck();this.broadcast("practiceGoal",{message:"Practice shot! Puck reset to centre."});}
  else if(!practice&&crossedLeft){puck.score2++;this.broadcast("goal",{team:2,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.competition&&puck.score2>=5){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
  else if(!practice&&crossedRight){puck.score1++;this.broadcast("goal",{team:1,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.competition&&puck.score1>=5){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
 }
 beginMatchmaking(){
  if(!this.state||!["practice","waiting"].includes(this.state.status)||this.matchmakingStarted)return;
  const mode=this.state.mode,capacity=TOTAL_SLOTS[mode]||CAPACITY[mode];
  if(this.state.players.size>=capacity){this.startFaceoff();return;}
  this.matchmakingStarted=true;this.state.status="matchmaking";this.waitSeconds=30;this.state.countdown=30;
  this.broadcast("countdown",{seconds:30,started:true});
  this.aiCountdown=setInterval(()=>{if(!this.state||this.state.status!=="matchmaking"||!this.matchmakingStarted)return;this.broadcast("countdown",{seconds:this.state.countdown,started:true});},1000);
  this.aiFillTimer=setTimeout(()=>{
   this.aiFillTimer=null;clearInterval(this.aiCountdown);this.aiCountdown=null;this.matchmakingStarted=false;
   if(!this.state)return;
   const humans=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")).length;
   if(!humans){this.state.countdown=0;return;}
   const total=TOTAL_SLOTS[this.state.mode]||CAPACITY[this.state.mode];let n=1;
   while(this.state.players.size<total){let team=this.state.mode==="1v1"?2:(this.state.players.size%2===0?1:2);while(this.state.players.has("ai-"+team+"-"+n))n++;addAI(this,team,n++);}
   this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,private:this.state.private,players:this.state.players.size,capacity:CAPACITY[this.state.mode]});
   this.startFaceoff();
  },30000);
 }
 cancelMatchmaking(){
  clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);
  this.aiFillTimer=null;this.aiCountdown=null;this.matchmakingStarted=false;this.waitSeconds=30;this.state.countdown=0;
 }

 resetPlayers(){const teams={1:[],2:[]};for(const p of this.state.players.values())teams[p.team===1?1:2].push(p);for(const team of [1,2]){const roster=teams[team];roster.forEach((p,idx)=>{p.x=team===1?130:770;p.y=300+(idx-(roster.length-1)/2)*58;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;});}}
 startFaceoff(){this.cancelMatchmaking();this.resetPuck();this.resetPlayers();this.startSeconds=3;this.state.status="countdown";this.state.countdown=3;this.broadcast("faceoff",{seconds:3,team1:this.state.teamName1,team2:this.state.teamName2});}
 resetPuck(){this.state.puck.x=450;this.state.puck.y=300;this.state.puck.vx=0;this.state.puck.vy=0;}

 onDispose(){clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);clearTimeout(this.finishTimer);if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);activeRooms.delete(this.roomId);}
}
gameServer.define("hockey",HockeyRoom);
gameServer.define("hockey_public",HockeyRoom).filterBy(["mode","map","difficulty","training","competition"]);
const port=Number(process.env.PORT||2567);
await gameServer.listen(port,"0.0.0.0");
console.log("Hockey multiplayer listening on",port);
