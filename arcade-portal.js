
(() => {
 "use strict";
 const API_BASE="https://hockey-multiplayer.onrender.com";
 const TOKEN_KEY="hockeyAccountToken";
 const app=document.getElementById("arcadeRoot");
 if(!app)return;
 let account=null,accountStats=null,accountToken="",authMode="login",pendingLaunch=null;
 let selectedGenre="All Games",selectedGame=null,catalogStats={},portalSession=null,heartbeatTimer=null,externalWindow=null,externalPoll=null;
 let devPasswordDraft="";
 const gameIdByTitle={
  "Drift Arena":"drift-arena","Open World Drive":"open-world-drive","Tank Arena":"tank-arena-3d",
  "APEX Formula Racing":"apex-formula-racing","Gravel Rally Stage":"gravel-rally-stage",
  "FPV Drone Simulator":"fpv-drone-simulator","Industrial Site Ops":"industrial-site-ops",
  "Pool · 8 Ball":"pool-8-ball","Tennis Rally":"tennis-rally","Hockey":"hockey",
  "Reaction Game":"reaction-game","Click Test":"click-test","Neon Breaker":"neon-breaker",
  "Flappy Bird":"flappy-bird","Neon Snake":"neon-snake","Space Defender":"space-defender",
  "Neon Runner":"neon-runner","Memory Match":"memory-match","Moto X3M":"moto-x3m",
  "Learn to Fly":"learn-to-fly","Garden Gnomes":"garden-gnomes"
 };
 const photos={
  "drift-arena":"assets/drift-track-1.webp",
  "open-world-drive":"assets/drift-track-2.webp",
  "apex-formula-racing":"assets/drift-car-reference.webp",
  "gravel-rally-stage":"assets/drift-track-2.webp",
  "fpv-drone-simulator":"assets/drift-track-1.webp"
 };
 const genreFor=(title,isExternal)=>{
  if(isExternal)return "External Games";
  if(["Drift Arena","Open World Drive","APEX Formula Racing","Gravel Rally Stage"].includes(title))return "Racing";
  if(["Tennis Rally","Hockey","Pool · 8 Ball"].includes(title))return "Sports";
  if(["Tank Arena","FPV Drone Simulator","Industrial Site Ops"].includes(title))return "Simulation";
  if(title==="Memory Match")return "Puzzle";
  return "Arcade";
 };
 const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const portalMarkup=[
 '<div class="portal-shell" id="portalShell">',
  '<aside class="portal-sidebar" id="portalSidebar">',
   '<div class="portal-brand"><div class="portal-brand-mark">P</div><div class="portal-brand-copy"><strong>PLAYSPACE</strong><small>YOUR GAME LIBRARY</small></div></div>',
   '<button class="portal-collapse" id="portalCollapse" type="button" aria-label="Collapse sidebar">‹</button>',
   '<nav class="portal-nav" aria-label="Main navigation">',
    '<div class="portal-nav-label">LIBRARY</div>',
    '<button class="portal-nav-item active" data-view="games"><span class="portal-nav-icon">▦</span><span class="portal-nav-label-text">Games</span><span class="portal-nav-count" id="gameCountBadge">21</span></button>',
    '<div class="portal-subnav" id="genreSubnav">',
     '<button class="active" data-genre="All Games">All games</button>',
     '<button data-genre="Racing">Racing</button>',
     '<button data-genre="Sports">Sports</button>',
     '<button data-genre="Simulation">Simulation</button>',
     '<button data-genre="Arcade">Arcade</button>',
     '<button data-genre="Puzzle">Puzzle</button>',
     '<button data-genre="External Games">External games</button>',
    '</div>',
    '<div class="portal-nav-label">PERSONAL</div>',
    '<button class="portal-nav-item" data-view="settings"><span class="portal-nav-icon">⚙</span><span class="portal-nav-label-text">Settings</span></button>',
    '<button class="portal-nav-item" data-view="music"><span class="portal-nav-icon">♫</span><span class="portal-nav-label-text">Music</span></button>',
    '<button class="portal-nav-item" data-view="profile"><span class="portal-nav-icon">◉</span><span class="portal-nav-label-text">Profile</span></button>',
    '<div class="portal-nav-label">TOOLS</div>',
    '<button class="portal-nav-item" data-view="dev"><span class="portal-nav-icon">⌘</span><span class="portal-nav-label-text">Dev mode</span><span class="portal-nav-count">LOCK</span></button>',
   '</nav>',
   '<div class="portal-sidebar-foot"><button class="portal-profile-chip" id="sidebarProfile"><span class="portal-avatar" id="sidebarAvatar">?</span><span class="portal-profile-copy"><b id="sidebarName">Guest player</b><small id="sidebarStatus">Sign in to sync your stats</small></span><span aria-hidden="true">›</span></button></div>',
  '</aside>',
  '<section class="portal-content">',
   '<header class="portal-topbar"><div><div class="portal-page-kicker" id="portalPageKicker">PLAYER LIBRARY</div><div class="portal-page-title" id="portalPageTitle">Games</div></div>',
    '<label class="portal-search"><span>⌕</span><input id="portalSearch" type="search" placeholder="Search games..." aria-label="Search games"></label>',
    '<button class="portal-top-action" id="portalQuickSignIn">Sign in</button>',
    '<button class="portal-account-button" id="portalAccountButton"><span class="portal-avatar" id="topAvatar">?</span><span id="topAccountName">Guest</span></button>',
   '</header>',
   '<div class="portal-views" id="portalViews">',
    '<section class="portal-view active" id="portalGamesView" data-page="games">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PICK UP WHERE YOU LEFT OFF</div><h1>Your next game<br>starts here.</h1><p>One library for every game. Browse by genre, open a game to see its details, and keep your profile and play history together.</p></div><div class="portal-live-pill"><span class="portal-live-dot"></span><span id="portalOnlineTotal">Checking live players</span></div></div>',
     '<div class="portal-filter-row" id="portalFilterRow"></div>',
     '<div id="portalGameGroups"></div>',
    '</section>',
    '<section class="portal-view" id="portalSettingsView" data-page="settings">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">MAKE IT YOURS</div><h1>Settings</h1><p>Personalise the library, your themes, layout, audio and motion. These preferences are saved in this browser.</p></div></div>',
     '<div id="portalSettingsContent"></div>',
    '</section>',
    '<section class="portal-view portal-music-page" id="portalMusicView" data-page="music">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">YOUR SOUNDTRACK</div><h1>Music</h1><p>Use the built-in player, your playlists and music files saved in this browser.</p></div></div>',
     '<div class="portal-section-panel"><div id="portalMusicHost"></div></div>',
    '</section>',
    '<section class="portal-view" id="portalProfileView" data-page="profile">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAYER ACCOUNT</div><h1>Your profile</h1><p>Your sign-in is shared with Hockey Online. Passwords are verified by the game server and are not saved as readable text in this website.</p></div></div>',
     '<div id="portalProfileContent"></div>',
    '</section>',
    '<section class="portal-view" id="portalDevView" data-page="dev">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">SYSTEM OVERVIEW</div><h1>Developer mode</h1><p>Live site and game activity. Access is checked by the server; the developer password is never saved in this browser.</p></div></div>',
     '<div class="portal-section-panel portal-dev-unlock" id="portalDevGate"><h2>Restricted area</h2><p>Enter the developer passcode to view live player and service metrics.</p><form id="portalDevForm" class="portal-profile-form"><div class="portal-field"><label for="portalDevPassword">Developer password</label><input id="portalDevPassword" type="password" inputmode="numeric" autocomplete="off" maxlength="64" required></div><button class="portal-primary" type="submit">Unlock dashboard</button><div class="portal-status" id="portalDevStatus" aria-live="polite"></div></form></div>',
     '<div class="portal-dev-metrics" id="portalDevMetrics"></div>',
    '</section>',
   '</div>',
  '</section>',
 '</div>',
 '<div class="portal-detail-backdrop" id="portalGameDetail" role="dialog" aria-modal="true" aria-label="Game details"><article class="portal-detail-card"><div class="portal-detail-cover" id="portalDetailCover"><button class="portal-modal-close" type="button" id="portalDetailClose" aria-label="Close">✕</button><div class="portal-cover-art" id="portalDetailArt"></div></div><div class="portal-detail-body"><div class="portal-detail-heading"><div><div class="portal-eyebrow" id="portalDetailGenre"></div><h2 id="portalDetailTitle">Game title</h2><p id="portalDetailDescription"></p></div></div><div class="portal-detail-actions" id="portalDetailPlay"></div><div class="portal-detail-stats"><div class="portal-detail-stat"><small>Players right now</small><b id="portalDetailPlayers">—</b></div><div class="portal-detail-stat"><small>Likes</small><b id="portalDetailLikes">—</b></div><div class="portal-detail-stat"><small>Dislikes</small><b id="portalDetailDislikes">—</b></div></div><div class="portal-vote-row"><span class="portal-muted" style="font-size:9px;margin-right:3px">Rate this game</span><button type="button" id="portalLikeBtn">👍 Like</button><button type="button" id="portalDislikeBtn">👎 Dislike</button><span class="portal-status" id="portalVoteStatus"></span></div></div></article></div>',
 '<div class="portal-auth-backdrop" id="portalAuthModal" role="dialog" aria-modal="true" aria-label="Player sign in"><section class="portal-auth-card"><button class="portal-modal-close" type="button" id="portalAuthClose" aria-label="Close">✕</button><div class="portal-auth-head"><div class="portal-brand-mark">P</div><div><h2 id="portalAuthTitle">Welcome back</h2><p id="portalAuthSubtitle">Sign in once. Your player profile is shared across the games.</p></div></div><div class="portal-auth-tabs"><button type="button" class="active" id="portalLoginTab">SIGN IN</button><button type="button" id="portalRegisterTab">CREATE ACCOUNT</button></div><form class="portal-auth-form" id="portalAuthForm"><div class="portal-field" id="portalAuthNameField" hidden><label for="portalAuthName">Player name</label><input id="portalAuthName" type="text" maxlength="18" autocomplete="nickname" placeholder="Your name"></div><div class="portal-field"><label for="portalAuthEmail">Email address</label><input id="portalAuthEmail" type="email" maxlength="254" autocomplete="email" required placeholder="you@example.com"></div><div class="portal-field"><label for="portalAuthPassword">Password</label><input id="portalAuthPassword" type="password" minlength="8" maxlength="128" autocomplete="current-password" required placeholder="At least 8 characters"></div><button class="portal-primary" id="portalAuthSubmit" type="submit">Sign in</button><div class="portal-status" id="portalAuthStatus" aria-live="polite"></div></form><div class="portal-auth-foot">Passwords are hashed on the server using scrypt. Only a random sign-in session token is kept in this browser. You can use the same account in Hockey Online.</div></section></div>',
 '<div class="portal-toast" id="portalToast" role="status" aria-live="polite"></div>'
 ].join("");
 app.innerHTML=portalMarkup;
 const portalShell=document.getElementById("portalShell");
 const $p=id=>document.getElementById(id);
 const games=[];
 const sourceCards=[...document.querySelectorAll("main .grid > .card")];
 const coverPhotoById=photos;
 const gameTitles=Object.keys(gameIdByTitle);
 for(const source of sourceCards){
  const title=(source.querySelector("h2")?.textContent||"").trim();
  if(!title)continue;
  const id=gameIdByTitle[title]||"";
  const rawOnclick=(source.querySelector(".play-card button")?.getAttribute("onclick")||"");
  const external=rawOnclick.includes("openExternal(");
  const genre=genreFor(title,external);
  const paragraph=source.querySelector("p");
  const icon=source.querySelector(".art-icon,.icon");
  const buttons=[...source.querySelectorAll(".play-card button")];
  games.push({
   id,title,genre,external,
   description:paragraph?.textContent?.trim()||"Open the game to explore its modes and options.",
   accent:(source.getAttribute("style")||"").match(/--accent:\s*([^;]+)/)?.[1]||"#7d7bff",
   art:icon?.innerHTML||"<span>🎮</span>",
   buttons,source
  });
 }
 $p("gameCountBadge").textContent=String(games.length);
 if(games.length)$p("portalGameGroups").dataset.ready="1";
 const categoryOrder=["Racing","Sports","Simulation","Arcade","Puzzle","External Games"];
 function cardMarkup(game){
  const photo=coverPhotoById[game.id]||"";
  const stats=catalogStats[game.id]||{};
  const players=Number.isFinite(stats.players)?stats.players:"—";
  const likes=Number.isFinite(stats.likes)?stats.likes:"—";
  const dislikes=Number.isFinite(stats.dislikes)?stats.dislikes:"—";
  return '<article class="portal-game-card" role="button" tabindex="0" data-game-card="'+esc(game.id)+'" style="--game-accent:'+esc(game.accent)+';--game-photo:'+(photo?'url(&quot;'+esc(photo)+'&quot;)':'none')+'" data-photo="'+(photo?"yes":"none")+'">'+
   '<div class="portal-game-cover"><span class="portal-cover-badge">'+esc(game.genre)+'</span><span class="portal-cover-players">● '+players+' live</span><div class="portal-cover-art">'+game.art+'</div></div>'+
   '<div class="portal-game-info"><div class="portal-game-name">'+esc(game.title)+'</div><div class="portal-game-meta"><span class="genre">'+esc(game.genre)+'</span><span>·</span><span>'+(game.external?"External game":"In library")+'</span></div><div class="portal-game-rating"><span>👍 '+likes+'</span><span>👎 '+dislikes+'</span><span class="portal-card-arrow">↗</span></div></div></article>';
 }
 function renderGameList(){
  const query=($p("portalSearch").value||"").trim().toLowerCase();
  const filtered=games.filter(g=>(selectedGenre==="All Games"||g.genre===selectedGenre)&&(!query||(g.title+" "+g.genre+" "+g.description).toLowerCase().includes(query)));
  const host=$p("portalGameGroups");
  host.innerHTML="";
  if(!filtered.length){host.innerHTML='<div class="portal-empty">No games match that search.</div>';return;}
  const groups=selectedGenre==="All Games"?categoryOrder.filter(cat=>filtered.some(g=>g.genre===cat)).map(cat=>({name:cat,items:filtered.filter(g=>g.genre===cat)})):[{name:selectedGenre,items:filtered}];
  for(const group of groups){
   const section=document.createElement("section");section.className="portal-genre-group";
   section.innerHTML='<div class="portal-genre-head"><h2>'+esc(group.name)+'</h2><span>'+group.items.length+' games</span></div><div class="portal-game-grid">'+group.items.map(cardMarkup).join("")+'</div>';
   host.appendChild(section);
  }
 }
 function showView(view){
  document.querySelectorAll(".portal-view").forEach(el=>el.classList.toggle("active",el.dataset.page===view));
  document.querySelectorAll(".portal-nav-item[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  const meta={games:["PLAYER LIBRARY","Games"],settings:["PERSONAL SPACE","Settings"],music:["YOUR SOUNDTRACK","Music"],profile:["PLAYER ACCOUNT","Profile"],dev:["SYSTEM OVERVIEW","Dev mode"]}[view]||["PLAYSPACE","Games"];
  $p("portalPageKicker").textContent=meta[0];$p("portalPageTitle").textContent=meta[1];
  if(view==="profile")renderProfile();
  if(view==="settings")renderSettings();
  if(view==="music")mountMusicPanel();
  if(view==="dev")renderDevView();
  if(view==="games")renderGameList();
 }
 document.querySelectorAll(".portal-nav-item[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
 document.querySelectorAll("[data-genre]").forEach(el=>el.addEventListener("click",()=>{
  selectedGenre=el.dataset.genre;
  document.querySelectorAll("[data-genre]").forEach(button=>button.classList.toggle("active",button===el));
  showView("games");
 }));
 $p("portalSearch").addEventListener("input",renderGameList);
 $p("portalCollapse").addEventListener("click",()=>{
  const collapsed=portalShell.classList.toggle("collapsed");
  portalSettings.sidebarExpanded=!collapsed;savePortalSettings();
 });
 $p("sidebarProfile").addEventListener("click",()=>{showView("profile");if(!account)showAuth();});
 $p("portalAccountButton").addEventListener("click",()=>{showView("profile");if(!account)showAuth();});
 $p("portalQuickSignIn").addEventListener("click",()=>showAuth());
 $p("portalGameGroups").addEventListener("click",event=>{
  const card=event.target.closest("[data-game-card]");if(!card)return;
  const game=games.find(g=>g.id===card.dataset.gameCard);if(game)openGameDetail(game);
 });
 $p("portalGameGroups").addEventListener("keydown",event=>{
  if(event.key!=="Enter"&&event.key!==" ")return;
  const card=event.target.closest("[data-game-card]");if(!card)return;
  event.preventDefault();const game=games.find(g=>g.id===card.dataset.gameCard);if(game)openGameDetail(game);
 });
 function openGameDetail(game){
  selectedGame=game;
  const cover=$p("portalDetailCover");
  cover.style.setProperty("--game-accent",game.accent);
  const photo=coverPhotoById[game.id]||"";
  cover.style.setProperty("--game-photo",photo?'url("'+photo+'")':"none");
  $p("portalDetailArt").innerHTML=game.art;
  $p("portalDetailGenre").textContent=(game.external?"EXTERNAL GAME · ":"")+game.genre.toUpperCase();
  $p("portalDetailTitle").textContent=game.title;
  $p("portalDetailDescription").textContent=game.description;
  const actions=$p("portalDetailPlay");actions.innerHTML="";
  game.buttons.forEach(button=>{
   const clone=button.cloneNode(true);
   clone.className="portal-primary";
   clone.removeAttribute("style");
   const handler=clone.getAttribute("onclick");
   if(handler)clone.setAttribute("onclick",handler+';document.getElementById("portalGameDetail").classList.remove("open")');
   actions.appendChild(clone);
  });
  if(!game.buttons.length){
   const placeholder=document.createElement("span");placeholder.className="portal-muted";placeholder.textContent="Play option unavailable";actions.appendChild(placeholder);
  }
  renderSelectedGameStats();$p("portalVoteStatus").textContent="";
  $p("portalGameDetail").classList.add("open");
 }
 function renderSelectedGameStats(){
  if(!selectedGame)return;
  const stats=catalogStats[selectedGame.id]||{};
  $p("portalDetailPlayers").textContent=Number.isFinite(stats.players)?String(stats.players):"—";
  $p("portalDetailLikes").textContent=Number.isFinite(stats.likes)?String(stats.likes):"—";
  $p("portalDetailDislikes").textContent=Number.isFinite(stats.dislikes)?String(stats.dislikes):"—";
 }
 function closeGameDetail(){$p("portalGameDetail").classList.remove("open");}
 $p("portalDetailClose").addEventListener("click",closeGameDetail);
 $p("portalGameDetail").addEventListener("click",e=>{if(e.target===$p("portalGameDetail"))closeGameDetail();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeGameDetail();$p("portalAuthModal").classList.remove("open");}});
 async function loadCatalogStats(){
  try{
   const response=await fetch(API_BASE+"/portal/catalog-stats",{cache:"no-store"});
   if(!response.ok)throw new Error("stats unavailable");
   const data=await response.json();catalogStats=data.games||{};
   if(selectedGame)renderSelectedGameStats();
   if($p("portalGameGroups").dataset.ready==="1")renderGameList();
   $p("portalOnlineTotal").textContent=(Number(data.onlinePlayers)||0)+" players online";
  }catch(error){
   $p("portalOnlineTotal").textContent="Live player counts unavailable";
  }
 }
 function apiRequest(path,options){
  const config={method:options?.method||"GET",headers:{"Content-Type":"application/json"},cache:"no-store"};
  const token=options&&options.token!==undefined?options.token:accountToken;
  if(token)config.headers.Authorization="Bearer "+token;
  if(options?.body!==undefined)config.body=JSON.stringify(options.body);
  if(options?.keepalive)config.keepalive=true;
  return fetch(API_BASE+path,config).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||("Request failed ("+response.status+")."));
   return data;
  });
 }
 function showAuth(mode="login"){
  setAuthMode(mode);$p("portalAuthStatus").textContent="";
  $p("portalAuthModal").classList.add("open");
  setTimeout(()=>$p("portalAuthEmail").focus(),30);
 }
 function setAuthMode(mode){
  authMode=mode;
  const register=mode==="register";
  $p("portalLoginTab").classList.toggle("active",!register);$p("portalRegisterTab").classList.toggle("active",register);
  $p("portalAuthNameField").hidden=!register;
  $p("portalAuthPassword").autocomplete=register?"new-password":"current-password";
  $p("portalAuthTitle").textContent=register?"Create your player account":"Welcome back";
  $p("portalAuthSubtitle").textContent=register?"One account for the full game library.":"Sign in once to sync your profile and play history.";
  $p("portalAuthSubmit").textContent=register?"Create account":"Sign in";
 }
 $p("portalLoginTab").addEventListener("click",()=>setAuthMode("login"));
 $p("portalRegisterTab").addEventListener("click",()=>setAuthMode("register"));
 $p("portalAuthClose").addEventListener("click",()=>$p("portalAuthModal").classList.remove("open"));
 $p("portalAuthModal").addEventListener("click",e=>{if(e.target===$p("portalAuthModal"))$p("portalAuthModal").classList.remove("open");});
 function setAuthStatus(message,type=""){
  const el=$p("portalAuthStatus");el.textContent=message;el.className="portal-status "+type;
 }
 async function submitAuth(event){
  event.preventDefault();
  const button=$p("portalAuthSubmit");button.disabled=true;
  setAuthStatus(authMode==="register"?"Creating your account…":"Signing in…");
  const email=$p("portalAuthEmail").value.trim(),password=$p("portalAuthPassword").value;
  const body={email,password};
  if(authMode==="register")body.name=$p("portalAuthName").value.trim();
  try{
   const data=await apiRequest(authMode==="register"?"/account/register":"/account/login",{method:"POST",body,token:""});
   if(!data.token||!data.profile)throw new Error("The account server did not return a session.");
   accountToken=data.token;
   try{localStorage.setItem(TOKEN_KEY,accountToken);}catch(error){}
   const {token,...safe}=data;account=safe.profile;accountStats=safe.stats||{};$p("portalAuthPassword").value="";
   $p("portalAuthModal").classList.remove("open");
   renderAccountIdentity();renderProfile();
   toast(authMode==="register"?"Account created. You are signed in.":"Signed in. Your profile has been restored.");
   if(pendingLaunch){const launch=pendingLaunch;pendingLaunch=null;launch();}
  }catch(error){
   const text=error.message.includes("Persistent accounts are not enabled")||error.message.includes("DATABASE_URL")
    ?"Account saving is not enabled yet. The game server needs a durable PostgreSQL database before accounts can be created."
    :error.message;
   setAuthStatus(text,"error");
  }finally{button.disabled=false;}
 }
 $p("portalAuthForm").addEventListener("submit",submitAuth);
 function renderAccountIdentity(){
  const name=account?.name||"Guest player",initial=(name.trim()[0]||"?").toUpperCase();
  $p("sidebarName").textContent=name;$p("sidebarStatus").textContent=account?"Account synced":"Sign in to sync your stats";
  $p("sidebarAvatar").textContent=initial;$p("topAvatar").textContent=initial;$p("topAccountName").textContent=account?name:"Guest";
  $p("portalQuickSignIn").textContent=account?"Signed in":"Sign in";
 }
 async function loadAccount(){
  try{accountToken=localStorage.getItem(TOKEN_KEY)||"";}catch(error){accountToken="";}
  if(!accountToken){renderAccountIdentity();return;}
  try{
   const data=await apiRequest("/account/me",{token:accountToken});
   account=data.profile;accountStats=data.stats||{};renderAccountIdentity();
  }catch(error){
   if(/expired|sign in again|incorrect/i.test(error.message)){try{localStorage.removeItem(TOKEN_KEY);}catch(e){}accountToken="";account=null;accountStats=null;}
   renderAccountIdentity();
   if(error.message.includes("Persistent accounts are not enabled"))toast("Account storage is offline. Saved sign-ins need a durable database.");
  }
 }
 function renderProfile(){
  const host=$p("portalProfileContent");
  if(!account){host.innerHTML='<div class="portal-section-panel"><h2>Sign in to your player profile</h2><p>Create one account and use it across the whole game library, including Hockey Online. Your saved progress appears here after you sign in.</p><div style="margin-top:15px"><button class="portal-primary" id="profileSignIn">Sign in or create account</button></div><div class="portal-status" style="margin-top:10px">Account persistence requires the game server database to be connected.</div></div>';$p("profileSignIn").addEventListener("click",()=>showAuth());return;}
  const stats=accountStats||{},gameStats=stats.games||{};
  const statTiles=[
   ["Games played",stats.matchesPlayed||0],["Wins",stats.wins||0],["Win rate",(stats.winRate||0)+"%"],["Time played",formatDuration(stats.timePlayedSeconds||0)]
  ];
  const tileHtml=statTiles.map(x=>'<div class="portal-stat-tile"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join("");
  const rows=Object.entries(gameStats).sort((a,b)=>(b[1]?.playTimeSeconds||0)-(a[1]?.playTimeSeconds||0));
  const gameRows=rows.length?rows.map(([id,value])=>'<tr><td>'+esc(gameTitleFromId(id))+'</td><td>'+Number(value.sessions||0)+'</td><td>'+formatDuration(value.playTimeSeconds||0)+'</td><td>'+ (value.lastPlayedAt?new Date(value.lastPlayedAt).toLocaleDateString():"—")+'</td></tr>').join(""):'<tr><td colspan="4" class="portal-muted">Your per-game play history will appear here as you play.</td></tr>';
  host.innerHTML='<div class="portal-profile-layout"><div><div class="portal-profile-hero"><div class="portal-avatar">'+esc((account.name||"P").slice(0,1).toUpperCase())+'</div><div class="portal-eyebrow">PLAYER ACCOUNT</div><h2>'+esc(account.name)+'</h2><div class="email">'+esc(account.email)+'</div><form class="portal-profile-form" id="portalProfileForm"><div class="portal-field"><label for="portalProfileName">Player name</label><input id="portalProfileName" type="text" maxlength="18" required value="'+esc(account.name||"Player")+'"></div><button class="portal-primary" type="submit">Save profile</button><div class="portal-status" id="portalProfileStatus"></div></form><button class="portal-secondary portal-danger" id="portalSignOut" type="button">Sign out</button></div></div><div><div class="portal-stat-grid">'+tileHtml+'</div><div class="portal-section-panel" style="margin-top:12px"><h2>Game history</h2><p>Play sessions and time recorded on this account.</p><table class="portal-table"><thead><tr><th>Game</th><th>Sessions</th><th>Play time</th><th>Last played</th></tr></thead><tbody>'+gameRows+'</tbody></table></div></div></div>';
  $p("portalProfileForm").addEventListener("submit",async event=>{
   event.preventDefault();const status=$p("portalProfileStatus");status.textContent="Saving…";
   try{
    const data=await apiRequest("/account/profile",{method:"POST",body:{name:$p("portalProfileName").value.trim(),skin:account.skin||0}});
    account=data.profile;accountStats=data.stats||accountStats;renderAccountIdentity();renderProfile();toast("Profile saved.");
   }catch(error){status.textContent=error.message;status.classList.add("error");}
  });
  $p("portalSignOut").addEventListener("click",signOut);
 }
 async function signOut(){
  const oldToken=accountToken;
  try{if(oldToken)await apiRequest("/account/logout",{method:"POST",body:{},token:oldToken});}catch(error){}
  try{localStorage.removeItem(TOKEN_KEY);}catch(error){}
  account=null;accountStats=null;accountToken="";renderAccountIdentity();renderProfile();toast("You are signed out.");
 }
 function formatDuration(value){
  const total=Math.max(0,Math.floor(Number(value)||0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60);
  return hours?hours+"h "+minutes+"m":minutes+"m";
 }
 function gameTitleFromId(id){const found=games.find(g=>g.id===id);return found?.title||id;}
 function toast(message){
  const el=$p("portalToast");el.textContent=message;el.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3600);
 }
 async function voteSelectedGame(vote){
  if(!selectedGame)return;
  if(!account){setAuthStatus("Sign in to rate games.");showAuth();return;}
  try{
   const data=await apiRequest("/portal/vote",{method:"POST",body:{gameId:selectedGame.id,vote}});
   catalogStats[selectedGame.id]=data.stats||catalogStats[selectedGame.id];renderSelectedGameStats();renderGameList();
   $p("portalVoteStatus").textContent=data.vote?"Your rating was saved.":"Your rating was removed.";
  }catch(error){$p("portalVoteStatus").textContent=error.message.includes("Persistent accounts")?"Ratings will be saved when database storage is enabled.":error.message;}
 }
 $p("portalLikeBtn").addEventListener("click",()=>voteSelectedGame("like"));
 $p("portalDislikeBtn").addEventListener("click",()=>voteSelectedGame("dislike"));
 function ensureAccountForLaunch(gameId,launch,external=false){
  if(!account||!accountToken){
   pendingLaunch=external?null:()=>ensureAccountForLaunch(gameId,launch,false);
   showAuth();setAuthStatus("Sign in or create an account before playing.");
   return;
  }
  const run=async()=>{
   try{await startPortalSession(gameId);}
   catch(error){toast("Could not start a saved game session: "+error.message);return;}
   launch();
  };
  if(external){
   const ext=launch();
   run().then(()=>{externalWindow=ext;if(externalPoll)clearInterval(externalPoll);externalPoll=setInterval(()=>{if(!externalWindow||externalWindow.closed){clearInterval(externalPoll);externalPoll=null;endPortalSession();}},2500);});
  }else run();
 }
 function makeSessionId(){
  try{return crypto.randomUUID().replace(/-/g,"");}catch(error){return Math.random().toString(36).slice(2)+Date.now().toString(36)+Math.random().toString(36).slice(2);}
 }
 async function startPortalSession(gameId){
  if(portalSession)await endPortalSession();
  const sessionId=makeSessionId();
  await apiRequest("/portal/presence",{method:"POST",body:{gameId,sessionId,action:"start"}});
  portalSession={gameId,sessionId};
  if(heartbeatTimer)clearInterval(heartbeatTimer);
  heartbeatTimer=setInterval(()=>{
   if(!portalSession)return;
   apiRequest("/portal/presence",{method:"POST",body:{gameId:portalSession.gameId,sessionId:portalSession.sessionId,action:"heartbeat"}}).catch(()=>{});
  },25000);
  loadCatalogStats();
 }
 async function endPortalSession(){
  if(heartbeatTimer)clearInterval(heartbeatTimer);heartbeatTimer=null;
  if(!portalSession)return;
  const current=portalSession;portalSession=null;externalWindow=null;
  try{await apiRequest("/portal/presence",{method:"POST",body:{gameId:current.gameId,sessionId:current.sessionId,action:"end"},keepalive:true});}catch(error){}
  loadAccount();loadCatalogStats();
 }
 window.addEventListener("pagehide",()=>{
  if(!portalSession)return;
  const current=portalSession,token=accountToken;
  fetch(API_BASE+"/portal/presence",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({gameId:current.gameId,sessionId:current.sessionId,action:"end"}),keepalive:true}).catch(()=>{});
 });
 window.addEventListener("storage",event=>{
  if(event.key===TOKEN_KEY){loadAccount();}
 });
 const originalEnterGameFS=window.enterGameFS;
 if(typeof originalEnterGameFS==="function"){
  window.enterGameFS=async function(){
   if(!portalSettings.openGameFullscreen)return;
   return originalEnterGameFS.apply(this,arguments);
  };
 }
 const originalOpenGame=window.openGame;
 if(typeof originalOpenGame==="function"){
  window.openGame=function(type){
   const ids={tennis:"tennis-rally",hockey:"hockey",reaction:"reaction-game",click:"click-test",breaker:"neon-breaker",skydash:"flappy-bird",snake:"neon-snake",defender:"space-defender",runner:"neon-runner",memory:"memory-match"};
   const gameId=ids[type]||"hockey";
   return ensureAccountForLaunch(gameId,()=>originalOpenGame.apply(this,arguments));
  };
 }
 const originalStandalone=window.openStandaloneGame;
 if(typeof originalStandalone==="function"){
  window.openStandaloneGame=function(file,title,mode){
   const ids={"drift-arena.html":"drift-arena","open-world-drive.html":"open-world-drive","tank-arena-3d.html":"tank-arena-3d","formula-one.html":"apex-formula-racing","rally-stage.html":"gravel-rally-stage","drone-simulator.html":"fpv-drone-simulator","industrial-site-ops.html":"industrial-site-ops","pool.html":"pool-8-ball"};
   const gameId=ids[file]||"open-world-drive";
   return ensureAccountForLaunch(gameId,()=>originalStandalone.call(this,file,title,mode));
  };
 }
 window.openExternal=function(url){
  if(!account||!accountToken){showAuth();setAuthStatus("Sign in before opening external games.");return null;}
  if(portalSettings.confirmExternal&&!window.confirm("This game opens on an external website. Continue?"))return null;
  const win=window.open(url,"_blank");
  if(win)try{win.opener=null;}catch(error){}
  const game=games.find(g=>g.external&&g.buttons.some(b=>(b.getAttribute("onclick")||"").includes(url)));
  const gameId=game?.id||"moto-x3m";
  ensureAccountForLaunch(gameId,()=>win,true);
  return win;
 };
 const originalCloseGame=window.closeGame;
 if(typeof originalCloseGame==="function"){
  window.closeGame=async function(){await endPortalSession();return originalCloseGame.apply(this,arguments);};
 }
 const originalCloseStandalone=window.closeStandaloneGame;
 if(typeof originalCloseStandalone==="function"){
  window.closeStandaloneGame=function(){endPortalSession();return originalCloseStandalone.apply(this,arguments);};
 }
 /* Settings: 12 visual themes plus detailed audio, layout and motion preferences. */
 const themeDefs=[
  ["playstation","PlayStation","#3d77ff","#75baff","#091b4a"],
  ["xbox","Xbox","#21bb63","#8bea9b","#103d28"],
  ["steam","Steam","#4c9de8","#7dceff","#193f65"],
  ["neon","Neon arcade","#ed4dcc","#4ce9ff","#5b286e"],
  ["aurora","Aurora","#8d7bff","#58e0be","#24384d"],
  ["sunset","Sunset","#ff8b65","#ffcf78","#713c50"],
  ["retro","Retro amber","#e8b84b","#94cf70","#59431f"],
  ["light","Light","#5b68dc","#3088bd","#d9e7ff"],
  ["forest","Forest","#65b77a","#b0dc83","#254c36"],
  ["crimson","Crimson","#e24d69","#f69b81","#632941"],
  ["ocean","Ocean","#25a5b7","#7be1d0","#153e54"],
  ["graphite","Graphite","#a0a9ba","#d2d9e1","#3a414d"]
 ];
 const settingDefaults={theme:"playstation",columns:4,cardSize:"normal",motion:true,backgroundGlow:true,hoverEffects:true,sound:true,soundVolume:70,musicEnabled:true,musicVolume:48,autoMusic:false,sidebarExpanded:true,showLiveCounts:true,showRatings:true,compactDetails:false,reduceTransparency:false,rememberSearch:true,openGameFullscreen:true,confirmExternal:true};
 let portalSettings={...settingDefaults};
 try{portalSettings={...portalSettings,...JSON.parse(localStorage.getItem("arcadePortalSettings")||"{}")};}catch(error){}
 function savePortalSettings(){try{localStorage.setItem("arcadePortalSettings",JSON.stringify(portalSettings));}catch(error){}}
 function applyPortalSettings(){
  document.body.dataset.portalTheme=themeDefs.some(t=>t[0]===portalSettings.theme)?portalSettings.theme:"playstation";
  document.documentElement.style.setProperty("--portal-columns",String(Math.max(2,Math.min(6,Number(portalSettings.columns)||4))));
  document.documentElement.style.setProperty("--portal-card-radius",portalSettings.cardSize==="square"?"8px":portalSettings.cardSize==="round"?"26px":"18px");
  portalShell.classList.toggle("collapsed",!portalSettings.sidebarExpanded);
  document.body.classList.toggle("portal-motion-off",!portalSettings.motion);
  document.body.classList.toggle("portal-glow-off",!portalSettings.backgroundGlow);
  document.body.classList.toggle("portal-compact",portalSettings.cardSize==="compact");
  document.body.classList.toggle("portal-no-live",!portalSettings.showLiveCounts);
  document.body.classList.toggle("portal-no-ratings",!portalSettings.showRatings);
  document.body.classList.toggle("portal-hover-off",!portalSettings.hoverEffects);
  document.body.classList.toggle("portal-solid-panels",!!portalSettings.reduceTransparency);
  if(typeof siteSettings!=="undefined"){
   siteSettings.sfx=!!portalSettings.sound;
   siteSettings.sfxVolume=Math.max(0,Math.min(1,Number(portalSettings.soundVolume)/100));
   siteSettings.music=!!portalSettings.musicEnabled;
   siteSettings.musicVolume=Math.max(0,Math.min(1,Number(portalSettings.musicVolume)/100));
   if(typeof applySiteSettings==="function")applySiteSettings();
  }
  if($p("portalSearch"))$p("portalSearch").placeholder=portalSettings.rememberSearch?"Search games...":"Search this visit...";
 }
 function renderSettings(){
  const host=$p("portalSettingsContent");
  const swatches=themeDefs.map(t=>'<button class="portal-theme-swatch '+(portalSettings.theme===t[0]?"active":"")+'" data-theme-choice="'+t[0]+'"><div class="portal-theme-preview" style="--swatch-a:'+t[2]+';--swatch-b:'+t[3]+';--swatch-c:'+t[4]+'"></div><b>'+t[1]+'</b></button>').join("");
  host.innerHTML='<div class="portal-section-panel"><h2>Choose your theme</h2><p>Console-inspired looks, soft colours and high-contrast arcade styles.</p><div class="portal-theme-grid">'+swatches+'</div></div>'+
   '<div class="portal-settings-grid">'+
    '<section class="portal-setting-group"><h3>Layout and navigation</h3>'+settingSelect("columns","Games per row",[[2,"2 columns"],[3,"3 columns"],[4,"4 columns"],[5,"5 columns"],[6,"6 columns"]],portalSettings.columns)+settingSelect("cardSize","Card shape", [["compact","Compact"],["normal","Rounded"],["round","Extra rounded"],["square","Square"]],portalSettings.cardSize)+settingCheck("sidebarExpanded","Keep sidebar expanded",portalSettings.sidebarExpanded)+settingCheck("showLiveCounts","Show live player counts",portalSettings.showLiveCounts)+settingCheck("showRatings","Show likes and dislikes",portalSettings.showRatings)+settingCheck("rememberSearch","Remember search text",portalSettings.rememberSearch)+'</section>'+
    '<section class="portal-setting-group"><h3>Motion and appearance</h3>'+settingCheck("motion","Smooth animations",portalSettings.motion)+settingCheck("backgroundGlow","Animated ambient glow",portalSettings.backgroundGlow)+settingCheck("hoverEffects","Animated game-card hover",portalSettings.hoverEffects)+settingCheck("reduceTransparency","Use stronger solid panels",portalSettings.reduceTransparency)+settingCheck("compactDetails","Compact game detail screen",portalSettings.compactDetails)+'</section>'+
    '<section class="portal-setting-group"><h3>Sound and music</h3>'+settingCheck("sound","Interface sound effects",portalSettings.sound)+settingRange("soundVolume","Sound volume",portalSettings.soundVolume,0,100)+settingCheck("musicEnabled","Music player enabled",portalSettings.musicEnabled)+settingRange("musicVolume","Music volume",portalSettings.musicVolume,0,100)+settingCheck("autoMusic","Start music when opening library",portalSettings.autoMusic)+'</section>'+
    '<section class="portal-setting-group"><h3>Game launch and privacy</h3>'+settingCheck("openGameFullscreen","Open supported games in fullscreen",portalSettings.openGameFullscreen)+settingCheck("confirmExternal","Confirm external game links",portalSettings.confirmExternal)+'<div class="portal-setting-row"><label>Account session<small>Your sign-in token is kept in browser storage for the shared Hockey account.</small></label><span class="portal-muted" style="font-size:9px;text-align:right">Shared account</span></div></section>'+
   '</div><div class="portal-settings-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="portal-secondary" id="portalResetSettings">Reset settings</button><button class="portal-primary" id="portalSaveSettings">Save settings</button></div><div class="portal-status" id="portalSettingsStatus"></div>';
  host.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{
   portalSettings.theme=button.dataset.themeChoice;applyPortalSettings();renderSettings();
  }));
  host.querySelectorAll("[data-setting-key]").forEach(control=>control.addEventListener("change",()=>{
   const key=control.dataset.settingKey;
   portalSettings[key]=control.type==="checkbox"?control.checked:control.type==="range"?Number(control.value):control.value;
   applyPortalSettings();savePortalSettings();
  }));
  $p("portalSaveSettings").addEventListener("click",()=>{savePortalSettings();$p("portalSettingsStatus").textContent="Settings saved in this browser.";});
  $p("portalResetSettings").addEventListener("click",()=>{portalSettings={...settingDefaults};applyPortalSettings();savePortalSettings();renderSettings();});
 }
 function settingSelect(key,label,options,value){
  return '<div class="portal-setting-row"><label>'+label+'</label><select class="portal-control" data-setting-key="'+key+'">'+options.map(o=>'<option value="'+o[0]+'" '+(String(o[0])===String(value)?"selected":"")+'>'+o[1]+'</option>').join("")+'</select></div>';
 }
 function settingCheck(key,label,value){
  return '<div class="portal-setting-row"><label>'+label+'</label><input class="portal-control" type="checkbox" data-setting-key="'+key+'" '+(value?"checked":"")+'></div>';
 }
 function settingRange(key,label,value,min,max){
  return '<div class="portal-setting-row"><label>'+label+'<small>'+value+'%</small></label><input class="portal-control" type="range" min="'+min+'" max="'+max+'" value="'+value+'" data-setting-key="'+key+'"></div>';
 }
 function mountMusicPanel(){
  const panel=document.getElementById("musicPanel"),host=$p("portalMusicHost");
  if(panel&&host&&panel.parentElement!==host){host.appendChild(panel);panel.classList.add("open");}
 }
 function renderDevView(){
  $p("portalDevMetrics").classList.remove("open");
 }
 $p("portalDevForm").addEventListener("submit",async event=>{
  event.preventDefault();const input=$p("portalDevPassword"),status=$p("portalDevStatus");
  status.textContent="Checking password…";
  try{
   const metrics=await apiRequest("/portal/admin/metrics",{method:"POST",body:{password:input.value},token:""});
   devPasswordDraft="";input.value="";status.textContent="";
   renderDevMetrics(metrics);$p("portalDevGate").style.display="none";
  }catch(error){status.textContent=error.message;status.classList.add("error");}
 });
 function renderDevMetrics(data){
  const host=$p("portalDevMetrics");host.classList.add("open");
  const p=data.players||{},server=data.server||{};
  const cards=[["Accounts",p.accounts||0],["Valid sessions",p.validSessions||0],["Playing now",p.onlineNow||0],["Server uptime",formatDuration(server.uptimeSeconds||0)],["Memory use",(server.memoryMb||0)+" MB"],["Node version",server.node||"—"]];
  const cardHtml=cards.map(x=>'<div class="portal-dev-card"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join("");
  const gamesHtml=Object.entries(p.byGame||{}).map(([id,v])=>'<div class="portal-dev-game"><b>'+esc(gameTitleFromId(id))+'</b><span>'+Number(v.players||0)+' online<br>👍 '+Number(v.likes||0)+' · 👎 '+Number(v.dislikes||0)+'</span></div>').join("");
  const roomsHtml=(data.rooms||[]).length?(data.rooms||[]).map(r=>'<tr><td>'+esc(r.game)+'</td><td>'+esc(r.status)+'</td><td>'+Number(r.players||0)+'</td></tr>').join(""):'<tr><td colspan="3">No live multiplayer rooms</td></tr>';
  host.innerHTML='<div class="portal-section-panel"><div class="portal-eyebrow">LIVE SYSTEM SNAPSHOT</div><div class="portal-dev-grid">'+cardHtml+'</div><h2>Players by game</h2><div class="portal-dev-game-list">'+gamesHtml+'</div><div style="display:flex;align-items:center;gap:8px;margin-top:17px"><h2 style="margin:0">Multiplayer rooms</h2><span class="portal-muted" style="font-size:8px">Updated '+new Date(data.updatedAt||Date.now()).toLocaleTimeString()+'</span><button class="portal-secondary" id="portalDevRefresh" style="margin-left:auto">Refresh</button><button class="portal-secondary" id="portalDevLock">Lock</button></div><table class="portal-table"><thead><tr><th>Game</th><th>Status</th><th>Players</th></tr></thead><tbody>'+roomsHtml+'</tbody></table></div>';
  $p("portalDevRefresh").addEventListener("click",()=>{$p("portalDevGate").style.display="block";host.classList.remove("open");$p("portalDevPassword").value="";$p("portalDevStatus").textContent="Enter the passcode again to refresh live metrics.";});
  $p("portalDevLock").addEventListener("click",()=>{$p("portalDevGate").style.display="block";host.classList.remove("open");$p("portalDevPassword").value="";});
 }
 applyPortalSettings();
 renderGameList();
 renderAccountIdentity();
 renderProfile();
 loadCatalogStats();
 loadAccount();
 setInterval(loadCatalogStats,30000);
 showView("games");
})();
