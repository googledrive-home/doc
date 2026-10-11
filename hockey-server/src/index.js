import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

class Player extends Schema {
  constructor() { super(); this.sessionId=""; this.name="Player"; this.team=0; this.x=0; this.y=0; this.vx=0; this.vy=0; this.inputX=0; this.inputY=0; this.skin=0; this.trail=0; this.ready=false; this.spectator=false; this.role="skater"; this.goals=0; this.assists=0; this.shots=0; this.shotsOnGoal=0; this.hits=0; this.saves=0; }
}
defineTypes(Player, { sessionId:"string", name:"string", team:"number", x:"number", y:"number", vx:"number", vy:"number", inputX:"number", inputY:"number", skin:"number", trail:"number", ready:"boolean", spectator:"boolean", role:"string", goals:"number", assists:"number", shots:"number", shotsOnGoal:"number", hits:"number", saves:"number" });
class Puck extends Schema {
  constructor(){ super(); this.x=450; this.y=300; this.vx=0; this.vy=0; this.score1=0; this.score2=0; this.lastTouchId=""; this.previousTouchId=""; this.lastTouchAt=0; }
}
defineTypes(Puck,{x:"number",y:"number",vx:"number",vy:"number",score1:"number",score2:"number",lastTouchId:"string",previousTouchId:"string",lastTouchAt:"number"});
class MatchState extends Schema {
  constructor(){super();this.players=new MapSchema();this.puck=new Puck();this.mode="1v1";this.status="practice";this.hostId="";this.private=false;this.lobbyName="Hockey Lobby";this.map="Classic";this.teamName1="Team 1";this.teamName2="Team 2";this.countdown=0;this.matchTime=180;this.matchLength=180;this.difficulty="medium";this.training="none";this.competition=false;this.playerSpeed=1;this.playerPower=1;this.playerControl=1;this.aiSpeed=1;this.aiPower=1;this.aiAccuracy=1;this.gameType="classic";this.overtime=false;this.overtimePeriod=0;this.shootoutTeam=1;this.shootoutAttempts1=0;this.shootoutAttempts2=0;}
}
defineTypes(MatchState,{players:{map:Player},puck:Puck,mode:"string",status:"string",hostId:"string",private:"boolean",lobbyName:"string",map:"string",code:"string",teamName1:"string",teamName2:"string",countdown:"number",matchTime:"number",matchLength:"number",difficulty:"string",training:"string",competition:"boolean",playerSpeed:"number",playerPower:"number",playerControl:"number",aiSpeed:"number",aiPower:"number",aiAccuracy:"number",gameType:"string",overtime:"boolean",overtimePeriod:"number",shootoutTeam:"number",shootoutAttempts1:"number",shootoutAttempts2:"number"});

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
const competitions=new Map();
function competitionStandings(comp){
 const table=new Map(comp.teams.map(t=>[t.id,{id:t.id,name:t.name,captain:t.captain,played:0,wins:0,draws:0,losses:0,goalsFor:0,goalsAgainst:0,goalDifference:0,points:0}]));
 if(comp.format==="league")for(const match of comp.matches){if(match.status!=="complete"||match.homeScore===null||match.awayScore===null)continue;
  const home=table.get(match.homeId),away=table.get(match.awayId);if(!home||!away)continue;
  home.played++;away.played++;home.goalsFor+=match.homeScore;home.goalsAgainst+=match.awayScore;away.goalsFor+=match.awayScore;away.goalsAgainst+=match.homeScore;
  if(match.homeScore>match.awayScore){home.wins++;away.losses++;home.points+=3;}else if(match.homeScore<match.awayScore){away.wins++;home.losses++;away.points+=3;}else{home.draws++;away.draws++;home.points++;away.points++;}
 }
 const rows=[...table.values()];for(const team of rows)team.goalDifference=team.goalsFor-team.goalsAgainst;
 return rows.sort((a,b)=>b.points-a.points||b.goalDifference-a.goalDifference||b.goalsFor-a.goalsFor||a.name.localeCompare(b.name));
}
function publicCompetition(comp){
 const rounds=comp.rounds.map((ids,index)=>({round:index+1,matches:ids.map(id=>comp.matches.find(match=>match.id===id)).filter(Boolean).map(match=>({...match}))}));
 return {id:comp.id,name:comp.name,format:comp.format,maxTeams:comp.maxTeams,status:comp.status,createdAt:comp.createdAt,startedAt:comp.startedAt||null,completedAt:comp.completedAt||null,champion:comp.champion||null,teams:comp.teams.map(team=>({id:team.id,name:team.name,captain:team.captain,registeredAt:team.registeredAt})),rounds,standings:comp.format==="league"?competitionStandings(comp):[],currentRound:comp.rounds.findIndex(ids=>ids.some(id=>comp.matches.find(match=>match.id===id)?.status==="scheduled"))+1};
}
function organizerAuthorized(comp,key){const left=Buffer.from(String(key||"")),right=Buffer.from(comp?.organizerKey||"");return !!comp&&left.length>0&&left.length===right.length&&timingSafeEqual(left,right);}
function createMatch(comp,round,home,away){
 const match={id:"m-"+randomBytes(5).toString("hex"),round,homeId:home.id,awayId:away.id,homeName:home.name,awayName:away.name,homeScore:null,awayScore:null,status:"scheduled",roomCode:"",winnerId:null,completedAt:null};
 comp.matches.push(match);return match.id;
}
function startCompetition(comp){
 comp.status="in-progress";comp.startedAt=Date.now();
 if(comp.format==="tournament"){
  const ids=[];for(let i=0;i<comp.teams.length;i+=2)ids.push(createMatch(comp,1,comp.teams[i],comp.teams[i+1]));
  comp.rounds=[ids];return;
 }
 const rotating=[...comp.teams],roundCount=rotating.length-1,half=rotating.length/2,rounds=[];
 for(let r=0;r<roundCount;r++){
  const ids=[];
  for(let i=0;i<half;i++){const home=rotating[i],away=rotating[rotating.length-1-i];ids.push(createMatch(comp,r+1,home,away));}
  rounds.push(ids);rotating.splice(1,0,rotating.pop());
 }
 comp.rounds=rounds;
}
function progressCompetition(comp){
 if(comp.format==="league"){
  if(comp.rounds.every(round=>round.every(id=>comp.matches.find(m=>m.id===id)?.status==="complete"))){comp.status="completed";comp.completedAt=Date.now();const standings=competitionStandings(comp);comp.champion=standings.length?standings[0].name:null;}
  return;
 }
 const current=comp.rounds[comp.rounds.length-1]||[];
 if(!current.length||current.some(id=>comp.matches.find(m=>m.id===id)?.status!=="complete"))return;
 const winners=current.map(id=>{const match=comp.matches.find(m=>m.id===id);return comp.teams.find(t=>t.id===match.winnerId);}).filter(Boolean);
 if(winners.length===1){comp.status="completed";comp.completedAt=Date.now();comp.champion=winners[0].name;return;}
 const nextRound=comp.rounds.length+1,ids=[];for(let i=0;i<winners.length;i+=2)ids.push(createMatch(comp,nextRound,winners[i],winners[i+1]));comp.rounds.push(ids);
}
app.get("/competitions",(_req,res)=>{res.setHeader("Cache-Control","no-store");res.json({competitions:[...competitions.values()].sort((a,b)=>b.createdAt-a.createdAt).map(publicCompetition)});});
app.get("/competitions/:id",(req,res)=>{const comp=competitions.get(String(req.params.id||""));if(!comp)return res.status(404).json({error:"Competition not found."});res.setHeader("Cache-Control","no-store");res.json({competition:publicCompetition(comp)});});
app.post("/competitions",(req,res)=>{
 const name=String(req.body?.name||"").trim().replace(/\s+/g," "),format=req.body?.format==="league"?"league":"tournament",maxTeams=Number(req.body?.maxTeams)===8?8:4;
 if(name.length<3||name.length>40)return res.status(400).json({error:"Competition name must be 3–40 characters."});
 if(competitions.size>=100)return res.status(429).json({error:"Competition list is full for this server session."});
 const id="comp-"+randomBytes(5).toString("hex"),organizerKey=randomBytes(24).toString("hex");
 const comp={id,name,format,maxTeams,status:"registration",createdAt:Date.now(),startedAt:null,completedAt:null,champion:null,organizerKey,teams:[],matches:[],rounds:[]};
 competitions.set(id,comp);res.status(201).json({competition:publicCompetition(comp),organizerKey});
});
app.post("/competitions/:id/register",(req,res)=>{
 const comp=competitions.get(String(req.params.id||""));if(!comp)return res.status(404).json({error:"Competition not found."});
 if(comp.status!=="registration")return res.status(409).json({error:"Registration is closed."});
 if(comp.teams.length>=comp.maxTeams)return res.status(409).json({error:"All team slots are taken."});
 const name=String(req.body?.teamName||"").trim().replace(/\s+/g," "),captain=String(req.body?.captain||"").trim().replace(/\s+/g," ");
 if(name.length<2||name.length>32||captain.length<2||captain.length>24)return res.status(400).json({error:"Team names must be 2–32 characters and captains 2–24."});
 if(comp.teams.some(team=>team.name.toLowerCase()===name.toLowerCase()))return res.status(409).json({error:"That team name is already registered."});
 comp.teams.push({id:"team-"+randomBytes(5).toString("hex"),name,captain,registeredAt:Date.now()});
 res.status(201).json({competition:publicCompetition(comp)});
});
app.post("/competitions/:id/start",(req,res)=>{
 const comp=competitions.get(String(req.params.id||""));if(!comp)return res.status(404).json({error:"Competition not found."});
 if(!organizerAuthorized(comp,req.body?.organizerKey))return res.status(403).json({error:"Only the organizer can start this competition."});
 if(comp.status!=="registration")return res.status(409).json({error:"This competition has already started."});
 if(comp.teams.length!==comp.maxTeams)return res.status(409).json({error:"Register all "+comp.maxTeams+" teams before starting."});
 startCompetition(comp);res.json({competition:publicCompetition(comp)});
});
app.post("/competitions/:id/matches/:matchId/result",(req,res)=>{
 const comp=competitions.get(String(req.params.id||""));if(!comp)return res.status(404).json({error:"Competition not found."});
 if(!organizerAuthorized(comp,req.body?.organizerKey))return res.status(403).json({error:"Only the organizer can record results."});
 if(comp.status!=="in-progress")return res.status(409).json({error:"This competition is not accepting results."});
 const match=comp.matches.find(item=>item.id===String(req.params.matchId||""));if(!match)return res.status(404).json({error:"Match not found."});
 const current=comp.rounds.find(ids=>ids.some(id=>comp.matches.find(item=>item.id===id)?.status==="scheduled"))||[];
 if(!current.includes(match.id)||match.status!=="scheduled")return res.status(409).json({error:"That match is not in the current open round."});
 const homeScore=Number(req.body?.homeScore),awayScore=Number(req.body?.awayScore),roomCode=String(req.body?.roomCode||"").trim().toUpperCase();
 if(!Number.isInteger(homeScore)||!Number.isInteger(awayScore)||homeScore<0||awayScore<0||homeScore>99||awayScore>99)return res.status(400).json({error:"Enter whole-number scores from 0 to 99."});
 if(comp.format==="tournament"&&homeScore===awayScore)return res.status(400).json({error:"Knockout games need a winner. Enter the score after overtime or a shootout."});
 match.homeScore=homeScore;match.awayScore=awayScore;match.roomCode=roomCode.slice(0,12);match.completedAt=Date.now();match.status="complete";
 match.winnerId=homeScore===awayScore?null:homeScore>awayScore?match.homeId:match.awayId;
 progressCompetition(comp);res.json({competition:publicCompetition(comp)});
});

