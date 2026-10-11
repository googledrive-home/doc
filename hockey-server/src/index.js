import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

class Player extends Schema {
  constructor() { super(); this.sessionId=""; this.name="Player"; this.team=0; this.x=0; this.y=0; this.vx=0; this.vy=0; this.inputX=0; this.inputY=0; this.skin=0; this.trail=0; this.ready=false; this.spectator=false; this.role="skater"; this.goals=0; this.assists=0; this.shots=0; this.hits=0; this.saves=0; }
}
defineTypes(Player, { sessionId:"string", name:"string", team:"number", x:"number", y:"number", vx:"number", vy:"number", inputX:"number", inputY:"number", skin:"number", trail:"number", ready:"boolean", spectator:"boolean", role:"string", goals:"number", assists:"number", shots:"number", hits:"number", saves:"number" });
class Puck extends Schema {
  constructor(){ super(); this.x=450; this.y=300; this.vx=0; this.vy=0; this.score1=0; this.score2=0; this.lastTouchId=""; this.previousTouchId=""; this.lastTouchAt=0; }
}
defineTypes(Puck,{x:"number",y:"number",vx:"number",vy:"number",score1:"number",score2:"number",lastTouchId:"string",previousTouchId:"string",lastTouchAt:"number"});
class MatchState extends Schema {
  constructor(){super();this.players=new MapSchema();this.puck=new Puck();this.mode="1v1";this.status="practice";this.hostId="";this.private=false;this.lobbyName="Hockey Lobby";this.map="Classic";this.teamName1="Team 1";this.teamName2="Team 2";this.countdown=0;this.matchTime=180;this.matchLength=180;this.difficulty="medium";this.training="none";this.competition=false;this.playerSpeed=1;this.playerPower=1;this.playerControl=1;this.aiSpeed=1;this.aiPower=1;this.aiAccuracy=1;this.gameType="classic";this.shootoutTeam=1;this.shootoutAttempts1=0;this.shootoutAttempts2=0;}
}
defineTypes(MatchState,{players:{map:Player},puck:Puck,mode:"string",status:"string",hostId:"string",private:"boolean",lobbyName:"string",map:"string",code:"string",teamName1:"string",teamName2:"string",countdown:"number",matchTime:"number",matchLength:"number",difficulty:"string",training:"string",competition:"boolean",playerSpeed:"number",playerPower:"number",playerControl:"number",aiSpeed:"number",aiPower:"number",aiAccuracy:"number",gameType:"string",shootoutTeam:"number",shootoutAttempts1:"number",shootoutAttempts2:"number"});

