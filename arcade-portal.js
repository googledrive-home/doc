
(() => {
 "use strict";
 const API_BASE="https://hockey-multiplayer.onrender.com";
 const USERNAME_KEY="playspaceUsername";
 const app=document.getElementById("arcadeRoot");
 if(!app)return;
 let username="",selectedGenre="",selectedGame=null,devPasswordInMemory="",devRefreshTimer=null,devServerWarmup=null,devServerWarm=false,devServerWarmAt=0,currentPlayingGame="",presenceHeartbeat=null,presenceSessionId="";
 const gameIdByTitle={
  "Drift Arena":"drift-arena","Open World Drive":"open-world-drive","Tank Arena":"tank-arena-3d",
  "Google Drive Files":"google-drive-files","F1 Simulator":"f1-simulator",
  "APEX Formula Racing":"apex-formula-racing","Gravel Rally Stage":"gravel-rally-stage",
  "FPV Drone Simulator":"fpv-drone-simulator","Industrial Site Ops":"industrial-site-ops",
  "8 Ball Pool":"pool-8-ball","Tennis Rally":"tennis-rally","Hockey":"hockey",
  "Reaction Game":"reaction-game","Click Test":"click-test","Neon Breaker":"neon-breaker",
  "Flappy Bird":"flappy-bird","Neon Snake":"neon-snake","Space Defender":"space-defender",
  "Neon Runner":"neon-runner","Memory Match":"memory-match","Moto X3M":"moto-x3m",
  "Learn to Fly":"learn-to-fly","Garden Gnomes":"garden-gnomes",
  "Sumiro":"sumiro",
  "Cube Engine":"cube-engine","Mini Golf 3D":"mini-golf-3d","Eaglercraft Singleplayer":"eaglercraft-singleplayer",
 };
 const photos={
  "drift-arena":"assets/drift-track-1.webp",
  "open-world-drive":"assets/drift-track-2.webp",
  "apex-formula-racing":"assets/drift-car-reference.webp",
  "gravel-rally-stage":"assets/drift-track-2.webp",
  "fpv-drone-simulator":"assets/drift-track-1.webp",
  "mini-golf-3d":"https://images.unsplash.com/photo-1657085716783-c0afbdabf96e?auto=format&fit=crop&w=1400&q=85",
 };
 const genreFor=(title,isExternal)=>{
  if(isExternal)return "External Games";
  if(title==="Google Drive Files")return "Work";
  if(title==="F1 Simulator")return "Racing";
  if(["Drift Arena","Open World Drive","APEX Formula Racing","Gravel Rally Stage","F1 Simulator"].includes(title))return "Racing";
  if(["Tennis Rally","Hockey","8 Ball Pool","Mini Golf 3D"].includes(title))return "Sports";
  if(["Tank Arena","FPV Drone Simulator","Industrial Site Ops","Cube Engine"].includes(title))return "Simulation";
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
    '<div class="portal-nav-label">PERSONAL</div>',
    '<button class="portal-nav-item" data-view="settings"><span class="portal-nav-icon">⚙</span><span class="portal-nav-label-text">Settings</span></button>',
    '<button class="portal-nav-item" data-view="music"><span class="portal-nav-icon">♫</span><span class="portal-nav-label-text">Music</span></button>',
    '<button class="portal-nav-item" data-view="profile"><span class="portal-nav-icon">◉</span><span class="portal-nav-label-text">Profile</span></button>',
    '<div class="portal-nav-label">TOOLS</div>',
    '<button class="portal-nav-item" data-view="dev"><span class="portal-nav-icon">▣</span><span class="portal-nav-label-text">Restricted</span><span class="portal-nav-count">LOCKED</span></button>',
   '</nav>',
   '<div class="portal-sidebar-foot"><button class="portal-profile-chip" id="sidebarProfile"><span class="portal-avatar" id="sidebarAvatar">?</span><span class="portal-profile-copy"><b id="sidebarName">Player</b><small id="sidebarStatus">Your username</small></span><span aria-hidden="true">›</span></button></div>',
  '</aside>',
  '<section class="portal-content">',
   '<header class="portal-topbar"><div><div class="portal-page-kicker" id="portalPageKicker">PLAYER LIBRARY</div><div class="portal-page-title" id="portalPageTitle">Games</div></div>',
    '<label class="portal-search"><span>⌕</span><input id="portalSearch" type="search" placeholder="Search games..." aria-label="Search games"></label>',
    '<button class="portal-top-action" id="portalQuickSignIn">Change username</button>',
    '<button class="portal-account-button" id="portalAccountButton"><span class="portal-avatar" id="topAvatar">?</span><span id="topAccountName">Guest</span></button>',
   '</header>',
   '<div class="portal-views" id="portalViews">',
    '<section class="portal-view active" id="portalGamesView" data-page="games">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAYSPACE LIBRARY</div><h1>Browse games</h1><p>Choose a category to explore its games.</p></div></div>',
     '<div class="portal-category-tabs" id="portalFilterRow" role="tablist" aria-label="Game categories"></div>',
     '<div id="portalCategoryView" hidden><div class="portal-category-toolbar"><button class="portal-secondary" id="portalBackToCategories" type="button">← All categories</button><div><div class="portal-eyebrow">GAME CATEGORY</div><h2 id="portalCategoryTitle"></h2></div></div><div id="portalGameGroups"></div></div>',
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
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAYER</div><h1>Your profile</h1><p>Change the username shown around the site.</p></div></div>',
     '<div id="portalProfileContent"></div>',
    '</section>',
    '<section class="portal-view" id="portalDevView" data-page="dev">',
     '<div class="portal-section-panel portal-dev-unlock" id="portalDevGate"><h2>Restricted</h2><form id="portalDevForm" class="portal-profile-form"><div class="portal-field"><label for="portalDevPassword">Password</label><input id="portalDevPassword" type="password" inputmode="numeric" autocomplete="off" maxlength="64" required></div><button class="portal-primary" type="submit">Unlock</button><div class="portal-status" id="portalDevStatus" aria-live="polite"></div></form></div>',
     '<div class="portal-dev-metrics" id="portalDevMetrics"></div>',
    '</section>',
   '</div>',
  '</section>',
 '</div>',
 '<div class="portal-detail-backdrop" id="portalGameDetail" role="dialog" aria-modal="true" aria-label="Game details"><article class="portal-detail-card"><div class="portal-detail-cover" id="portalDetailCover"><button class="portal-modal-close" type="button" id="portalDetailClose" aria-label="Close">✕</button><div class="portal-cover-art" id="portalDetailArt"></div></div><div class="portal-detail-body"><div class="portal-detail-heading"><div><div class="portal-eyebrow" id="portalDetailGenre"></div><h2 id="portalDetailTitle">Game title</h2><p id="portalDetailDescription"></p></div></div><div class="portal-detail-actions" id="portalDetailPlay"></div></div></article></div>',
 '<div class="portal-toast" id="portalToast" role="status" aria-live="polite"></div>'
 ].join("");
 app.innerHTML=portalMarkup;
 const portalShell=document.getElementById("portalShell");
 const $p=id=>document.getElementById(id);
 const ACCESS_SESSION_KEY="playspaceSiteAccess";
 const ACCESS_PASSWORD="710";
 let siteAccessGranted=false;
 try{siteAccessGranted=sessionStorage.getItem(ACCESS_SESSION_KEY)==="1";}catch(error){}
 try{username=(localStorage.getItem(USERNAME_KEY)||"").trim().slice(0,24);}catch(error){}
 const presenceSessionKey="playspacePresenceSession";
 try{
  presenceSessionId=sessionStorage.getItem(presenceSessionKey)||"";
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(presenceSessionId)){
   presenceSessionId=(window.crypto&&typeof window.crypto.randomUUID==="function")?window.crypto.randomUUID():("ps-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
   sessionStorage.setItem(presenceSessionKey,presenceSessionId);
  }
 }catch(error){presenceSessionId="ps-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);}
 app.insertAdjacentHTML("beforeend",'<div class="portal-auth-backdrop portal-access-gate" id="portalAccessModal" role="dialog" aria-modal="true" aria-label="Enter site password"><section class="portal-auth-card"><div class="portal-auth-head"><div class="portal-brand-mark">P</div><div><h2>Welcome to PlaySpace</h2><p>Enter the site password to continue.</p></div></div><form class="portal-auth-form" id="portalAccessForm"><div class="portal-field"><label for="portalAccessPassword">Site password</label><input id="portalAccessPassword" type="password" inputmode="numeric" maxlength="3" autocomplete="off" required placeholder="Enter password"></div><button class="portal-primary" type="submit">Continue</button><div class="portal-status" id="portalAccessStatus" aria-live="polite"></div></form></section></div>');
 app.insertAdjacentHTML("beforeend",'<div class="portal-auth-backdrop" id="portalUsernameModal" role="dialog" aria-modal="true" aria-label="Choose a username"><section class="portal-auth-card"><div class="portal-auth-head"><div class="portal-brand-mark">P</div><div><h2>Welcome to PlaySpace</h2></div></div><form class="portal-auth-form" id="portalUsernameForm"><div class="portal-field"><label for="portalUsernameInput">Username</label><input id="portalUsernameInput" type="text" maxlength="24" autocomplete="nickname" required placeholder="Choose a username"></div><button class="portal-primary" type="submit">Continue</button><div class="portal-status" id="portalUsernameStatus" aria-live="polite"></div></form></section></div>');
 function updateUsernameDisplay(){
  const name=username||"Player",initial=(name.trim()[0]||"?").toUpperCase();
  $p("sidebarName").textContent=name;$p("sidebarStatus").textContent="Player";
  $p("sidebarAvatar").textContent=initial;$p("topAvatar").textContent=initial;
  $p("topAccountName").textContent=name;
 }
 function showUsernamePrompt(){
  $p("portalUsernameInput").value=username;
  $p("portalUsernameStatus").textContent="";
  $p("portalUsernameStatus").className="portal-status";
  $p("portalUsernameModal").classList.add("open");
  setTimeout(()=>$p("portalUsernameInput").focus(),30);
 }
 $p("portalUsernameForm").addEventListener("submit",event=>{
  event.preventDefault();
  const entered=$p("portalUsernameInput").value.trim().replace(/\\s+/g," ").replace(/[<>\\u0000-\\u001f]/g,"").slice(0,24);
  const status=$p("portalUsernameStatus");
  if(!entered){status.textContent="Please enter a username to continue.";status.className="portal-status error";return;}
  username=entered;
  try{localStorage.setItem(USERNAME_KEY,username);}catch(error){}
  updateUsernameDisplay();
  syncPresence();
  beginPresence();
  $p("portalUsernameModal").classList.remove("open");
 });
 function showAccessPrompt(){
  if(siteAccessGranted){
   if(!username)showUsernamePrompt();else {updateUsernameDisplay();beginPresence();}
   return;
  }
  $p("portalAccessPassword").value="";
  $p("portalAccessStatus").textContent="";
  $p("portalAccessStatus").className="portal-status";
  $p("portalAccessModal").classList.add("open");
  setTimeout(()=>$p("portalAccessPassword").focus(),30);
 }
 $p("portalAccessForm").addEventListener("submit",event=>{
  event.preventDefault();
  const entered=$p("portalAccessPassword").value;
  const status=$p("portalAccessStatus");
  if(entered!==ACCESS_PASSWORD){
   status.textContent="That password is not correct. Please try again.";
   status.className="portal-status error";
   $p("portalAccessPassword").value="";
   $p("portalAccessPassword").focus();
   return;
  }
  siteAccessGranted=true;
  try{sessionStorage.setItem(ACCESS_SESSION_KEY,"1");}catch(error){}
  $p("portalAccessModal").classList.remove("open");
  $p("portalAccessPassword").value="";
  if(!username)showUsernamePrompt();else {updateUsernameDisplay();beginPresence();}
 });
 if(siteAccessGranted){if(!username)showUsernamePrompt();else updateUsernameDisplay();}
 else showAccessPrompt();
 const games=[];
 const sourceCards=[...document.querySelectorAll("main .grid > .card")];
 const coverPhotoById=photos;
 const gameTitles=Object.keys(gameIdByTitle);
 for(const source of sourceCards){
  const title=(source.querySelector("h2")?.textContent||"").trim();
  if(!title)continue;
  const id=gameIdByTitle[title]||"";
  const rawOnclick=(source.querySelector(".play-card button")?.getAttribute("onclick")||"");
  const external=rawOnclick.includes("openExternal(")||rawOnclick.includes("openPasswordProtectedGame(");
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
 const categoryOrder=["Racing","Sports","Simulation","Arcade","Puzzle","Work","External Games"];
 function cardMarkup(game){
  const photo=coverPhotoById[game.id]||"";
  return '<article class="portal-game-card" role="button" tabindex="0" data-game-card="'+esc(game.id)+'" style="--game-accent:'+esc(game.accent)+';--game-photo:'+(photo?'url(&quot;'+esc(photo)+'&quot;)':'none')+'" data-photo="'+(photo?"yes":"none")+'">'+
   '<div class="portal-game-cover"><span class="portal-cover-badge">'+esc(game.genre)+'</span><div class="portal-cover-art">'+game.art+'</div></div>'+
   '<div class="portal-game-info"><div class="portal-game-name">'+esc(game.title)+'</div><div class="portal-game-meta"><span class="genre">'+esc(game.genre)+'</span><span>·</span><span>'+(game.external?"External game":"In library")+'</span><span class="portal-card-arrow" style="margin-left:auto">↗</span></div></div></article>';
 }
 function renderCategories(){
  const query=($p("portalSearch").value||"").trim().toLowerCase();
  const categories=["All Games",...categoryOrder];
  const counts=Object.fromEntries(categoryOrder.map(category=>[category,games.filter(game=>game.genre===category).length]));
  const visible=categories.filter(category=>{
   if(category==="All Games")return games.some(game=>!query||(game.title+" "+game.genre).toLowerCase().includes(query));
   return counts[category]>0&&(!query||category.toLowerCase().includes(query)||games.some(game=>game.genre===category&&game.title.toLowerCase().includes(query)));
  });
  $p("portalFilterRow").innerHTML=visible.map(category=>{
   const count=category==="All Games"?games.filter(game=>!query||(game.title+" "+game.genre).toLowerCase().includes(query)).length:games.filter(game=>game.genre===category&&(!query||game.title.toLowerCase().includes(query))).length;
   return '<button class="portal-category-tab" type="button" role="tab" data-category-tab="'+esc(category)+'"><span>'+esc(category)+'</span><small>'+count+' games</small><span class="portal-card-arrow">↗</span></button>';
  }).join("");
  $p("portalFilterRow").querySelectorAll("[data-category-tab]").forEach(button=>button.addEventListener("click",()=>openCategory(button.dataset.categoryTab)));
  $p("portalFilterRow").hidden=false;
  $p("portalCategoryView").hidden=true;
 }
 function showCategoryChooser(){
  selectedGenre="";
  $p("portalFilterRow").hidden=false;
  $p("portalCategoryView").hidden=true;
  renderCategories();
 }
 function openCategory(category){
  selectedGenre=category;
  $p("portalFilterRow").hidden=true;
  $p("portalCategoryView").hidden=false;
  $p("portalCategoryTitle").textContent=category;
  renderGameList();
 }
 function renderGameList(){
  if(!selectedGenre){renderCategories();return;}
  const query=($p("portalSearch").value||"").trim().toLowerCase();
  const filtered=games.filter(game=>(selectedGenre==="All Games"||game.genre===selectedGenre)&&(!query||(game.title+" "+game.genre+" "+game.description).toLowerCase().includes(query)));
  const host=$p("portalGameGroups");host.innerHTML="";
  if(!filtered.length){host.innerHTML='<div class="portal-empty">No games match that search.</div>';return;}
  if(selectedGenre==="All Games"){
   for(const category of categoryOrder){
    const items=filtered.filter(game=>game.genre===category);
    if(!items.length)continue;
    const section=document.createElement("section");section.className="portal-genre-group";
    section.innerHTML='<div class="portal-genre-head"><h2>'+esc(category)+'</h2><span>'+items.length+' games</span></div><div class="portal-game-grid">'+items.map(cardMarkup).join("")+'</div>';
    host.appendChild(section);
   }
  }else{
   host.innerHTML='<div class="portal-game-grid">'+filtered.map(cardMarkup).join("")+'</div>';
  }
 }
 function showView(view){
  document.querySelectorAll(".portal-view").forEach(el=>el.classList.toggle("active",el.dataset.page===view));
  document.querySelectorAll(".portal-nav-item[data-view]").forEach(el=>el.classList.toggle("active",el.dataset.view===view));
  const meta={games:["PLAYER LIBRARY","Games"],settings:["PERSONAL SPACE","Settings"],music:["YOUR SOUNDTRACK","Music"],profile:["PLAYER SETTINGS","Profile"],dev:["ACCESS CONTROL","Restricted"]}[view]||["PLAYSPACE","Games"];
  $p("portalPageKicker").textContent=meta[0];$p("portalPageTitle").textContent=meta[1];
  if(view==="profile")renderProfile();
  if(view==="settings")renderSettings();
  if(view==="music")mountMusicPanel();
  if(view==="dev")renderDevView();
  if(view==="games")showCategoryChooser();
 }
 document.querySelectorAll(".portal-nav-item[data-view]").forEach(el=>el.addEventListener("click",()=>showView(el.dataset.view)));
 $p("portalBackToCategories").addEventListener("click",showCategoryChooser);
 $p("portalSearch").addEventListener("input",()=>{
  if(selectedGenre)renderGameList();else renderCategories();
 });
 $p("portalCollapse").addEventListener("click",()=>{
  const collapsed=portalShell.classList.toggle("collapsed");
  portalSettings.sidebarExpanded=!collapsed;savePortalSettings();
 });
 $p("sidebarProfile").addEventListener("click",()=>showView("profile"));
 $p("portalAccountButton").addEventListener("click",()=>showView("profile"));
 $p("portalQuickSignIn").addEventListener("click",showUsernamePrompt);
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
   clone.removeAttribute("onclick");
   clone.addEventListener("click",event=>{
    event.preventDefault();
    if(!button){return;}
    setCurrentGame(game.title);
    button.click();
    closeGameDetail();
   });
   actions.appendChild(clone);
  });
  if(!game.buttons.length){
   const placeholder=document.createElement("span");placeholder.className="portal-muted";placeholder.textContent="Play option unavailable";actions.appendChild(placeholder);
  }
  $p("portalGameDetail").classList.add("open");
 }

 function closeGameDetail(){$p("portalGameDetail").classList.remove("open");}
 $p("portalDetailClose").addEventListener("click",closeGameDetail);
 $p("portalGameDetail").addEventListener("click",e=>{if(e.target===$p("portalGameDetail"))closeGameDetail();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeGameDetail();});
 function apiRequest(path,options){
  const config={method:options?.method||"GET",headers:{"Content-Type":"application/json"},cache:"no-store"};
  if(options?.body!==undefined)config.body=JSON.stringify(options.body);
  return fetch(API_BASE+path,config).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok){
    const error=new Error(data.error||("Request failed ("+response.status+")."));
    error.status=response.status;
    throw error;
   }
   return data;
  });
 }
 function syncPresence(){
  if(!username||!presenceSessionId)return;
  apiRequest("/portal/presence",{method:"POST",body:{sessionId:presenceSessionId,username,game:currentPlayingGame||"Browsing library"}}).catch(()=>{});
 }
 function setCurrentGame(title){
  currentPlayingGame=String(title||"").replace(/[<>\u0000-\u001f\u007f]/g,"").trim().slice(0,60);
  syncPresence();
 }
 function beginPresence(){
  syncPresence();
  if(presenceHeartbeat)clearInterval(presenceHeartbeat);
  presenceHeartbeat=setInterval(syncPresence,15000);
 }
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)syncPresence();});
 function renderProfile(){
  const host=$p("portalProfileContent");
  const display=username||"Not set";
  host.innerHTML='<div class="portal-section-panel"><div class="portal-profile-hero"><div class="portal-avatar">'+esc((username||"P").slice(0,1).toUpperCase())+'</div><div class="portal-eyebrow">SITE USERNAME</div><h2>'+esc(display)+'</h2><div style="margin-top:14px"><button class="portal-primary" id="profileChangeUsername">Change username</button></div></div></div>';
  $p("profileChangeUsername").addEventListener("click",showUsernamePrompt);
 }
 function formatDuration(value){
  const total=Math.max(0,Math.floor(Number(value)||0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60);
  return hours?hours+"h "+minutes+"m":minutes+"m";
 }
 function toast(message){
  const el=$p("portalToast");el.textContent=message;el.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3600);
 }

 const gameTitleByType={tennis:"Tennis Rally",hockey:"Hockey",reaction:"Reaction Game",click:"Click Test",breaker:"Neon Breaker",skydash:"Flappy Bird",snake:"Neon Snake",defender:"Space Defender",runner:"Neon Runner",memory:"Memory Match",vehicle:"Tank Arena"};
 const originalPortalOpenGame=window.openGame;
 if(typeof originalPortalOpenGame==="function"){
  window.openGame=async function(type){
   setCurrentGame(gameTitleByType[String(type)]||String(type||"Game"));
   return originalPortalOpenGame.apply(this,arguments);
  };
 }
 const originalPortalOpenStandaloneGame=window.openStandaloneGame;
 if(typeof originalPortalOpenStandaloneGame==="function"){
  window.openStandaloneGame=function(file,title){
   setCurrentGame(title||"Game");
   return originalPortalOpenStandaloneGame.apply(this,arguments);
  };
 }
 const originalPortalCloseGame=window.closeGame;
 if(typeof originalPortalCloseGame==="function"){
  window.closeGame=async function(){
   try{return await originalPortalCloseGame.apply(this,arguments);}
   finally{setCurrentGame("");}
  };
 }
 const originalPortalCloseStandaloneGame=window.closeStandaloneGame;
 if(typeof originalPortalCloseStandaloneGame==="function"){
  window.closeStandaloneGame=function(){
   const result=originalPortalCloseStandaloneGame.apply(this,arguments);
   setCurrentGame("");
   return result;
  };
 }
 const originalEnterGameFS=window.enterGameFS;
 if(typeof originalEnterGameFS==="function"){
  window.enterGameFS=async function(){
   if(!portalSettings.openGameFullscreen)return;
   return originalEnterGameFS.apply(this,arguments);
  };
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
 const settingDefaults={theme:"playstation",columns:4,cardSize:"normal",motion:true,backgroundGlow:true,hoverEffects:true,sound:true,soundVolume:70,musicEnabled:true,musicVolume:48,autoMusic:false,sidebarExpanded:true,compactDetails:false,reduceTransparency:false,rememberSearch:true,openGameFullscreen:true,confirmExternal:true};
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
  document.body.classList.toggle("portal-hover-off",!portalSettings.hoverEffects);
  document.body.classList.toggle("portal-solid-panels",!!portalSettings.reduceTransparency);
  if(typeof siteSettings!=="undefined"){
   siteSettings.sfx=!!portalSettings.sound;
   siteSettings.sfxVolume=Math.max(0,Math.min(1,Number(portalSettings.soundVolume)/100));
   siteSettings.music=!!portalSettings.musicEnabled;
   siteSettings.musicVolume=Math.max(0,Math.min(1,Number(portalSettings.musicVolume)/100));
   if(typeof applySiteSettings==="function")applySiteSettings();
   if(typeof syncThemeMusic==="function")syncThemeMusic();
  }
  if($p("portalSearch"))$p("portalSearch").placeholder=portalSettings.rememberSearch?"Search games...":"Search this visit...";
 }
 function renderSettings(){
  const host=$p("portalSettingsContent");
  const swatches=themeDefs.map(t=>'<button class="portal-theme-swatch '+(portalSettings.theme===t[0]?"active":"")+'" data-theme-choice="'+t[0]+'"><div class="portal-theme-preview" style="--swatch-a:'+t[2]+';--swatch-b:'+t[3]+';--swatch-c:'+t[4]+'"></div><b>'+t[1]+'</b></button>').join("");
  host.innerHTML='<div class="portal-section-panel"><h2>Choose your theme</h2><p>Console-inspired looks, soft colours and high-contrast arcade styles.</p><div class="portal-theme-grid">'+swatches+'</div></div>'+
   '<div class="portal-settings-grid">'+
    '<section class="portal-setting-group"><h3>Layout and navigation</h3>'+settingSelect("columns","Games per row",[[2,"2 columns"],[3,"3 columns"],[4,"4 columns"],[5,"5 columns"],[6,"6 columns"]],portalSettings.columns)+settingSelect("cardSize","Card shape", [["compact","Compact"],["normal","Rounded"],["round","Extra rounded"],["square","Square"]],portalSettings.cardSize)+settingCheck("sidebarExpanded","Keep sidebar expanded",portalSettings.sidebarExpanded)+settingCheck("rememberSearch","Remember search text",portalSettings.rememberSearch)+'</section>'+
    '<section class="portal-setting-group"><h3>Motion and appearance</h3>'+settingCheck("motion","Smooth animations",portalSettings.motion)+settingCheck("backgroundGlow","Animated ambient glow",portalSettings.backgroundGlow)+settingCheck("hoverEffects","Animated game-card hover",portalSettings.hoverEffects)+settingCheck("reduceTransparency","Use stronger solid panels",portalSettings.reduceTransparency)+settingCheck("compactDetails","Compact game detail screen",portalSettings.compactDetails)+'</section>'+
    '<section class="portal-setting-group"><h3>Sound and music</h3>'+settingCheck("sound","Interface sound effects",portalSettings.sound)+settingRange("soundVolume","Sound volume",portalSettings.soundVolume,0,100)+settingCheck("musicEnabled","Music player enabled",portalSettings.musicEnabled)+settingRange("musicVolume","Music volume",portalSettings.musicVolume,0,100)+settingCheck("autoMusic","Start music when opening library",portalSettings.autoMusic)+'</section>'+
    '<section class="portal-setting-group"><h3>Game launch and privacy</h3>'+settingCheck("openGameFullscreen","Open supported games in fullscreen",portalSettings.openGameFullscreen)+settingCheck("confirmExternal","Confirm external game links",portalSettings.confirmExternal)+'</section>'+
   '</div><div class="portal-settings-actions" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="portal-secondary" id="portalResetSettings">Reset settings</button><button class="portal-primary" id="portalSaveSettings">Save settings</button></div><div class="portal-status" id="portalSettingsStatus"></div>';
  host.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{
   portalSettings.theme=button.dataset.themeChoice;applyPortalSettings();savePortalSettings();playThemeIntro();renderSettings();
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
 async function warmDevServer(){
  if(devServerWarm&&Date.now()-devServerWarmAt<10*60*1000)return true;
  devServerWarm=false;
  if(devServerWarmup)return devServerWarmup;
  devServerWarmup=(async()=>{
   const deadline=Date.now()+75000;
   while(Date.now()<deadline){
    try{
     const response=await fetch(API_BASE+"/health",{method:"GET",cache:"no-store"});
     if(response.ok){
      const result=await response.json().catch(()=>null);
      if(result&&result.ok){devServerWarm=true;devServerWarmAt=Date.now();return true;}
     }
    }catch(error){}
    await new Promise(resolve=>setTimeout(resolve,2200));
   }
   return false;
  })().finally(()=>{devServerWarmup=null;});
  return devServerWarmup;
 }
 function renderDevView(){
  if(devPasswordInMemory)refreshDevMetrics();
  else{
   $p("portalDevMetrics").classList.remove("open");
   warmDevServer();
  }
 }
 $p("portalDevForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const input=$p("portalDevPassword"),status=$p("portalDevStatus"),entered=input.value;
  if(!entered)return;
  status.textContent="Connecting…";status.className="portal-status";
  const ready=devServerWarm?true:await warmDevServer();
  if(!ready){
   status.textContent="Connection unavailable. Please try again.";
   status.className="portal-status error";
   return;
  }
  status.textContent="Checking…";
  try{
   const metrics=await apiRequest("/portal/admin/metrics",{method:"POST",body:{password:entered}});
   devPasswordInMemory=entered;input.value="";status.textContent="";
   $p("portalDevGate").style.display="none";renderDevMetrics(metrics);
   if(devRefreshTimer)clearInterval(devRefreshTimer);
   devRefreshTimer=setInterval(refreshDevMetrics,15000);
  }catch(error){
   status.textContent=error.status===401?"Access denied.":error.status===429?"Too many attempts. Try again later.":"Connection unavailable. Please try again.";
   status.className="portal-status error";
  }
 });
 async function refreshDevMetrics(){
  if(!devPasswordInMemory)return;
  try{
   const metrics=await apiRequest("/portal/admin/metrics",{method:"POST",body:{password:devPasswordInMemory}});
   renderDevMetrics(metrics);
  }catch(error){
   if(error.status!==401&&error.status!==429)devServerWarm=false;
   if(devRefreshTimer)clearInterval(devRefreshTimer);devRefreshTimer=null;devPasswordInMemory="";
   $p("portalDevGate").style.display="block";$p("portalDevMetrics").classList.remove("open");
   $p("portalDevStatus").textContent=error.status===401?"Access denied.":"Connection lost. Please unlock again.";
   $p("portalDevStatus").className="portal-status error";
  }
 }
 function renderDevMetrics(data){
  const host=$p("portalDevMetrics");host.classList.add("open");
  const players=Array.isArray(data.players)?data.players:[];
  const rows=players.length?players.map(player=>'<tr><td>'+esc(player.name)+'</td><td>'+esc(player.game)+'</td></tr>').join(""):'<tr><td colspan="2" class="portal-muted">No one is online right now.</td></tr>';
  host.innerHTML='<div class="portal-section-panel"><div class="portal-eyebrow">LIVE ACTIVITY</div><h2 style="margin-top:5px">Who&#39;s online</h2><table class="portal-table"><thead><tr><th>Username</th><th>Playing</th></tr></thead><tbody>'+rows+'</tbody></table><div class="portal-muted" style="font-size:8px;margin-top:10px">Updated '+new Date(data.updatedAt||Date.now()).toLocaleTimeString()+'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="portal-secondary" id="portalDevRefresh">Refresh now</button><button class="portal-secondary" id="portalDevLock">Lock Dev Mode</button></div></div>';
  $p("portalDevRefresh").addEventListener("click",refreshDevMetrics);
  $p("portalDevLock").addEventListener("click",()=>{
   if(devRefreshTimer)clearInterval(devRefreshTimer);devRefreshTimer=null;devPasswordInMemory="";
   $p("portalDevMetrics").classList.remove("open");$p("portalDevGate").style.display="block";
   $p("portalDevPassword").value="";$p("portalDevStatus").textContent="Dev Mode locked.";
  });
 }

 let arcadeAudioContext=null,themeMusicTimer=null,themeMusicStep=0;
 const themeSoundProfiles={
 playstation:{notes:[440,660,880],wave:"triangle",scale:[220,330,440,660,523,392,494,587]},
 xbox:{notes:[523,784,1047],wave:"sine",scale:[196,247,294,392,330,294,247,220]},
 steam:{notes:[330,494,660],wave:"square",scale:[147,196,247,294,330,247,196,165]},
 neon:{notes:[659,880,1175],wave:"sawtooth",scale:[220,277,330,440,392,330,277,247]},
 aurora:{notes:[392,523,784],wave:"sine",scale:[174,220,261,349,311,261,220,196]},
 sunset:{notes:[349,440,587],wave:"triangle",scale:[175,220,262,330,294,262,220,196]},
 retro:{notes:[262,392,523],wave:"square",scale:[131,165,196,262,220,196,165,147]},
 light:{notes:[523,659,784],wave:"sine",scale:[262,330,392,523,440,392,330,294]},
 forest:{notes:[294,392,587],wave:"sine",scale:[147,185,220,294,262,220,185,165]},
 crimson:{notes:[392,494,740],wave:"triangle",scale:[196,247,294,370,330,294,247,220]},
 ocean:{notes:[330,440,660],wave:"sine",scale:[165,220,262,330,294,262,220,196]},
 graphite:{notes:[220,330,440],wave:"triangle",scale:[110,147,165,220,196,165,147,131]}
 };
 function getArcadeAudio(){if(!arcadeAudioContext)arcadeAudioContext=new(window.AudioContext||window.webkitAudioContext)();if(arcadeAudioContext.state==="suspended")arcadeAudioContext.resume();return arcadeAudioContext;}
 function arcadeTone(freq,duration,wave,gain,volume){try{const ac=getArcadeAudio(),o=ac.createOscillator(),g=ac.createGain();o.type=wave||"sine";o.frequency.setValueAtTime(freq,ac.currentTime);g.gain.setValueAtTime(Math.max(.0001,gain*volume),ac.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+duration);}catch(e){}}
 function playThemeIntro(){if(!portalSettings.sound)return;const p=themeSoundProfiles[portalSettings.theme]||themeSoundProfiles.playstation,v=Math.max(0,Math.min(1,Number(portalSettings.soundVolume)/100));p.notes.forEach((note,i)=>setTimeout(()=>arcadeTone(note,.14,p.wave,.035,v),i*95));}
 function syncThemeMusic(){if(themeMusicTimer){clearInterval(themeMusicTimer);themeMusicTimer=null;}if(!portalSettings.musicEnabled||!portalSettings.autoMusic)return;const p=themeSoundProfiles[portalSettings.theme]||themeSoundProfiles.playstation;themeMusicStep=0;themeMusicTimer=setInterval(()=>{if(document.hidden)return;const v=Math.max(0,Math.min(1,Number(portalSettings.musicVolume)/100)),f=p.scale[themeMusicStep%p.scale.length];arcadeTone(f,.36,"sine",.013,v);if(themeMusicStep%4===0)arcadeTone(f*2,.20,"triangle",.008,v);themeMusicStep++;},430);}
 document.addEventListener("click",event=>{if(!event.target.closest("#arcadeRoot"))return;const target=event.target.closest("button,.portal-game-card,.portal-category-tab");if(!target||!portalSettings.sound)return;const p=themeSoundProfiles[portalSettings.theme]||themeSoundProfiles.playstation;arcadeTone(p.notes[0],.055,p.wave,.018,Math.max(0,Math.min(1,Number(portalSettings.soundVolume)/100)));},true);

 applyPortalSettings();
 renderProfile();
 updateUsernameDisplay();
 if(siteAccessGranted&&username)beginPresence();
 showView("games");
})();