app.get("/rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(st.private||!["practice","matchmaking","waiting","countdown","playing","goal","finished"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,skin:p.skin,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready}));const humans=people.filter(p=>!p.bot&&!p.spectator),spectators=people.filter(p=>p.spectator&&!p.bot),capacity=playerCapacity(st),readyCount=humans.filter(p=>p.ready).length;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Public Lobby",mode:st.mode,gameType:st.gameType||"classic",map:st.map,status:st.status,playerCount:humans.length,spectatorCount:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,capacity,players:humans.map(p=>p.name),roster:people.map(p=>({name:p.name,team:p.team,bot:p.bot,spectator:p.spectator,ready:p.ready}))});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
app.get("/private-rooms",(_req,res)=>{const rooms=[];for(const room of activeRooms.values()){const st=room.state;if(!st.private||!["practice","matchmaking","waiting","countdown","playing","goal","finished"].includes(st.status))continue;const people=Array.from(st.players.values()).map(p=>({name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready}));const humans=people.filter(p=>!p.bot&&!p.spectator),spectators=people.filter(p=>p.spectator&&!p.bot),capacity=playerCapacity(st),readyCount=humans.filter(p=>p.ready).length;rooms.push({roomId:room.roomId,code:room.roomCode,lobbyName:st.lobbyName||"Private Lobby",mode:st.mode,gameType:st.gameType||"classic",map:st.map,status:st.status,playerCount:humans.length,spectatorCount:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,capacity,players:humans.map(p=>p.name),roster:people});}res.setHeader("Cache-Control","no-store");res.json({rooms});});
app.get("/room/:roomId/history",(req,res)=>{const room=activeRooms.get(String(req.params.roomId||""));if(!room)return res.status(404).json({error:"Room not found or expired."});res.setHeader("Cache-Control","no-store");res.json({matches:(room.matchHistory||[]).slice(0,10)});});
function findRoomByCode(code){const roomId=codes.get(code);return (roomId&&activeRooms.get(roomId))||Array.from(activeRooms.values()).find(candidate=>candidate.roomCode===code)||null;}
function roomSummary(room){const st=room.state,players=Array.from(st.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator).map(p=>({name:p.name,team:p.team,skin:p.skin,ready:p.ready}));return {roomId:room.roomId,code:room.roomCode,private:st.private,lobbyName:st.lobbyName||"Hockey Lobby",mode:st.mode,map:st.map,status:st.status,gameType:st.gameType,playerCount:players.length,spectatorCount:Array.from(st.players.values()).filter(p=>p.spectator&&!p.sessionId.startsWith("ai-")).length,capacity:playerCapacity(st),readyCount:players.filter(p=>p.ready).length,players,roster:Array.from(st.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready})),teamName1:st.teamName1,teamName2:st.teamName2,hostId:st.hostId};}
app.get("/room/:code",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found"});if(room.state.private)return res.status(401).json({error:"This private lobby requires its password."});res.json(roomSummary(room));});
app.post("/room/:code/join",(req,res)=>{const code=String(req.params.code||"").toUpperCase(),room=findRoomByCode(code);res.setHeader("Cache-Control","no-store");if(!room)return res.status(404).json({error:"Room code not found or lobby has closed."});if(!room.state.private)return res.status(400).json({error:"That code belongs to a public lobby."});if(!room.matchesPrivatePassword(req.body?.password))return res.status(401).json({error:"Incorrect private lobby password."});if(!["practice","matchmaking","waiting"].includes(room.state.status)&&!req.body?.spectator)return res.status(409).json({error:"That match has started. Choose Spectate to watch it."});const humans=Array.from(room.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")&&!p.spectator).length,spectators=Array.from(room.state.players.values()).filter(p=>p.spectator).length;if(req.body?.spectator?spectators>=8:humans>=playerCapacity(room.state))return res.status(409).json({error:req.body?.spectator?"That match has no spectator slots left.":"That lobby is full."});res.json(roomSummary(room));});
const cleanName=v=>String(v??"Player").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,18)||"Player";
const cleanRoomName=v=>String(v??"Hockey Lobby").replace(/[<>\u0000-\u001f]/g,"").trim().slice(0,32)||"Hockey Lobby";
const tournaments=new Map();
const tournamentSummary=t=>({id:t.id,name:t.name,kind:t.kind,status:t.status,createdAt:t.createdAt,maxEntrants:t.maxEntrants,entrantCount:t.entrants.length,entrants:t.entrants.map(({id,name,played,wins,draws,losses,points,goalsFor,goalsAgainst})=>({id,name,played,wins,draws,losses,points,goalsFor,goalsAgainst})),matches:t.matches.map(m=>({...m})),champion:t.champion||null});
function tournamentById(id){return tournaments.get(String(id||"").toUpperCase());}
function addTournamentMatch(t,round,slot,a,b){
 const match={id:randomBytes(4).toString("hex").toUpperCase(),round,slot,entrant1Id:a?.id||null,entrant2Id:b?.id||null,status:"scheduled",score1:null,score2:null,winnerId:null,bye:!a||!b};
 if(match.bye){match.status="complete";match.winnerId=(a||b)?.id||null;match.score1=a?0:null;match.score2=b?0:null;}
 t.matches.push(match);return match;
}
function advanceCup(t){
 while(t.kind==="cup"&&t.status==="live"){
  const round=Math.max(0,...t.matches.map(m=>m.round)),fixtures=t.matches.filter(m=>m.round===round);
  if(!fixtures.length||!fixtures.every(m=>m.status==="complete"))return;
  const winners=fixtures.map(m=>t.entrants.find(e=>e.id===m.winnerId)).filter(Boolean);
  if(winners.length<=1){t.champion=winners[0]?.id||null;t.status="complete";return;}
  const nextRound=round+1;
  for(let i=0;i<winners.length;i+=2)addTournamentMatch(t,nextRound,Math.floor(i/2)+1,winners[i],winners[i+1]||null);
 }
}
function startTournament(t){
 if(t.status!=="registration"||t.entrants.length<2)return false;
 t.status="live";
 if(t.kind==="cup"){
  for(let i=0;i<t.entrants.length;i+=2)addTournamentMatch(t,1,Math.floor(i/2)+1,t.entrants[i],t.entrants[i+1]||null);
  advanceCup(t);
 }else{
  const list=[...t.entrants];if(list.length%2)list.push(null);
  let rotating=[...list],slot=1;
  for(let round=1;round<list.length;round++){
   for(let i=0;i<list.length/2;i++){
    const a=rotating[i],b=rotating[list.length-1-i];
    if(a&&b)addTournamentMatch(t,round,slot++,a,b);
   }
   rotating=[rotating[0],rotating[rotating.length-1],...rotating.slice(1,-1)];
  }
 }
 return true;
}
function applyTournamentResult(t,m,score1,score2){
 const a=t.entrants.find(e=>e.id===m.entrant1Id),b=t.entrants.find(e=>e.id===m.entrant2Id);
 m.score1=score1;m.score2=score2;m.status="complete";m.completedAt=Date.now();
 if(!a||!b)return;
 a.played++;b.played++;a.goalsFor+=score1;a.goalsAgainst+=score2;b.goalsFor+=score2;b.goalsAgainst+=score1;
 if(score1>score2){m.winnerId=a.id;a.wins++;a.points+=t.kind==="league"?3:0;b.losses++;}
 else if(score2>score1){m.winnerId=b.id;b.wins++;b.points+=t.kind==="league"?3:0;a.losses++;}
 else{m.winnerId=null;if(t.kind==="league"){a.draws++;b.draws++;a.points++;b.points++;} }
 if(t.kind==="cup")advanceCup(t);
 if(t.kind==="league"&&t.matches.every(f=>f.status==="complete"))t.status="complete";
}
app.get("/tournaments",(_req,res)=>{res.setHeader("Cache-Control","no-store");res.json({tournaments:[...tournaments.values()].filter(t=>t.status!=="complete"||Date.now()-t.completedAt<86400000).map(tournamentSummary)});});
app.post("/tournaments",(req,res)=>{
 const name=cleanRoomName(req.body?.name),kind=req.body?.kind==="league"?"league":"cup",hostName=cleanName(req.body?.teamName||"Host"),maxEntrants=Math.max(2,Math.min(32,Math.trunc(Number(req.body?.maxEntrants)||16)));
 if(tournaments.size>=100)return res.status(429).json({error:"Tournament capacity reached. Try again later."});
 const t={id:randomBytes(4).toString("hex").toUpperCase(),name,kind,status:"registration",hostKey:randomBytes(24).toString("hex"),createdAt:Date.now(),maxEntrants,entrants:[],matches:[],champion:null,completedAt:null};
 t.entrants.push({id:randomBytes(4).toString("hex").toUpperCase(),name:hostName,played:0,wins:0,draws:0,losses:0,points:0,goalsFor:0,goalsAgainst:0});
 tournaments.set(t.id,t);res.status(201).json({tournament:tournamentSummary(t),hostKey:t.hostKey});
});
app.get("/tournaments/:id",(req,res)=>{const t=tournamentById(req.params.id);if(!t)return res.status(404).json({error:"Tournament not found."});res.setHeader("Cache-Control","no-store");res.json({tournament:tournamentSummary(t)});});
app.post("/tournaments/:id/join",(req,res)=>{
 const t=tournamentById(req.params.id);if(!t)return res.status(404).json({error:"Tournament not found."});
 if(t.status!=="registration")return res.status(409).json({error:"Registration has closed."});
 const name=cleanName(req.body?.teamName||"Player");
 const existing=t.entrants.find(e=>e.name.toLowerCase()===name.toLowerCase());
 if(existing)return res.json({tournament:tournamentSummary(t),entrantId:existing.id,alreadyJoined:true});
 if(t.entrants.length>=t.maxEntrants)return res.status(409).json({error:"This tournament is full."});
 const entrant={id:randomBytes(4).toString("hex").toUpperCase(),name,played:0,wins:0,draws:0,losses:0,points:0,goalsFor:0,goalsAgainst:0};t.entrants.push(entrant);
 res.status(201).json({tournament:tournamentSummary(t),entrantId:entrant.id});
});
app.post("/tournaments/:id/start",(req,res)=>{
 const t=tournamentById(req.params.id);if(!t)return res.status(404).json({error:"Tournament not found."});
 if(String(req.body?.hostKey||"")!==t.hostKey)return res.status(403).json({error:"Only the tournament host can start it."});
 if(t.status!=="registration")return res.status(409).json({error:"This tournament has already started."});
 if(t.entrants.length<2)return res.status(400).json({error:"At least two entrants are needed."});
 startTournament(t);res.json({tournament:tournamentSummary(t)});
});
app.post("/tournaments/:id/result",(req,res)=>{
 const t=tournamentById(req.params.id);if(!t)return res.status(404).json({error:"Tournament not found."});
 if(String(req.body?.hostKey||"")!==t.hostKey)return res.status(403).json({error:"Only the tournament host can submit results."});
 if(t.status!=="live")return res.status(409).json({error:"This tournament is not live."});
 const m=t.matches.find(item=>item.id===String(req.body?.matchId||"").toUpperCase());
 if(!m||m.status!=="scheduled"||m.bye)return res.status(404).json({error:"Open match fixture not found."});
 const score1=Number(req.body?.score1),score2=Number(req.body?.score2);
 if(!Number.isInteger(score1)||!Number.isInteger(score2)||score1<0||score2<0||score1>99||score2>99)return res.status(400).json({error:"Scores must be whole numbers from 0 to 99."});
 if(t.kind==="cup"&&score1===score2)return res.status(400).json({error:"Cup matches cannot be tied. Record the overtime or shootout winner."});
 applyTournamentResult(t,m,score1,score2);if(t.status==="complete")t.completedAt=Date.now();
 res.json({tournament:tournamentSummary(t)});
});
function makeCode(){let code;do{code=randomBytes(3).toString("hex").toUpperCase()}while(codes.has(code));return code}
function addAI(room,team,index){
 const p=new Player();p.sessionId="ai-"+team+"-"+index;p.name="CPU "+index;p.team=team;p.x=team===1?130:770;p.y=180+index*65;p.skin=(team===1?index+3:index+5)%14;p.trail=(index+team)%8;room.state.players.set(p.sessionId,p);
}
class HockeyRoom extends (await import("@colyseus/core")).Room {
 onCreate(options){
  this.maxClients=12;this.autoDispose=true;this.setState(new MatchState());
  const mode=CAPACITY[options.mode]?options.mode:"1v1";
  this.state.mode=mode;this.state.gameType=["classic","shootout","goalie","time-attack"].includes(options?.gameType)?options.gameType:"classic";this.state.private=!!options.private;this.state.lobbyName=cleanRoomName(options?.lobbyName||(cleanName(options?.name)+"’s Lobby"));this.state.map=String(options.map||"Classic").slice(0,24);this.state.teamName1="Team 1";this.state.teamName2="Team 2";this.state.matchTime=Number.isFinite(Number(options?.matchTime))?Math.max(60,Math.min(600,Number(options.matchTime))):180;this.state.matchLength=this.state.matchTime;this.state.difficulty=["easy","medium","hard","extrahard"].includes(options?.difficulty)?options.difficulty:"medium";this.state.training=["none","warmup","conditioning","speed"].includes(options?.training)?options.training:"none";this.state.competition=!!options?.competition;const clampStat=(v,lo=.65,hi=1.7)=>Math.max(lo,Math.min(hi,Number.isFinite(Number(v))?Number(v):1));this.state.playerSpeed=clampStat(options?.playerSpeed, .65,1.6);this.state.playerPower=clampStat(options?.playerPower,.65,1.7);this.state.playerControl=clampStat(options?.playerControl,.65,1.6);this.state.aiSpeed=clampStat(options?.aiSpeed,.65,1.6);this.state.aiPower=clampStat(options?.aiPower,.65,1.7);this.state.aiAccuracy=clampStat(options?.aiAccuracy,.65,1.6);this.state.countdown=0;this.waitSeconds=30;this.startSeconds=0;this.goalPause=0;this.finishTimer=null;this.lastPuckTouchAt=0;this.lastBoardSoundAt=0;this.matchStartedAt=0;this.lastShootAt=new Map();this.aiShotAt=new Map();this.puckContacts=new Set();
  this.privatePasswordSalt=null;this.privatePasswordHash=null;
  if(this.state.private){const password=String(options?.privatePassword||"").trim();if(password.length<4||password.length>64)throw new Error("Private lobby passwords must be between 4 and 64 characters.");this.privatePasswordSalt=randomBytes(16);this.privatePasswordHash=scryptSync(password,this.privatePasswordSalt,32);}
  this.state.hostId="";this.matchmakingStarted=false;this.matchHistory=[];this.goalReplayFrames=[];this.lastGoalReplayAt=0;this.roomCode=options.code||makeCode();this.state.code=this.roomCode;codes.set(this.roomCode,this.roomId);activeRooms.set(this.roomId,this);this.setMetadata({mode:this.state.mode,map:this.state.map,private:this.state.private,code:this.roomCode,lobbyName:this.state.lobbyName,gameType:this.state.gameType,difficulty:this.state.difficulty,training:this.state.training,competition:this.state.competition});
  if(mode==="2v2-ai"){addAI(this,1,1);addAI(this,2,1);addAI(this,2,2);}

  this.onMessage("move",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||this.state.status==="finished")return;
   if(this.state.gameType==="shootout"&&p.team!==this.state.shootoutTeam){p.inputX=0;p.inputY=0;return;}
   if(p.role==="goalie"){p.inputX=0;p.inputY=Math.max(-1,Math.min(1,Number(msg?.y)||0));return;}
   p.inputX=Math.max(-1,Math.min(1,Number(msg?.x)||0));p.inputY=Math.max(-1,Math.min(1,Number(msg?.y)||0));
  });
  this.onMessage("customize",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p)return;p.name=cleanName(msg?.name);p.skin=Math.max(0,Math.min(13,Number(msg?.skin)||0));p.trail=0;this.updateTeamNames();this.broadcastLobby();});
  this.onMessage("ready",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","waiting"].includes(this.state.status))return;p.ready=msg?.ready===undefined?!p.ready:!!msg.ready;this.broadcastLobby();this.broadcast("lobbyNotice",{message:p.name+(p.ready?" is ready.":" is changing settings.")});});
  this.onMessage("play",(client)=>this.startMatch(client));
  this.onMessage("startMatch",(client)=>this.startMatch(client));
  this.onMessage("setTeam",(client,msg)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","waiting"].includes(this.state.status))return;if(this.state.gameType==="goalie"){client.send("lobbyNotice",{message:"Goalie Challenge locks you in the goalie position."});return;}const team=Number(msg?.team);if(team!==1&&team!==2)return;if(this.state.mode==="2v2-ai"&&team!==1){client.send("lobbyNotice",{message:"In 2v2 AI mode you play for Team 1."});return;}const maxPerTeam=Math.ceil((CAPACITY[this.state.mode]||2)/2),used=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")&&!q.spectator&&q.team===team&&q.sessionId!==client.sessionId).length;if(used>=maxPerTeam){client.send("lobbyNotice",{message:"That team is full. Choose the other side."});return;}p.team=team;p.ready=false;p.x=team===1?130:770;p.y=300;p.vx=0;p.vy=0;this.updateTeamNames();this.broadcastLobby();});
  this.onMessage("hostSettings",(client,msg)=>this.applyHostSettings(client,msg));
  this.onMessage("kick",(client,msg)=>{if(client.sessionId!==this.state.hostId)return;const targetId=String(msg?.sessionId||"");if(!targetId||targetId===this.state.hostId||targetId.startsWith("ai-"))return;const target=this.clients.find(c=>c.sessionId===targetId);if(target){target.leave(4004,"Removed from lobby by host");this.broadcast("lobbyNotice",{message:"A player was removed by the host."});}});
  this.onMessage("spectate",(client)=>{const p=this.state.players.get(client.sessionId);if(!p||p.spectator)return;p.spectator=true;p.team=0;p.ready=false;p.inputX=0;p.inputY=0;p.vx=0;p.vy=0;if(this.state.hostId===p.sessionId){const next=Array.from(this.state.players.values()).find(q=>!q.spectator&&!q.sessionId.startsWith("ai-"));this.state.hostId=next?.sessionId||"";}this.broadcast("lobbyNotice",{message:p.name+" is now spectating."});this.broadcastLobby();});
  this.onMessage("playAsPlayer",(client)=>{const p=this.state.players.get(client.sessionId);if(!p||!p.spectator||!["practice","waiting"].includes(this.state.status))return;const humans=Array.from(this.state.players.values()).filter(q=>!q.sessionId.startsWith("ai-")&&!q.spectator).length;if(humans>=(CAPACITY[this.state.mode]||2)){client.send("lobbyNotice",{message:"The player slots are full."});return;}p.spectator=false;p.team=this.assignTeam();p.x=p.team===1?130:770;p.y=300;p.ready=false;if(!this.state.hostId)this.state.hostId=p.sessionId;this.broadcastLobby();});
  this.onMessage("shoot",(client,msg)=>{
   const p=this.state.players.get(client.sessionId);if(!p||p.spectator||!["practice","matchmaking","playing"].includes(this.state.status))return;
   const puck=this.state.puck,dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy),contactRadius=30;
   // Power hits are explicit and only register at true close contact. In shootouts only the active team may shoot.
   if(p.role==="goalie"||d>contactRadius||(this.state.gameType==="shootout"&&p.team!==this.state.shootoutTeam))return;
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
  if(this.matchHistory?.length)client.send("matchHistory",{matches:this.matchHistory});
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
 broadcastLobby(){if(!this.state)return;const humans=Array.from(this.state.players.values()).filter(p=>!p.spectator&&!p.sessionId.startsWith("ai-")),spectators=Array.from(this.state.players.values()).filter(p=>p.spectator&&!p.sessionId.startsWith("ai-")),readyCount=humans.filter(p=>p.ready).length;this.broadcast("lobby",{code:this.roomCode,roomId:this.roomId,mode:this.state.mode,gameType:this.state.gameType,map:this.state.map,private:this.state.private,lobbyName:this.state.lobbyName,players:humans.length,capacity:playerCapacity(this.state),spectators:spectators.length,readyCount,allReady:humans.length>0&&readyCount===humans.length,hostId:this.state.hostId,status:this.state.status,roster:Array.from(this.state.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,bot:p.sessionId.startsWith("ai-"),spectator:!!p.spectator,ready:!!p.ready,goals:p.goals,assists:p.assists,shots:p.shots,hits:p.hits,saves:p.saves}))});}
 applyHostSettings(client,msg){
  if(!this.state||client.sessionId!==this.state.hostId||!["practice","waiting"].includes(this.state.status))return;
  const humans=Array.from(this.state.players.values()).filter(p=>!p.spectator&&!p.sessionId.startsWith("ai-")),nextMode=CAPACITY[msg?.mode]?msg.mode:this.state.mode,nextGameType=["classic","shootout","goalie","time-attack"].includes(msg?.gameType)?msg.gameType:"classic";
  const nextCapacity=nextGameType==="goalie"?1:(CAPACITY[nextMode]||2);
  if(humans.length>nextCapacity){client.send("lobbyNotice",{message:"That game type has fewer player slots than the current lobby roster."});return;}
  this.state.mode=nextMode;this.state.gameType=nextGameType;
  for(const p of humans){p.role=this.state.gameType==="goalie"?"goalie":"skater";if(p.role==="goalie"){p.team=2;p.x=850;p.y=300;p.vx=0;p.vy=0;}else if(p.team===0){p.team=this.assignTeam();}else{p.vx=0;p.vy=0;}}
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
  this.cancelMatchmaking();this.resetMatchStats();this.state.puck.score1=0;this.state.puck.score2=0;this.state.overtime=false;this.state.overtimePeriod=0;this.goalReplayFrames=[];this.lastGoalReplayAt=0;this.matchStartedAt=Date.now();
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
 captureGoalReplayFrame(){const now=Date.now();if(now-this.lastGoalReplayAt<100)return;this.lastGoalReplayAt=now;const state=this.state;this.goalReplayFrames.push({t:now,puck:{x:state.puck.x,y:state.puck.y,vx:state.puck.vx,vy:state.puck.vy,score1:state.puck.score1,score2:state.puck.score2},players:Array.from(state.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,x:p.x,y:p.y,vx:p.vx,vy:p.vy,skin:p.skin,spectator:p.spectator,role:p.role||"skater",bot:p.sessionId.startsWith("ai-"),goals:p.goals,assists:p.assists,shots:p.shots,shotsOnGoal:p.shotsOnGoal,hits:p.hits,saves:p.saves}))});if(this.goalReplayFrames.length>70)this.goalReplayFrames.splice(0,this.goalReplayFrames.length-70);}
 recordShotOnGoal(team){const shooter=this.state.players.get(this.state.puck.lastTouchId);if(shooter&&!shooter.spectator&&shooter.team===team)shooter.shotsOnGoal++;}
 recordGoal(team){const puck=this.state.puck,scorer=this.state.players.get(puck.lastTouchId),assister=this.state.players.get(puck.previousTouchId);if(scorer&&!scorer.spectator&&scorer.team===team){scorer.goals++;scorer.shotsOnGoal++;}if(assister&&assister!==scorer&&!assister.spectator&&assister.team===team)assister.assists++;this.broadcast("matchStats",this.matchStatsSnapshot());}
 matchStatsSnapshot(){const players=Array.from(this.state.players.values()).map(p=>({id:p.sessionId,name:p.name,team:p.team,role:p.role,bot:p.sessionId.startsWith("ai-"),spectator:p.spectator,goals:p.goals,assists:p.assists,shots:p.shots,shotsOnGoal:p.shotsOnGoal,hits:p.hits,saves:p.saves,shootingPct:p.shots?Math.round(p.goals/p.shots*100):0}));const team=(n)=>({goals:n===1?this.state.puck.score1:this.state.puck.score2,shots:players.filter(p=>p.team===n&&!p.spectator).reduce((t,p)=>t+p.shots,0),shotsOnGoal:players.filter(p=>p.team===n&&!p.spectator).reduce((t,p)=>t+p.shotsOnGoal,0),saves:players.filter(p=>p.team===n&&!p.spectator).reduce((t,p)=>t+p.saves,0)});return {score1:this.state.puck.score1,score2:this.state.puck.score2,gameType:this.state.gameType,mode:this.state.mode,map:this.state.map,teamName1:this.state.teamName1,teamName2:this.state.teamName2,team1:team(1),team2:team(2),players};}
 resetMatchStats(){for(const p of this.state.players.values()){p.goals=0;p.assists=0;p.shots=0;p.shotsOnGoal=0;p.hits=0;p.saves=0;}this.state.puck.lastTouchId="";this.state.puck.previousTouchId="";this.state.puck.lastTouchAt=0;}
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
  const result={score1:state.puck.score1,score2:state.puck.score2,overtime:!!state.overtime};
  const goalie=state.gameType==="goalie"?Array.from(state.players.values()).find(p=>p.role==="goalie"&&!p.spectator):null;
  const winner=goalie?(goalie.saves>result.score1?2:goalie.saves<result.score1?1:0):result.score1===result.score2?0:result.score1>result.score2?1:2;
  const finishedAt=Date.now(),matchRecord={...this.matchStatsSnapshot(),gameType:state.gameType,mode:state.mode,map:state.map,overtime:!!state.overtime,matchLength:state.matchLength,elapsedSeconds:Math.max(0,Math.round((finishedAt-(this.matchStartedAt||finishedAt))/1000)),finishedAt,winner,goalieSaves:goalie?.saves||0,goalsAllowed:goalie?result.score1:0};this.matchHistory.unshift(matchRecord);this.matchHistory=this.matchHistory.slice(0,10);
  this.broadcast("finished",{...result,gameType:state.gameType,winner,overtime:!!state.overtime,goalieSaves:goalie?.saves||0,goalsAllowed:goalie?result.score1:0,stats:matchRecord,history:this.matchHistory});
  clearTimeout(this.finishTimer);
  this.finishTimer=setTimeout(()=>{
   this.finishTimer=null;
   if(!this.state||this.state.status!=="finished")return;
   for(const [id,p] of Array.from(this.state.players.entries())){
    if(id.startsWith("ai-")&&this.state.mode!=="2v2-ai"){this.state.players.delete(id);continue;}
    p.ready=false;p.vx=0;p.vy=0;p.inputX=0;p.inputY=0;
   }
   this.state.puck.score1=0;this.state.puck.score2=0;this.state.matchTime=this.state.matchLength;this.state.countdown=0;this.state.overtime=false;this.state.overtimePeriod=0;
   this.resetPuck();this.resetPlayers();this.state.status="practice";
   this.broadcast("lobbyReady",{message:"Match finished — back in the lobby. Press PLAY for a rematch."});
   this.broadcast("lobby",{code:this.roomCode,mode:this.state.mode,gameType:this.state.gameType,private:this.state.private,players:Array.from(this.state.players.values()).filter(p=>!p.sessionId.startsWith("ai-")).length,capacity:playerCapacity(this.state)});
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
  if(state.matchTime<=0){
   if(["classic","time-attack"].includes(state.gameType)&&state.puck.score1===state.puck.score2){
    const enteringOvertime=!state.overtime;
    state.overtime=true;state.overtimePeriod=enteringOvertime?1:(state.overtimePeriod||1)+1;state.matchTime=60;state.countdown=0;
    const message=enteringOvertime?"Tied at full time — 60 seconds of sudden-death overtime. Next goal wins.":"Still tied — another sudden-death minute. Next goal wins.";
    this.broadcast(enteringOvertime?"overtimeStarted":"overtimeContinues",{seconds:60,period:state.overtimePeriod,score1:state.puck.score1,score2:state.puck.score2,message});
    return;
   }
   this.finishMatch();return;
  }
  this.simulateRink(dt,false);
 }
 simulateRink(dt,practice=false){
  const state=this.state,puck=state.puck;
  const rinkW=900,rinkH=600,playerR=19,puckR=11,diffScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,trainingScale=state.training==="warmup"?.82:state.training==="speed"?1.18:state.training==="conditioning"?1.05:1;
  const ps=Array.from(state.players.values()).filter(p=>!p.spectator);
  // Save player start positions so collision checks use relative puck/player motion, not only end positions.
  const playerStartPositions=new Map(ps.map(p=>[p.sessionId,{x:p.x,y:p.y}]));
  if(!practice&&state.status==="playing")this.captureGoalReplayFrame();
  for(const p of ps){
   if(p.sessionId.startsWith("ai-")){
    if(state.gameType==="shootout"&&p.team!==state.shootoutTeam){p.inputX=0;p.inputY=0;continue;}
    const teamDir=p.team===1?1:-1,index=Number(p.sessionId.split("-")[2])||1;
    const tx=Math.max(50,Math.min(850,puck.x-teamDir*(index===1?24:75))),ty=Math.max(55,Math.min(545,puck.y+(index===1?-22:35)));
    let dx=tx-p.x,dy=ty-p.y,d=Math.hypot(dx,dy)||1;p.inputX=dx/d*.86;p.inputY=dy/d*.86;
    const puckDistance=Math.hypot(puck.x-p.x,puck.y-p.y),now=Date.now(),lastShot=this.aiShotAt.get(p.sessionId)||0;
    if(puckDistance<playerR+puckR&&now-lastShot>420&&Math.random()<.16){
     this.aiShotAt.set(p.sessionId,now);const gx=teamDir===1?880:20,deviation=90/Math.max(.55,state.aiAccuracy*diffScale),gy=300+(Math.random()-.5)*deviation,dx=gx-p.x,dy=gy-p.y,gd=Math.hypot(dx,dy)||1,nx=dx/gd,ny=dy/gd,power=state.aiPower*diffScale;
     puck.x=p.x+nx*35;puck.y=p.y+ny*35;puck.vx=nx*720*power+p.vx;puck.vy=ny*720*power+p.vy;this.puckContacts.add(p.sessionId);p.shots++;
     this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:720*power,player:p.name,shot:true});
    }
   }
   const len=Math.hypot(p.inputX,p.inputY)||1,scale=len>1?1/len:1,ax=p.inputX*scale,ay=p.inputY*scale,isAI=p.sessionId.startsWith("ai-"),speed=isAI?state.aiSpeed*diffScale:state.playerSpeed*trainingScale,control=isAI?1:state.playerControl;
   if(p.role==="goalie"&&!isAI){
    // Keep the dedicated Goalie Challenge movement unchanged.
    p.x=p.team===1?50:850;p.vx=0;p.vy+=ay*720*speed*control*dt;p.vy*=Math.pow(.13/control,dt);
    const goalieMax=250,goalieSpeed=Math.abs(p.vy);if(goalieSpeed>goalieMax)p.vy=Math.sign(p.vy)*goalieMax;
    p.y=Math.max(60,Math.min(540,p.y+p.vy*dt));continue;
   }
   if(isAI){
    // AI steering has its own difficulty-tuned movement.
    const friction=Math.pow(.13,dt);
    p.vx+=ax*720*speed*dt;p.vy+=ay*720*speed*dt;p.vx*=friction;p.vy*=friction;
    const vmax=365*speed,sp=Math.hypot(p.vx,p.vy);if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
    p.x=Math.max(40,Math.min(860,p.x+p.vx*dt));p.y=Math.max(50,Math.min(550,p.y+p.vy*dt));
   }else{
    // Match the original single-player moveP physics: 620 acceleration, control-scaled
    // .12 friction, a 390 * speed cap, and the original rink movement bounds.
    const playerSpeed=state.playerSpeed*trainingScale;
    const friction=Math.pow(.09/control,dt);
    p.vx+=ax*620*playerSpeed*control*dt;p.vy+=ay*620*playerSpeed*control*dt;
    p.vx*=friction;p.vy*=friction;
    const vmax=390*playerSpeed,sp=Math.hypot(p.vx,p.vy);if(sp>vmax){p.vx=p.vx/sp*vmax;p.vy=p.vy/sp*vmax;}
    p.x=Math.max(28,Math.min(872,p.x+p.vx*dt));p.y=Math.max(50,Math.min(550,p.y+p.vy*dt));
   }
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
   const pStart=playerStartPositions.get(p.sessionId)||{x:p.x,y:p.y},playerTravelX=p.x-pStart.x,playerTravelY=p.y-pStart.y;
   // Relative-motion sweep: the puck and skater may both cross the contact zone between 30 Hz server ticks.
   const relStartX=puckStartX-pStart.x,relStartY=puckStartY-pStart.y,relTravelX=travelX-playerTravelX,relTravelY=travelY-playerTravelY;
   const a=relTravelX*relTravelX+relTravelY*relTravelY,b=2*(relStartX*relTravelX+relStartY*relTravelY),c=relStartX*relStartX+relStartY*relStartY-contactRadius*contactRadius;
   const endDx=puck.x-p.x,endDy=puck.y-p.y,endD=Math.hypot(endDx,endDy);
   let impactT=null;
   if(c<=0){
    if(relStartX*relTravelX+relStartY*relTravelY<0)impactT=0;
   }else if(a>1e-6){
    const discriminant=b*b-4*a*c;
    if(discriminant>=0){const entry=(-b-Math.sqrt(discriminant))/(2*a);if(entry>=0&&entry<=1)impactT=entry;}
   }
   const endOverlaps=endD<contactRadius;
   if(impactT===null&&!endOverlaps)continue;
   if(endD<contactRadius+3)activePuckContacts.add(p.sessionId);
   if(p.spectator)continue;
   // For end-overlap use the current normal; for a fast crossing use the first point of impact.
   const t=endOverlaps?1:impactT;
   const impactPlayerX=pStart.x+playerTravelX*t,impactPlayerY=pStart.y+playerTravelY*t,impactPuckX=puckStartX+travelX*t,impactPuckY=puckStartY+travelY*t;
   let dx=impactPuckX-impactPlayerX,dy=impactPuckY-impactPlayerY,d=Math.hypot(dx,dy);
   if(d<.001){const puckSpeed=Math.hypot(puck.vx,puck.vy);if(puckSpeed>.001){dx=-puck.vx/puckSpeed;dy=-puck.vy/puckSpeed;}else{dx=p.inputX|| (p.team===1?1:-1);dy=p.inputY||0;}d=Math.hypot(dx,dy)||1;}
   let nx=dx/d,ny=dy/d;
   // Goalie Challenge: resolve fast shots at the true swept impact point so pucks cannot tunnel through the crease.
   if(p.role==="goalie"){
    const incoming=p.team===2?puck.vx>35:puck.vx< -35,puckSpeed=Math.hypot(puck.vx,puck.vy);
    if(incoming&&puckSpeed>70&&(impactT!==null||endOverlaps)){
     const gx=endOverlaps?p.x:impactPlayerX,gy=endOverlaps?p.y:impactPlayerY;
     puck.x=gx+nx*(contactRadius+1);puck.y=gy+ny*(contactRadius+1);puck.vx=(p.team===2?-1:1)*Math.max(180,Math.min(560,puckSpeed*.78));puck.vy=puck.vy*.35+p.vy*.5;
     p.saves++;p.hits++;this.recordShotOnGoal(p.team===2?1:2);this.puckContacts.add(p.sessionId);puck.previousTouchId=puck.lastTouchId;puck.lastTouchId=p.sessionId;puck.lastTouchAt=Date.now();
     this.broadcast("goalieSave",{player:p.name,saves:p.saves,speed:puckSpeed});this.broadcast("puckTouch",{speed:puckSpeed,player:p.name,save:true});this.broadcast("matchStats",this.matchStatsSnapshot());continue;
    }
   }
   const latched=this.puckContacts.has(p.sessionId);
   const playerDrive=p.vx*nx+p.vy*ny,puckNormalSpeed=puck.vx*nx+puck.vy*ny;
   // Always resolve a real collision; the latch prevents a second boosted hit during the same touch only.
   if(playerDrive>24&&!latched){
    const isAI=p.sessionId.startsWith("ai-"),difficultyScale=state.difficulty==="easy"?.72:state.difficulty==="hard"?1.16:state.difficulty==="extrahard"?1.32:1,power=isAI?state.aiPower*difficultyScale:1,force=360*power+Math.min(130,playerDrive*.2);
    puck.x=p.x+nx*(contactRadius+1);puck.y=p.y+ny*(contactRadius+1);puck.vx=nx*force+p.vx*.35;puck.vy=ny*force+p.vy*.35;this.puckContacts.add(p.sessionId);p.hits++;p.shots++;puck.previousTouchId=puck.lastTouchId;puck.lastTouchId=p.sessionId;puck.lastTouchAt=Date.now();
    const now=Date.now();if(now-this.lastPuckTouchAt>80){this.lastPuckTouchAt=now;this.broadcast("puckTouch",{speed:force,player:p.name,shot:false});}
   }else if(puckNormalSpeed< -35){
    // Reflect an incoming puck even if the contact latch is active.
    puck.vx-=1.78*puckNormalSpeed*nx;puck.vy-=1.78*puckNormalSpeed*ny;
    puck.x=p.x+nx*(contactRadius+1);puck.y=p.y+ny*(contactRadius+1);
   }else{
    // A glancing / latched contact separates cleanly without injecting extra energy.
    puck.x=p.x+nx*(contactRadius+1);puck.y=p.y+ny*(contactRadius+1);
   }
  }

  // Final non-penetration solver: after all player contacts, guarantee the puck is outside every
  // active skater/goalie. This prevents a second nearby player from pushing it back inside a player
  // that was already resolved earlier in the collision loop.
  for(let pass=0;pass<6;pass++){
   let changed=false;
   for(const p of ps){
    if(state.gameType==="shootout"&&p.team!==state.shootoutTeam)continue;
    const dx=puck.x-p.x,dy=puck.y-p.y,d=Math.hypot(dx,dy);
    if(d>=contactRadius-.01)continue;
    let nx=0,ny=0;
    if(d>.001){nx=dx/d;ny=dy/d;}
    else{
     const playerSpeed=Math.hypot(p.vx,p.vy),puckSpeed=Math.hypot(puck.vx,puck.vy);
     if(playerSpeed>puckSpeed&&playerSpeed>.001){nx=p.vx/playerSpeed;ny=p.vy/playerSpeed;}
     else if(puckSpeed>.001){nx=-puck.vx/puckSpeed;ny=-puck.vy/puckSpeed;}
     else{nx=p.team===1?1:-1;ny=0;}
    }
    const target=contactRadius+.75;
    puck.x=p.x+nx*target;puck.y=p.y+ny*target;changed=true;
   }
   if(!changed)break;
  }
  const puckSpeed=Math.hypot(puck.vx,puck.vy);if(puckSpeed>900){puck.vx=puck.vx/puckSpeed*900;puck.vy=puck.vy/puckSpeed*900;}
  const crossedLeft=puck.x<2&&puck.y>goalTop&&puck.y<goalBottom,crossedRight=puck.x>rinkW-2&&puck.y>goalTop&&puck.y<goalBottom;
  if(practice&&(crossedLeft||crossedRight)){this.resetPuck();this.broadcast("practiceGoal",{message:"Practice shot! Puck reset to centre."});}
  else if(!practice&&state.gameType==="shootout"&&(crossedLeft||crossedRight)){this.broadcast("goalReplay",{team:crossedLeft?2:1,frames:this.goalReplayFrames.slice(-60),score1:puck.score1,score2:puck.score2});this.goalReplayFrames=[];this.lastGoalReplayAt=0;this.completeShootoutAttempt(crossedLeft?2:1);}
  else if(!practice&&state.gameType==="goalie"&&crossedLeft){this.resetPuck();this.broadcast("goalieClear",{message:"The puck cleared the goalie zone. Keep defending!"});}
  else if(!practice&&crossedLeft){puck.score2++;this.recordGoal(2);this.broadcast("goalReplay",{team:2,frames:this.goalReplayFrames.slice(-60),score1:puck.score1,score2:puck.score2});this.goalReplayFrames=[];this.lastGoalReplayAt=0;this.broadcast("goal",{team:2,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.overtime|| (state.competition&&puck.score2>=5)){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
  else if(!practice&&crossedRight){puck.score1++;this.recordGoal(1);this.broadcast("goalReplay",{team:1,frames:this.goalReplayFrames.slice(-60),score1:puck.score1,score2:puck.score2});this.goalReplayFrames=[];this.lastGoalReplayAt=0;this.broadcast("goal",{team:1,score1:puck.score1,score2:puck.score2});this.resetPuck();this.resetPlayers();if(state.overtime|| (state.competition&&puck.score1>=5)){this.finishMatch();}else{state.status="goal";state.countdown=2;this.goalPause=2;}}
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
 startFaceoff(){if(!["goal","playing","countdown"].includes(this.state.status))this.matchStartedAt=Date.now();this.cancelMatchmaking();this.resetPuck();this.resetPlayers();if(this.state.gameType==="shootout"){this.state.puck.x=this.state.shootoutTeam===1?270:630;this.state.puck.y=300;}this.startSeconds=3;this.state.status="countdown";this.state.countdown=3;this.broadcast("faceoff",{seconds:3,team1:this.state.teamName1,team2:this.state.teamName2,gameType:this.state.gameType,shootoutTeam:this.state.shootoutTeam,attempts1:this.state.shootoutAttempts1,attempts2:this.state.shootoutAttempts2});}
 resetPuck(){this.state.puck.x=450;this.state.puck.y=300;this.state.puck.vx=0;this.state.puck.vy=0;this.state.puck.lastTouchId="";this.state.puck.previousTouchId="";this.state.puck.lastTouchAt=0;this.puckContacts.clear();}

 onDispose(){clearTimeout(this.aiFillTimer);clearInterval(this.aiCountdown);clearTimeout(this.finishTimer);if(codes.get(this.roomCode)===this.roomId)codes.delete(this.roomCode);activeRooms.delete(this.roomId);}
}
gameServer.define("hockey",HockeyRoom);
gameServer.define("hockey_public",HockeyRoom).filterBy(["mode","gameType","map","difficulty","training","competition"]);
const port=Number(process.env.PORT||2567);
await gameServer.listen(port,"0.0.0.0");
console.log("Hockey multiplayer listening on",port);