const app=express();
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
app.use(express.json({limit:"4kb"}));
app.get("/",(_req,res)=>res.json({name:"Hockey Multiplayer",status:"ok",protocol:"Colyseus WebSocket",version:1}));
app.get("/health",(_req,res)=>res.status(200).json({ok:true}));
const httpServer=createServer(app);
const gameServer=new Server({transport:new WebSocketTransport({server:httpServer})});
const CAPACITY={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":1 };
const TOTAL_SLOTS={ "1v1":2,"2v2":4,"3v3":6,"2v2-ai":4 };
const playerCapacity=state=>state?.gameType==="goalie"?1:(CAPACITY[state?.mode]||2);
const codes=new Map();
const activeRooms=new Map();
app.get("/rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(st.private||!["practice","matchmaking","waiting","countdown","playing","goal","finished"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,skin:p.skin,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready}));const humans=people.filter(p=>!p.bot&&!p.spectator),spectators=people.filter(p=>p.spectator&&!p.bot),capacity=playerCapacity(st),readyCount=humans.filter(p=>p.ready).length;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Public Lobby",mode:st.mode,gameType:st.gameType||"classic",map:st.map,status:st.status,playerCount:humans.length,spectatorCount:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,capacity,players:humans.map(p=>p.name),roster:people.map(p=>({name:p.name,team:p.team,bot:p.bot,spectator:p.spectator,ready:p.ready}))});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
app.get("/private-rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(!st.private||!["practice","matchmaking","waiting","countdown","playing","goal","finished"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready}));const humans=people.filter(p=>!p.bot&&!p.spectator),spectators=people.filter(p=>p.spectator&&!p.bot),capacity=playerCapacity(st),readyCount=humans.filter(p=>p.ready).length;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Private Lobby",mode:st.mode,gameType:st.gameType||"classic",map:st.map,status:st.status,playerCount:humans.length,spectatorCount:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,capacity,players:humans.map(p=>p.name),roster:people});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
function findRoomByCode(code){const roomId=codes.get(code);return (roomId&&activeRooms.get(roomId))||Array.from(activeRooms.values()).find(candidate=>candidate.roomCode===code)||null;}
function roomSummary(room){const st=room.state,players=Array.from(st.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator).map(p=>({name:p.name,team:p.team,skin:p.skin,ready:p.ready}));return {roomId:room.roomId,code:room.roomCode,private:st.private,lobbyName:st.lobbyName||"Hockey Lobby",mode:st.mode,map:st.map,status:st.status,gameType:st.gameType,playerCount:players.length,spectatorCount:Array.from(st.players.values()).filter(p=>p.spectator&&!p.sessionId.startsWith("ai-")).length,capacity:playerCapacity(st),readyCount:players.filter(p=>p.ready).length,players,roster:Array.from(st.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready})),teamName1:st.teamName1,teamName2:st.teamName2,hostId:st.hostId};}
app.get("/room/:code",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found"});if(room.state.private)return res.status(401).json({error:"This private lobby requires its password."});res.json(roomSummary(room));});
app.post("/room/:code/join",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found or lobby has closed."});if(!room.state.private)return res.status(400).json({error:"That code belongs to a public lobby."});if(!room.matchesPrivatePassword(req.body?.password))return res.status(401).json({error:"Incorrect private lobby password."});if(!["practice","matchmaking","waiting"].includes(room.state.status)&&!req.body?.spectator)return res.status(409).json({error:"That match has started. Choose Spectate to watch it."});const humans=Array.from(room.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator).length,spectators=Array.from(room.state.players.values()).filter(p=>p.spectator).length;if(req.body?.spectator?spectators>=8:humans>=playerCapacity(room.state))return res.status(409).json({error:req.body?.spectator?"That match has no spectator slots left.":"That lobby is full."});res.json(roomSummary(room));});
const cleanName=v=>String(v??"Player").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,18)||"Player";
const cleanRoomName=v=>String(v??"Hockey Lobby").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,32)||"Hockey Lobby";
function makeCode(){let code;do{code=randomBytes(3).toString("hex").toUpperCase()}while(codes.has(code));return code}
function addAI(room,team,index){
 const p=new Player();p.sessionId="ai-"+team+"-"+index;p.name="CPU "+index;p.team=team;p.x=team===1?130:770;p.y=180+index*65;p.skin=(team===1?index+3:index+5)%14;p.trail=(index+team)%8;room.state.players.set(p.sessionId,p);
}
class HockeyRoom extends (await import("@colyseus/core")).Room {
 onCreate(options){
  this.maxClients=12;this.autoDispose=true;this.setState(new MatchState());
  const mode=CAPACITY[options.mode]?options.mode:"1v1";
  this.state.mode=mode;this.state.gameType=["classic","shootout","goalie","time-attack"].includes(options?.gameType)?options.gameType:"classic";this.state.private=!!options.private;this.state.lobbyName=cleanRoomName(options?.lobbyName||(cleanName(options?.name)+"’s Lobby"));this.state.map=String(options.map||"Classic").slice(0,24);this.state.teamName1="Team 1";this.state.teamName2="Team 2";this.state.matchTime=Number.isFinite(Number(options?.matchTime))?Math.max(60,Math.min(600,Number(options.matchTime))):180;this.state.matchLength=this.state.matchTime;this.state.difficulty=["easy","medium","hard","extrahard"].includes(options?.difficulty)?options.difficulty:"medium";this.state.training=["none","warmup","conditioning","speed"].includes(options?.training)?options.training:"none";this.state.competition=!!options?.competition;const clampStat=(v,lo=.65,hi=1.7)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):1));this.state.playerSpeed=clampStat(options?.playerSpeed, .65,1.6);this.state.playerPower=clampStat(options?.playerPower,.65,1.7);this.state.playerControl=clampStat(options?.playerControl,.65,1.6);this.state.aiSpeed=clampStat(options?.aiSpeed,.65,1.6);this.state.aiPower=clampStat(options?.aiPower,.65,1.7);this.state.aiAccuracy=clampStat(options?.aiAccuracy,.65,1.6);this.state.countdown=0;this.waitSeconds=30;this.startSeconds=0;this.goalPause=0;this.finishTimer=null;this.lastPuckTouchAt=0;this.lastBoardSoundAt=0;this.lastShootAt=new Map();this.aiShotAt=new Map();this.puckContacts=new Set();
  this.privatePasswordSalt=null;this.privatePasswordHash=null;
  if(this.state.private){const password=String(options?.privatePassword||"").trim();if(password.length<4||password.length>64)throw new Error("Private lobby passwords must be between 4 and 64 characters.");this.privatePasswordSalt=randomBytes(16);this.privatePasswordHash=scryptSync(password,this.privatePasswordSalt,32);}
  this.state.hostId="";this.matchmakingStarted=false;this.matchHistory=[];this.roomCode=options.code||makeCode();this.state.code=this.roomCode;codes.set(this.roomCode,this.roomId);activeRooms.set(this.roomId,this);this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode,lobbyName:this.state.lobbyName,gameType:this.state.gameType,difficulty:this.state.difficulty,training:this.state.training,competition:this.state.competition});
  if(mode==="2v2-ai"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}

  this.onMessage("move",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||this.state.status==="finished")return;
   p.inputX=Math.max(-1,Math.min(1,Number(msg?.x)||0));p.inputY=Math.max(-1,Math.min(1,Number(msg?.y)||0));
  });
  this.onMessage("customize",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.name=cleanName(msg?.name);p.skin=Math.max(0,Math.min(13,Number(msg?.skin)||0));p.trail=0;this.updateTeamNames();this.broadcastLobby();});
  this.onMessage("ready",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","waiting"].includes(this.state.status))return;p.ready=msg?.ready===undefined?!p.ready:!!msg.ready;this.broadcastLobby();this.broadcast("lobbyNotice",{message:p.name+(p.ready?" is ready.":" is changing settings.")});});
  this.onMessage("play",(client)=>this.startMatch(client));
  this.onMessage("startMatch",(client)=>this.startMatch(client));
  this.onMessage("setTeam",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","waiting"].includes(this.state.status))return;const team=Number(msg?.team);if(team!==1&&team!==2)return;if(this.state.mode==="2v2-ai"&&team!==1){client.send("lobbyNotice",{message:"In 2v2 AI mode you play for Team 1."});return;}const maxPerTeam=Math.ceil((CAPACITY[this.state.mode]||2)/2),used=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")&&!q.spectator&&q.team===team&&q.sessionId!==client.sessionId).length;if(used>=maxPerTeam){client.send("lobbyNotice",{message:"That team is full. Choose the other side."});return;}p.team=team;p.ready=false;p.x=team===1?130:770;p.y=300;p.vx=0;p.vy=0;this.updateTeamNames();this.broadcastLobby();});
  this.onMessage("hostSettings",(client,msg)=>this.applyHostSettings(client,msg));
  this.onMessage("kick",(client,msg)=>{if(client.sessionId!==this.state.hostId)return;const targetId=String(msg?.sessionId||"");if(!targetId||targetId===this.state.hostId||targetId.startsWith("ai-"))return;const target=this.clients.find(c=>c.sessionId===targetId);if(target){target.leave(4004,"Removed from lobby by host");this.broadcast("lobbyNotice",{message:"A player was removed by the host."});}});
  this.onMessage("spectate",(client)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator)return;p.spectator=true;p.team=0;p.ready=false;p.inputX=0;p.inputY=0;p.vx=0;p.vy=0;if(this.state.hostId===p.sessionId){const next=Array.from(this.state.players.values()).find(q=>!q.spectator&&!q.sessionId.startsWith("ai-"));this.state.hostId=next?.sessionId||"";}this.broadcast("lobbyNotice",{message:p.name+" is now spectating."});this.broadcastLobby();});
  this.onMessage("playAsPlayer",(client)=>{const p=this.state.players.get(client.sessionId);if(!p||!p.spectator||!["practice","waiting"].includes(this.state.status))return;const humans=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")&&!q.spectator).length;if(humans>=(CAPACITY[this.state.mode]||2)){client.send("lobbyNotice",{message:"The player slots are full."});return;}p.spectator=false;p.team=this.assignTeam();p.x=p.team===1?130:770;p.y=300;p.ready=false;if(!this.state.hostId)this.state.hostId=p.sessionId;this.broadcastLobby();});
  this.onMessage("shoot",(client,msg)=>{
   const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","matchmaking","playing"].includes(this.state.status))return;
   const puck=this.state.puck,dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy),contactRadius=29;
   // Power hits are explicit and only register at true close contact. In shootouts only the active team may shoot.
   if(p.role==="goalie"||d>=contactRadius||(this.state.gameType==="shootout"&&p.team!==this.state.shootoutTeam))return;
   const now=Date.now(),last=this.lastShootAt.get(client.sessionId)||0;if(now-last<180)return;this.lastShootAt.set(client.sessionId,now);
   let nx=0,ny=0;
   if(d>.001){nx=dx/d;ny=dy/d;}else{const n=Math.hypot(p.inputX,p.inputY);if(n>.001){nx=p.inputX/n;ny=p.inputY/n;}else{nx=p.team===1?1:-1;ny=0;}}
   const power=this.state.playerPower;
   puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*720*power+p.vx;puck.vy=ny*720*power+p.vy;
   this.puckContacts.add(client.sessionId);p.shots++;puck.previousTouchId=puck.lastTouchId;puck.lastTouchId=p.sessionId;puck.lastTouchAt=now;
   this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:720*power,player:p.name,shot:true});
  });
  this.setSimulationInterval(dt=>this.tick(Math.min(dt,50)/1000),1000/30);
 }
 onJoin(client,options){
  const spectator=!!options?.spectator;
  const humans=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator);
  if(!spectator&&!["practice","waiting"].includes(this.state.status)){client.leave(4002,"This match has started; join as a spectator instead.");return;}
  if(!spectator&&humans.length>=playerCapacity(this.state)){client.leave(4001,this.state.gameType==="goalie"?"Goalie Challenge is a solo mode; join as a spectator instead.":"Lobby full");return;}
  if(spectator&&Array.from(this.state.players.values()).filter(p=>p.spectator).length>=8){client.leave(4003,"Spectator slots are full");return;}
  const team=spectator?0:this.assignTeam();
  const p=new Player();p.sessionId=client.sessionId;p.name=cleanName(options?.name);p.team=team;p.spectator=spectator;p.role=!spectator&&this.state.gameType==="goalie"?"goalie":"skater";p.ready=false;p.x=p.role==="goalie"?850:team===1?130:team===2?770:450;p.y=300;p.skin=Math.max(0,Math.min(13,Number(options?.skin)||0));p.trail=0;
  this.state.players.set(client.sessionId,p);
  if(!this.state.hostId&&!spectator)this.state.hostId=client.sessionId;
  this.updateTeamNames();this.broadcastLobby();
  if(spectator)this.broadcast("lobbyNotice",{message:p.name+" joined as a spectator."});
 }
 onLeave(client){
  const leaving=this.state.players.get(client.sessionId);
  if(!leaving)return;
  this.lastShootAt.delete(client.sessionId);this.aiShotAt.delete(client.sessionId);this.puckContacts.delete(client.sessionId);
  const leavingName=leaving.name||"A player",wasMatchActive=["matchmaking","countdown","playing","goal","finished"].includes(this.state.status),wasSpectator=!!leaving.spectator;
  this.state.players.delete(client.sessionId);
  if(this.state.hostId===client.sessionId){const next=Array.from(this.state.players.values()).find(p=>!p.spectator&&!p.sessionId.startsWith("ai-"));this.state.hostId=next?.sessionId||"";}
  this.updateTeamNames();
  if(wasSpectator){this.broadcastLobby();this.broadcast("lobbyNotice",{message:leavingName+" stopped spectating."});return;}
  const humansRemaining=Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator).length;
  if(!humansRemaining){
   clearTimeout(this.finishTimer);this.finishTimer=null;this.cancelMatchmaking();
   for(const id of Array.from(this.state.players.keys()))this.state.players.delete(id);
   this.state.hostId="";this.state.status="practice";this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.resetPuck();this.broadcast("roomClosed",{message:"The last player left. This lobby has closed."});
   for(const connectedClient of this.clients){try{connectedClient.leave(4005,"Lobby closed");}catch{}}
   if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);activeRooms.delete(this.roomId);return;
  }
  if(wasMatchActive){
   clearTimeout(this.finishTimer);this.finishTimer=null;this.cancelMatchmaking();
   for(const [id,p] of Array.from(this.state.players.entries())){if(id.startsWith("ai-")){this.state.players.delete(id);continue;}if(p.spectator)continue;p.ready=false;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;p.x=p.team===1?130:770;p.y=300;}
   this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.resetPuck();this.state.status="practice";this.state.countdown=0;
   this.broadcast("playerLeft",{name:leavingName,message:leavingName+" left. Match stopped — back to the lobby."});
  }else{
   this.broadcast("playerLeft",{name:leavingName,message:leavingName+" left the lobby."});
  }
  this.broadcastLobby();
 }
 assignTeam(){if(this.state.gameType==="goalie")return 2;if(this.state.mode==="2v2-ai")return 1;const teams=[0,0];for(const p of this.state.players.values())if(!p.spectator&&!p.sessionId.startsWith("ai-"))teams[p.team===2?1:0]++;return teams[0]<=teams[1]?1:2;}
 broadcastLobby(){if(!this.state)return;const humans=Array.from(this.state.players.values()).filter(p=>!p.spectator&&!p.sessionId.startsWith("ai-")),spectators=Array.from(this.state.players.values()).filter(p=>p.spectator&&!p.sessionId.startsWith("ai-")),readyCount=humans.filter(p=>p.ready).length;this.broadcast("lobby",{code:this.roomCode,roomId:this.roomId,mode:this.state.mode,gameType:this.state.gameType,map:this.state.map,private:this.state.private,lobbyName:this.state.lobbyName,players:humans.length,capacity:CAPACITY[this.state.mode]||2,spectators:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,hostId:this.state.hostId,status:this.state.status,roster:Array.from(this.state.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready,goals:p.goals,assists:p.assists,shots:p.shots,hits:p.hits,saves:p.saves}))});}
 applyHostSettings(client,msg){
  if(!this.state||client.sessionId!==this.state.hostId||!["practice","waiting"].includes(this.state.status))return;
  const humans=Array.from(this.state.players.values()).filter(p=>!p.spectator&&!p.sessionId.startsWith("ai-")),nextMode=CAPACITY[msg?.mode]?msg.mode:this.state.mode,nextGameType=["classic","shootout","goalie","time-attack"].includes(msg?.gameType)?msg.gameType:"classic";
  const nextCapacity=nextGameType==="goalie"?1:(CAPACITY[nextMode]||2);
  if(humans.length>nextCapacity){client.send("lobbyNotice",{message:"That game type has fewer player slots than the current lobby roster."});return;}
  this.state.mode=nextMode;this.state.gameType=nextGameType;
  for(const p of humans){p.role=this.state.gameType==="goalie"?"goalie":"skater";if(p.role==="goalie"){p.team=2;p.x=850;p.y=300;p.vx=0;p.vy=0;}else if(p.team===0){p.team=this.assignTeam();}}
  const maps=["Classic","Arctic","Midnight","Neon","Sunset","Storm","Aurora","Stadium","Championship","Harbor","Metro","Galaxy"];
  this.state.map=maps.includes(msg?.map)?msg.map:"Classic";this.state.matchTime=Math.max(30,Math.min(600,Number(msg?.matchTime)||180));this.state.matchLength=this.state.matchTime;
  this.state.difficulty=["easy","medium","hard","extrahard"].includes(msg?.difficulty)?msg.difficulty:"medium";this.state.training=["none","warmup","conditioning","speed"].includes(msg?.training)?msg.training:"none";this.state.competition=!!msg?.competition;
  for(const p of humans)p.ready=false;
  for(const [id,p] of Array.from(this.state.players.entries()))if(id.startsWith("ai-"))this.state.players.delete(id);
  if(this.state.mode==="2v2-ai"&&this.state.gameType!=="goalie"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}
  this.updateTeamNames();this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode,lobbyName:this.state.lobbyName,gameType:this.state.gameType,difficulty:this.state.difficulty,training:this.state.training,competition:this.state.competition});
  this.broadcastLobby();this.broadcast("lobbyNotice",{message:"Host updated lobby settings. Players need to ready up again."});
 }
 startMatch(client){
  if(!this.state||client.sessionId!==this.state.hostId||!["practice","waiting"].includes(this.state.status))return;
  const humans=Array.from(this.state.players.values()).filter(p=>!p.spectator&&!p.sessionId.startsWith("ai-"));if(!humans.length)return;
  const notReady=humans.filter(p=>!p.ready);if(notReady.length){client.send("lobbyNotice",{message:"Everyone must ready up before the host can start the match."});return;}
  this.cancelMatchmaking();this.resetMatchStats();this.state.puck.score1=0;this.state.puck.score2=0;
  for(const [id,p] of Array.from(this.state.players.entries()))if(id.startsWith("ai-"))this.state.players.delete(id);
  if(this.state.gameType==="goalie"){
   for(const p of humans){p.role="goalie";p.team=2;p.x=850;p.y=300;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;p.ready=false;}
   addAI(this,1,1);addAI(this,1,2);addAI(this,1,3);
   this.state.matchTime=this.state.matchLength;this.broadcastLobby();this.broadcast("matchStarting",{gameType:this.state.gameType,mode:this.state.mode,message:"Goalie challenge starting"});this.startFaceoff();return;
  }
  for(const p of humans)p.role="skater";
  if(this.state.gameType==="shootout"){this.state.shootoutTeam=1;this.state.shootoutAttempts1=0;this.state.shootoutAttempts2=0;}
  this.state.matchTime=this.state.gameType==="time-attack"?60:this.state.matchLength;
  const total=TOTAL_SLOTS[this.state.mode]||CAPACITY[this.state.mode],counts=[0,0];
  for(const p of this.state.players.values())if(!p.spectator)counts[p.team===2?1:0]++;
  let next=1;while(Array.from(this.state.players.values()).filter(p=>!p.spectator).length<total){const team=counts[0]<=counts[1]?1:2;while(this.state.players.has("ai-"+team+"-"+next))next++;addAI(this,team,next++);counts[team-1]++;}
  for(const p of humans)p.ready=false;this.broadcastLobby();this.broadcast("matchStarting",{gameType:this.state.gameType,mode:this.state.mode,message:"Match starting"});this.startFaceoff();
 }
 completeShootoutAttempt(scoredTeam=0){
  const state=this.state;if(!state||state.gameType!=="shootout"||state.status!=="playing")return;
  const attemptingTeam=state.shootoutTeam,puck=state.puck;
  if(scoredTeam===1||scoredTeam===2){if(scoredTeam===1)puck.score1++;else puck.score2++;this.recordGoal(scoredTeam);this.broadcast("goal",{team:scoredTeam,score1:puck.score1,score2:puck.score2,shootout:true});}
  if(attemptingTeam===1)state.shootoutAttempts1++;else state.shootoutAttempts2++;
  this.broadcast("shootoutAttemptResult",{team:attemptingTeam,scored:scoredTeam===attemptingTeam,scoredTeam,score1:puck.score1,score2:puck.score2,attempts1:state.shootoutAttempts1,attempts2:state.shootoutAttempts2});
  const a1=state.shootoutAttempts1,a2=state.shootoutAttempts2,g1=puck.score1,g2=puck.score2,remaining1=Math.max(0,5-a1),remaining2=Math.max(0,5-a2);
  const clinched=(a1<5||a2<5)&&(g1>g2+remaining2||g2>g1+remaining1);
  const pairedSuddenDeath=a1>=5&&a2>=5&&a1===a2;
  if(clinched||(pairedSuddenDeath&&g1!==g2)){this.finishMatch();return;}
  state.shootoutTeam=attemptingTeam===1?2:1;state.status="goal";state.countdown=0;this.goalPause=1.65;this.resetPuck();this.resetPlayers();
  this.broadcast("shootoutStatus",{team:state.shootoutTeam,score1:puck.score1,score2:puck.score2,attempts1:a1,attempts2:a2,nextAttempt:Math.max(a1,a2)+1,suddenDeath:a1>=5&&a2>=5});
 }
 recordGoal(team){const puck=this.state.puck,scorer=this.state.players.get(puck.lastTouchId),assister=this.state.players.get(puck.previousTouchId);if(scorer&&!scorer.spectator&&scorer.team===team)scorer.goals++;if(assister&&assister!==scorer&&!assister.spectator&&assister.team===team)assister.assists++;this.broadcast("matchStats",this.matchStatsSnapshot());}
 matchStatsSnapshot(){return {score1:this.state.puck.score1,score2:this.state.puck.score2,players:Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).map(p=>({id:p.sessionId,name:p.name,team:p.team,spectator:p.spectator,goals:p.goals,assists:p.assists,shots:p.shots,hits:p.hits,saves:p.saves}))};}
 resetMatchStats(){for(const p of this.state.players.values()){p.goals=0;p.assists=0;p.shots=0;p.hits=0;p.saves=0;}this.state.puck.lastTouchId="";this.state.puck.previousTouchId="";this.state.puck.lastTouchAt=0;}
 onDrop(client,code){try{this.allowReconnection(client,18).then(()=>this.broadcast("playerReconnected",{name:this.state.players.get(client.sessionId)?.name||"Player"})).catch(()=>{});}catch{}}
 onReconnect(client){this.broadcast("playerReconnected",{name:this.state.players.get(client.sessionId)?.name||"Player"});this.broadcastLobby();}
 emitBoardHit(speed){const now=Date.now();if(speed<110||now-this.lastBoardSoundAt<130)return;this.lastBoardSoundAt=now;this.broadcast("boardHit",{speed});}
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
  for(const p of this.state.players.values()){if(p.sessionId.startsWith("ai-")||p.spectator)continue;if((p.team===1||p.team===2)&&!first[p.team])first[p.team]=p.name||"Player";}
  this.state.teamName1=first[1]||"Team 1";this.state.teamName2=first[2]||"Team 2";
 }
 finishMatch(){
  const state=this.state;
  if(!state||state.status==="finished")return;
  this.cancelMatchmaking();state.status="finished";state.countdown=0;
  const result={score1:state.puck.score1,score2:state.puck.score2};
  const goalie=state.gameType==="goalie"?Array.from(state.players.values()).find(p=>p.role==="goalie"&&!p.spectator):null;
  const winner=goalie?(goalie.saves>=result.score1?2:1):result.score1===result.score2?0:result.score1>result.score2?1:2;
  const matchRecord={...this.matchStatsSnapshot(),gameType:state.gameType,mode:state.mode,map:state.map,finishedAt:Date.now(),winner,goalieSaves:goalie?.saves||0,goalsAllowed:goalie?result.score1:0};this.matchHistory.unshift(matchRecord);this.matchHistory=this.matchHistory.slice(0,10);
  this.broadcast("finished",{...result,gameType:state.gameType,winner,goalieSaves:goalie?.saves||0,goalsAllowed:goalie?result.score1:0,stats:matchRecord,history:this.matchHistory});
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
  if(state.status==="countdown"){this.startSeconds=Math.max(0,this.startSeconds-dt);state.countdown=Math.ceil(this.startSeconds);if(this.startSeconds<=0){state.status="playing";state.countdown=state.gameType==="shootout"?8:0;this.shootoutSeconds=state.gameType==="shootout"?8:0;this.broadcast("matchStarted",{team1:state.teamName1,team2:state.teamName2,gameType:state.gameType});if(state.gameType==="shootout")this.broadcast("shootoutStatus",{team:state.shootoutTeam,score1:state.puck.score1,score2:state.puck.score2,attempts1:state.shootoutAttempts1,attempts2:state.shootoutAttempts2,nextAttempt:Math.max(state.shootoutAttempts1,state.shootoutAttempts2)+1,suddenDeath:state.shootoutAttempts1>=5&&state.shootoutAttempts2>=5});}return;}
  if(state.status==="goal"){this.goalPause=Math.max(0,this.goalPause-dt);if(this.goalPause<=0)this.startFaceoff();return;}
  if(state.status!=="playing")return;
  if(state.gameType==="shootout"){this.shootoutSeconds=Math.max(0,(this.shootoutSeconds||0)-dt);state.countdown=Math.ceil(this.shootoutSeconds);if(this.shootoutSeconds<=0){this.completeShootoutAttempt(0);return;}this.simulateRink(dt,false);return;}
  state.matchTime=Math.max(0,state.matchTime-dt);
  if(state.matchTime<=0){this.finishMatch();return;}
  this.simulateRink(dt,false);
 }
 simulateRink(dt,practice=false){
  const state=this.state,puck=state.puck;
  const rinkW=900,rinkH=600,playerR=19,puckR=10,diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,trainingScale=state.training==="warmup"?.82:state.training==="speed"?1.18:state.training==="conditioning"?1.05:1;
  const ps=Array.from(state.players.values()).filter(p=>!p.spectator);
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
   const friction=Math.pow(.13/control,dt);
   if(p.role==="goalie"&&!isAI){
    p.x=p.team===1?50:850;p.vx=0;p.vy+=ay*720*speed*control*dt;p.vy*=friction;
    const goalieMax=250,goalieSpeed=Math.hypot(0,p.vy);if(goalieSpeed>goalieMax)p.vy=Math.sign(p.vy)*goalieMax;
    p.y=Math.max(60,Math.min(540,p.y+p.vy*dt));continue;
   }
   p.vx+=ax*720*speed*control*dt;p.vy+=ay*720*speed*control*dt;p.vx*=friction;p.vy*=friction;
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
  // Damped puck motion. Save the previous point for swept collision detection so a fast puck cannot tunnel through skaters.
  const puckStartX=puck.x,puckStartY=puck.y;
  puck.x+=puck.vx*dt;puck.y+=puck.vy*dt;puck.vx*=Math.pow(.35,dt);puck.vy*=Math.pow(.35,dt);
  const goalTop=rinkH/2-46,goalBottom=rinkH/2+46;
  if(puck.y<35||puck.y>rinkH-35){puck.y=Math.max(35,Math.min(rinkH-35,puck.y));puck.vy*=-.88;this.emitBoardHit(Math.abs(puck.vy));}
  if(puck.x<25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x=25;puck.vx=Math.abs(puck.vx)*.88;this.emitBoardHit(Math.abs(puck.vx));}
  if(puck.x>rinkW-25&&!(puck.y>goalTop&&puck.y<goalBottom)){puck.x= rinkW-25;puck.vx=-Math.abs(puck.vx)*.88;this.emitBoardHit(Math.abs(puck.vx));}
  const activePuckContacts=new Set(),contactRadius=playerR+puckR,travelX=puck.x-puckStartX,travelY=puck.y-puckStartY,travelSq=travelX*travelX+travelY*travelY;
  for(const p of ps){
   if(state.gameType==="shootout"&&p.team!==state.shootoutTeam)continue;
   const t=travelSq>1e-5?Math.max(0,Math.min(1,((p.x-puckStartX)*travelX+(p.y-puckStartY)*travelY)/travelSq)):1;
   const closestX=puckStartX+travelX*t,closestY=puckStartY+travelY*t;
   let dx=closestX-p.x,dy=closestY-p.y,d=Math.hypot(dx,dy),endDx=puck.x-p.x,endDy=puck.y-p.y,endD=Math.hypot(endDx,endDy);
   if(Math.min(d,endD)>contactRadius+3)continue;
   activePuckContacts.add(p.sessionId);
   if(p.spectator)continue;
   // Goalie Challenge: the human guards the right crease, moving only vertically. Fast incoming shots are pushed back into play and recorded as saves.
   if(p.role==="goalie"){
    const incoming=p.team===2?puck.vx>35:puck.vx< -35,puckSpeed=Math.hypot(puck.vx,puck.vy);
    if(incoming&&puckSpeed>70&&(d<contactRadius||endD<contactRadius)){
     dx=endDx;dy=endDy;d=endD;if(d<.001){dx=p.team===2?-1:1;dy=0;d=1;}
     const nx=dx/d,ny=dy/d,rebound=Math.max(180,Math.min(560,puckSpeed*.78));
     puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=(p.team===2?-1:1)*rebound;puck.vy=puck.vy*.35+p.vy*.5;
     p.saves++;p.hits++;this.puckContacts.add(p.sessionId);puck.previousTouchId=puck.lastTouchId;puck.lastTouchId=p.sessionId;puck.lastTouchAt=Date.now();
     this.broadcast("goalieSave",{player:p.name,saves:p.saves,speed:puckSpeed});this.broadcast("puckTouch",{speed:puckSpeed,player:p.name,save:true});this.broadcast("matchStats",this.matchStatsSnapshot());continue;
    }
   }
   if(d>=contactRadius&&endD>=contactRadius)continue;
   // Prefer the actual end position for the response normal. The swept closest point is only used to detect high-speed crossings.
   if(endD>.001){dx=endDx;dy=endDy;d=endD;}else{const n=Math.hypot(p.inputX,p.inputY);dx=n>.001?p.inputX/n:(p.team===1?1:-1);dy=n>.001?p.inputY/n:0;d=1;}
   const nx=dx/d,ny=dy/d,playerDrive=p.vx*nx+p.vy*ny,puckNormalSpeed=puck.vx*nx+puck.vy*ny;
   if(this.puckContacts.has(p.sessionId)){
    // A previous hit during the same touch cannot add another impulse; separate overlapping circles to avoid visual sticking.
    if(endD<contactRadius){puck.x=p.x+nx*35;puck.y=p.y+ny*35;}continue;
   }
   if(playerDrive>24){
    const isAI=p.sessionId.startsWith("ai-"),diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,power=isAI?state.aiPower*diffScale:1,force=360*power+Math.min(130,playerDrive*.2);
    puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*force+p.vx*.35;puck.vy=ny*force+p.vy*.35;this.puckContacts.add(p.sessionId);p.hits++;puck.previousTouchId=puck.lastTouchId;puck.lastTouchId=p.sessionId;puck.lastTouchAt=Date.now();
    const now=Date.now();if(now-this.lastPuckTouchAt>80){this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:force,player:p.name,shot:false});}
   }else if(puckNormalSpeed< -35){
    // If an already-moving puck hits a stationary skater, reflect the incoming velocity instead of magnetising it.
    puck.vx-=(1.78*puckNormalSpeed)*nx;puck.vy-=(1.78*puckNormalSpeed)*ny;
    puck.x=p.x+nx*35;puck.y=p.y+ny*35;
   }else if(endD<contactRadius){
    // Keep the circles from overlapping, but add no energy unless the skater is actually driving into the puck.
    puck.x=p.x+nx*35;puck.y=p.y+ny*35;
   }
  }
  for(const id of this.puckContacts)if(!activePuckContacts.has(id))this.puckContacts.delete(id);
  const puckSpeed=Math.hypot(puck.vx,puck.vy);if(puckSpeed>900){puck.vx=puck.vx/puckSpeed*900;puck.vy=puck.vy/puckSpeed*900;}
  const crossedLeft=puck.x<2&&puck.y>goalTop&&puck.y<goalBottom,crossedRight=puck.x>rinkW-2&&puck.y>goalTop&&puck.y<goalBottom;
  if(practice&&(crossedLeft||crossedRight)){this.resetPuck();this.broadcast("practiceGoal",{message:"Practice shot! Puck reset to centre."});}
  else if(!practice&&state.gameType==="shootout"&&(crossedLeft||crossedRight)){this.completeShootoutAttempt(crossedLeft?2:1);}
  else if(!practice&&state.gameType==="goalie"&&crossedLeft){this.resetPuck();this.broadcast("goalieClear",{message:"The puck cleared the goalie zone. Keep defending!"});}
  else if(!practice&&crossedLeft){puck.score2++;this.recordGoal(2);this.broadcast("goal",{team:2,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.competition&&puck.score2>=5){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
  else if(!practice&&crossedRight){puck.score1++;this.recordGoal(1);this.broadcast("goal",{team:1,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.competition&&puck.score1>=5){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
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

 resetPlayers(){const teams={1:[],2:[]};for(const p of this.state.players.values()){if(p.spectator)continue;if(p.role==="goalie"){p.x=p.team===1?50:850;p.y=300;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;continue;}teams[p.team===1?1:2].push(p);}for(const team of [1,2]){const roster=teams[team];roster.forEach((p,idx)=>{p.x=team===1?130:770;p.y=300+(idx-(roster.length-1)/2)*58;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;});}}
 startFaceoff(){this.cancelMatchmaking();this.resetPuck();this.resetPlayers();if(this.state.gameType==="shootout"){this.state.puck.x=this.state.shootoutTeam===1?270:630;this.state.puck.y=300;}this.startSeconds=3;this.state.status="countdown";this.state.countdown=3;this.broadcast("faceoff",{seconds:3,team1:this.state.teamName1,team2:this.state.teamName2,gameType:this.state.gameType,shootoutTeam:this.state.shootoutTeam,attempts1:this.state.shootoutAttempts1,attempts2:this.state.shootoutAttempts2});}
 resetPuck(){this.state.puck.x=450;this.state.puck.y=300;this.state.puck.vx=0;this.state.puck.vy=0;this.state.puck.lastTouchId="";this.state.puck.previousTouchId="";this.state.puck.lastTouchAt=0;this.puckContacts.clear();}

 onDispose(){clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);clearTimeout(this.finishTimer);if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);activeRooms.delete(this.roomId);}
}
gameServer.define("hockey",HockeyRoom);
gameServer.define("hockey_public",HockeyRoom).filterBy(["mode","gameType","map","difficulty","training","competition"]);
const port=Number(process.env.PORT||2567);
await gameServer.listen(port,"0.0.0.0");
console.log("Hockey multiplayer listening on",port);
