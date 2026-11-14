
(() => {
 "use strict";
 const API_BASE="https://hockey-multiplayer.onrender.com";
 const USERNAME_KEY="playspaceUsername";
 const app=document.getElementById("arcadeRoot");
 if(!app)return;
 let username="",accountToken="",accountData=null,authMode="login",activeGameSessions={},activeGameScores={},currentTrackedGameId="",weeklyData=null,selectedGenre="",selectedGame=null,devPasswordInMemory="",devRefreshTimer=null,devServerWarmup=null,devServerWarm=false,devServerWarmAt=0,currentPlayingGame="",presenceHeartbeat=null,presenceSessionId="";
 const gameIdByTitle={
  "Drift Arena":"drift-arena","Open World Drive":"open-world-drive","Tank Arena":"tank-arena-3d",
  "F1 Simulator":"f1-simulator",
  "APEX Formula Racing":"apex-formula-racing","Gravel Rally Stage":"gravel-rally-stage",
  "FPV Drone Simulator":"fpv-drone-simulator",
  "8 Ball Pool":"pool-8-ball","Tennis Rally":"tennis-rally","Hockey":"hockey",
  "Reaction Game":"reaction-game","Click Test":"click-test","Neon Breaker":"neon-breaker",
  "Flappy Bird":"flappy-bird","Neon Snake":"neon-snake","Space Defender":"space-defender",
  "Memory Match":"memory-match","Moto X3M":"moto-x3m",
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
  if(title==="F1 Simulator")return "Racing";
  if(["Drift Arena","Open World Drive","APEX Formula Racing","Gravel Rally Stage","F1 Simulator"].includes(title))return "Racing";
  if(["Tennis Rally","Hockey","8 Ball Pool","Mini Golf 3D"].includes(title))return "Sports";
  if(["Tank Arena","FPV Drone Simulator","Cube Engine"].includes(title))return "Simulation";
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
    '<button class="portal-nav-item" data-view="friends"><span class="portal-nav-icon">♧</span><span class="portal-nav-label-text">Friends</span><span class="portal-nav-count" id="friendCountBadge">0</span></button>',
    '<div class="portal-nav-label">TOOLS</div>',
    '<button class="portal-nav-item" data-view="dev"><span class="portal-nav-icon">▣</span><span class="portal-nav-label-text">Restricted</span><span class="portal-nav-count">LOCKED</span></button>',
   '</nav>',
   '<div class="portal-sidebar-foot"><button class="portal-profile-chip" id="sidebarProfile"><span class="portal-avatar" id="sidebarAvatar">?</span><span class="portal-profile-copy"><b id="sidebarName">Player</b><small id="sidebarStatus">Your username</small></span><span aria-hidden="true">›</span></button></div>',
  '</aside>',
  '<section class="portal-content">',
   '<header class="portal-topbar"><div><div class="portal-page-kicker" id="portalPageKicker">PLAYER LIBRARY</div><div class="portal-page-title" id="portalPageTitle">Games</div></div>',
    '<label class="portal-search"><span>⌕</span><input id="portalSearch" type="search" placeholder="Search games..." aria-label="Search games"></label>',
    '<button class="portal-top-action" id="portalQuickSignIn">Sign in</button>',
    '<button class="portal-account-button" id="portalAccountButton"><span class="portal-avatar" id="topAvatar">?</span><span id="topAccountName">Guest</span></button>',
   '</header>',
   '<div class="portal-views" id="portalViews">',
    '<section class="portal-view active" id="portalGamesView" data-page="games">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAYSPACE LIBRARY</div><h1>Browse games</h1><p>Choose a category to explore its games.</p></div></div>',
     '<div class="portal-weekly-shelf" id="portalWeeklyShelf"><div class="portal-section-panel"><div class="portal-eyebrow">THIS WEEK</div><h2>Loading game highlights…</h2></div></div>',
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
     '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAYER</div><h1>Your profile</h1><p>Your player card, progress, trophies, career and saved game stats.</p></div></div>',
     '<div id="portalProfileContent"></div>',
    '</section>',
    '<section class="portal-view" id="portalFriendsView" data-page="friends">',
     '<div class="portal-welcome"><div><div class="portal-eyebrow">YOUR PEOPLE</div><h1>Friends</h1><p>Add players by username, accept requests and manage your friends list.</p></div></div>',
     '<div id="portalFriendsContent"></div>',
    '</section>',
    '<section class="portal-view" id="portalDevView" data-page="dev">',
     '<div class="portal-section-panel portal-dev-unlock" id="portalDevGate"><h2>Restricted</h2><form id="portalDevForm" class="portal-profile-form"><div class="portal-field"><label for="portalDevPassword">Password</label><input id="portalDevPassword" type="password" inputmode="numeric" autocomplete="off" maxlength="64" required></div><button class="portal-primary" type="submit">Unlock</button><div class="portal-status" id="portalDevStatus" aria-live="polite"></div></form></div>',
     '<div class="portal-dev-metrics" id="portalDevMetrics"></div>',
    '</section>',
   '</div>',
  '</section>',
 '</div>',
 '<div class="portal-detail-backdrop" id="portalGameDetail" role="dialog" aria-modal="true" aria-label="Game details"><article class="portal-detail-card"><div class="portal-detail-cover" id="portalDetailCover"><button class="portal-modal-close" type="button" id="portalDetailClose" aria-label="Close">✕</button><div class="portal-cover-art" id="portalDetailArt"></div></div><div class="portal-detail-body"><div class="portal-detail-heading"><div><div class="portal-eyebrow" id="portalDetailGenre"></div><h2 id="portalDetailTitle">Game title</h2><p id="portalDetailDescription"></p></div></div><div class="portal-detail-actions" id="portalDetailPlay"></div><div class="portal-vote-row" id="portalDetailSocial"></div><div id="portalDetailProgress"></div></div></article></div>',
 '<div class="portal-toast" id="portalToast" role="status" aria-live="polite"></div>'
 ].join("");
 app.innerHTML=portalMarkup;
 const portalShell=document.getElementById("portalShell");
 const $p=id=>document.getElementById(id);
 function setSiteAccessLock(locked){
  portalShell.inert=locked;
  for(const node of document.body.children)if(node!==app)node.inert=locked;
  document.body.style.overflow=locked?"hidden":"";
 }
 const ACCESS_SESSION_KEY="playspaceSiteAccess";
 const ACCESS_PASSWORD="710";
 let siteAccessGranted=false;
 try{siteAccessGranted=sessionStorage.getItem(ACCESS_SESSION_KEY)==="1";}catch(error){}
 try{username=(localStorage.getItem(USERNAME_KEY)||"").trim().slice(0,20);accountToken=sessionStorage.getItem("playspaceAccountToken")||"";}catch(error){}
 const presenceSessionKey="playspacePresenceSession";
 try{
  presenceSessionId=sessionStorage.getItem(presenceSessionKey)||"";
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(presenceSessionId)){
   presenceSessionId=(window.crypto&&typeof window.crypto.randomUUID==="function")?window.crypto.randomUUID():("ps-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2));
   sessionStorage.setItem(presenceSessionKey,presenceSessionId);
  }
 }catch(error){presenceSessionId="ps-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);}
 app.insertAdjacentHTML("beforeend",'<div class="portal-auth-backdrop portal-access-gate" id="portalAccessModal" role="dialog" aria-modal="true" aria-label="Enter site password"><section class="portal-auth-card"><div class="portal-auth-head"><div class="portal-brand-mark">P</div><div><h2>Welcome to PlaySpace</h2><p>Enter the site password to continue.</p></div></div><form class="portal-auth-form" id="portalAccessForm"><div class="portal-field"><label for="portalAccessPassword">Site password</label><input id="portalAccessPassword" type="password" inputmode="numeric" maxlength="3" autocomplete="off" required placeholder="Enter password"></div><button class="portal-primary" type="submit">Continue</button><div class="portal-status" id="portalAccessStatus" aria-live="polite"></div></form></section></div>');
 app.insertAdjacentHTML("beforeend",'<div class="portal-auth-backdrop" id="portalAuthModal" role="dialog" aria-modal="true" aria-label="Player sign in"><section class="portal-auth-card"><div class="portal-auth-head"><div class="portal-brand-mark">P</div><div><h2>Welcome to PlaySpace</h2><p>Create a player profile or sign in to sync your progress.</p></div></div><div class="portal-auth-tabs"><button type="button" class="active" data-auth-mode="login">SIGN IN</button><button type="button" data-auth-mode="register">CREATE PROFILE</button></div><form class="portal-auth-form" id="portalAuthForm"><div class="portal-field"><label for="portalAuthUsername">Username</label><input id="portalAuthUsername" type="text" maxlength="20" autocomplete="username" minlength="3" required placeholder="3–20 letters, numbers or underscores"></div><div class="portal-field"><label for="portalAuthPassword">Password</label><input id="portalAuthPassword" type="password" maxlength="128" autocomplete="current-password" minlength="8" required placeholder="At least 8 characters"></div><div class="portal-field" id="portalAuthAvatarField" hidden><label for="portalAuthAvatar">Choose an avatar</label><select id="portalAuthAvatar" class="portal-control"><option value="0">🏎️ Racing</option><option value="1">🎮 Gamer</option><option value="2">🏁 Speed</option><option value="3">🐱 Cat</option><option value="4">🐼 Panda</option><option value="5">🦊 Fox</option><option value="6">🐸 Frog</option><option value="7">🐯 Tiger</option><option value="8">🦄 Unicorn</option><option value="9">🤖 Robot</option><option value="10">👾 Alien</option><option value="11">🦈 Shark</option><option value="12">🐲 Dragon</option><option value="13">⭐ Star</option></select></div><button class="portal-primary" id="portalAuthSubmit" type="submit">SIGN IN</button><div class="portal-status" id="portalAuthStatus" aria-live="polite"></div></form><div class="portal-auth-foot">Passwords are protected by the site server. Do not reuse a password from another account.</div><button class="portal-secondary" id="portalGuestContinue" type="button" style="width:100%;margin-top:10px">Continue as guest</button></section></div>');
 const AVATAR_EMOJI=["🏎️","🎮","🏁","🐱","🐼","🦊","🐸","🐯","🦄","🤖","👾","🦈","🐲","⭐"];
 function currentAvatar(){const skin=Number(accountData?.profile?.avatar??accountData?.profile?.skin)||0;return AVATAR_EMOJI[Math.max(0,Math.min(13,skin))];}
 function updateUsernameDisplay(){
  const name=username||"Guest",initial=currentAvatar();
  $p("sidebarName").textContent=name;$p("sidebarStatus").textContent=accountData?"Level "+(accountData.profile?.level||1):"Guest player";
  $p("sidebarAvatar").textContent=initial;$p("topAvatar").textContent=initial;$p("topAccountName").textContent=name;
  $p("portalQuickSignIn").textContent=accountData?"Account":"Sign in";
  $p("friendCountBadge").textContent=String(accountData?.profile?.friendCount||0);
 }
 function setAccountMode(mode){
  authMode=mode==="register"?"register":"login";
  $p("portalAuthModal").querySelectorAll("[data-auth-mode]").forEach(button=>button.classList.toggle("active",button.dataset.authMode===authMode));
  $p("portalAuthSubmit").textContent=authMode==="register"?"CREATE PROFILE":"SIGN IN";
  $p("portalAuthAvatarField").hidden=authMode!=="register";
  $p("portalAuthPassword").autocomplete=authMode==="register"?"new-password":"current-password";
  $p("portalAuthStatus").textContent="";
  $p("portalAuthStatus").className="portal-status";
 }
 function showAccountPrompt(mode="login"){
  $p("portalAuthUsername").value=username||"";
  $p("portalAuthPassword").value="";
  setAccountMode(mode);
  $p("portalAuthModal").classList.add("open");
  setTimeout(()=>$p("portalAuthUsername").focus(),30);
 }
 function acceptAccount(data){
  accountToken=data.token||accountToken;accountData=data;
  try{if(accountToken)sessionStorage.setItem("playspaceAccountToken",accountToken);localStorage.setItem(USERNAME_KEY,data.profile.username||data.profile.name);}catch(error){}
  username=data.profile.username||data.profile.name||"Player";
  updateUsernameDisplay();$p("portalAuthModal").classList.remove("open");
  beginPresence();loadFriends().catch(()=>{});loadWeeklyHighlights().catch(()=>{});
  if(selectedGenre==="Favorites")renderGameList();
  if(document.querySelector("#portalProfileView.active"))renderProfile();
 }
 async function submitAccountAuth(event){
  event.preventDefault();
  const entered=$p("portalAuthUsername").value.trim(),password=$p("portalAuthPassword").value;
  const status=$p("portalAuthStatus");
  if(!/^[A-Za-z0-9_]{3,20}$/.test(entered)){status.textContent="Use 3–20 letters, numbers or underscores for your username.";status.className="portal-status error";return;}
  if(password.length<8||password.length>128){status.textContent="Use a password between 8 and 128 characters.";status.className="portal-status error";return;}
  status.textContent=authMode==="register"?"Creating your profile…":"Signing in…";status.className="portal-status";
  try{
   const data=await apiRequest(authMode==="register"?"/account/register":"/account/login",{method:"POST",body:{username:entered,password,avatar:Number($p("portalAuthAvatar").value)||0}});
   acceptAccount(data);toast(authMode==="register"?"Player profile created.":"Welcome back, "+username+".");
  }catch(error){
   status.textContent=error.status===503?error.message:(error.message||"Could not sign in. Please try again.");
   status.className="portal-status error";
  }
 }
 $p("portalAuthForm").addEventListener("submit",submitAccountAuth);
 $p("portalAuthModal").querySelectorAll("[data-auth-mode]").forEach(button=>button.addEventListener("click",()=>setAccountMode(button.dataset.authMode)));
 $p("portalGuestContinue").addEventListener("click",()=>{
  $p("portalAuthModal").classList.remove("open");
  if(!username)username="Guest";updateUsernameDisplay();beginPresence();
 });
 async function continueAfterSiteAccess(){
  setSiteAccessLock(false);
  if(accountToken){
   try{const data=await apiRequest("/account/me");acceptAccount({...data,token:accountToken});return;}
   catch(error){if(error.status===401){accountToken="";accountData=null;try{sessionStorage.removeItem("playspaceAccountToken");}catch(_){}}}
  }
  showAccountPrompt("login");
 }
 function showAccessPrompt(){
  if(siteAccessGranted){continueAfterSiteAccess();return;}
  setSiteAccessLock(true);
  $p("portalAccessPassword").value="";$p("portalAccessStatus").textContent="";$p("portalAccessStatus").className="portal-status";
  $p("portalAccessModal").classList.add("open");setTimeout(()=>$p("portalAccessPassword").focus(),30);
 }
 $p("portalAccessForm").addEventListener("submit",event=>{
  event.preventDefault();const entered=$p("portalAccessPassword").value,status=$p("portalAccessStatus");
  if(entered!==ACCESS_PASSWORD){status.textContent="That password is not correct. Please try again.";status.className="portal-status error";$p("portalAccessPassword").value="";$p("portalAccessPassword").focus();return;}
  siteAccessGranted=true;try{sessionStorage.setItem(ACCESS_SESSION_KEY,"1");}catch(error){}
  $p("portalAccessModal").classList.remove("open");$p("portalAccessPassword").value="";continueAfterSiteAccess();
 });
 if(siteAccessGranted)continueAfterSiteAccess();else showAccessPrompt();
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
 const categoryOrder=["Racing","Sports","Simulation","Arcade","Puzzle","External Games"];
 function cardMarkup(game){
  const photo=coverPhotoById[game.id]||"";
  return '<article class="portal-game-card" role="button" tabindex="0" data-game-card="'+esc(game.id)+'" style="--game-accent:'+esc(game.accent)+';--game-photo:'+(photo?'url(&quot;'+esc(photo)+'&quot;)':'none')+'" data-photo="'+(photo?"yes":"none")+'">'+
   '<div class="portal-game-cover"><span class="portal-cover-badge">'+esc(game.genre)+'</span><div class="portal-cover-art">'+game.art+'</div></div>'+
   '<div class="portal-game-info"><div class="portal-game-name">'+esc(game.title)+'</div><div class="portal-game-meta"><span class="genre">'+esc(game.genre)+'</span><span>·</span><span>'+(game.external?"External game":"In library")+'</span><span class="portal-card-arrow" style="margin-left:auto">↗</span></div></div></article>';
 }
 function renderCategories(){
  const query=($p("portalSearch").value||"").trim().toLowerCase();
  const favoriteIds=accountData?.profile?.favoriteGames||[];
  const categories=["All Games","Favorites",...categoryOrder];
  const counts=Object.fromEntries(categoryOrder.map(category=>[category,games.filter(game=>game.genre===category).length]));
  const visible=categories.filter(category=>{
   if(category==="All Games")return games.some(game=>!query||(game.title+" "+game.genre).toLowerCase().includes(query));
   if(category==="Favorites")return favoriteIds.some(id=>games.some(game=>game.id===id&&(!query||game.title.toLowerCase().includes(query))));
   return counts[category]>0&&(!query||category.toLowerCase().includes(query)||games.some(game=>game.genre===category&&game.title.toLowerCase().includes(query)));
  });
  $p("portalFilterRow").innerHTML=visible.map(category=>{
   const count=category==="All Games"?games.filter(game=>!query||(game.title+" "+game.genre).toLowerCase().includes(query)).length:category==="Favorites"?favoriteIds.length:games.filter(game=>game.genre===category&&(!query||game.title.toLowerCase().includes(query))).length;
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
  const favoriteIds=accountData?.profile?.favoriteGames||[];
  const filtered=games.filter(game=>(selectedGenre==="All Games"?true:selectedGenre==="Favorites"?favoriteIds.includes(game.id):game.genre===selectedGenre)&&(!query||(game.title+" "+game.genre+" "+game.description).toLowerCase().includes(query)));
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
  const meta={games:["PLAYER LIBRARY","Games"],settings:["PERSONAL SPACE","Settings"],music:["YOUR SOUNDTRACK","Music"],profile:["PLAYER SETTINGS","Profile"],friends:["YOUR PEOPLE","Friends"],dev:["ACCESS CONTROL","Restricted"]}[view]||["PLAYSPACE","Games"];
  $p("portalPageKicker").textContent=meta[0];$p("portalPageTitle").textContent=meta[1];
  if(view==="profile")renderProfile();
  if(view==="friends")renderFriends();
  if(view==="settings")renderSettings();
  if(view==="music")mountMusicPanel();
  if(view==="dev")renderDevView();
  if(view==="games"){showCategoryChooser();loadWeeklyHighlights();}
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
 $p("portalQuickSignIn").addEventListener("click",()=>accountData?showView("profile"):showAccountPrompt("login"));
 $p("portalAccountButton").addEventListener("click",()=>accountData?showView("profile"):showAccountPrompt("login"));
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
  renderGameSocial(game);
  $p("portalGameDetail").classList.add("open");
 }

 function renderGameSocial(game){
  const liked=(accountData?.likedGames||[]).includes(game.id),favorite=(accountData?.profile?.favoriteGames||[]).includes(game.id),likes=Number(weeklyData?.likes?.[game.id]||0);
  const progress=careerProgressFor(game,accountData?.career?.[game.id],accountData?.stats?.games?.[game.id]);
  $p("portalDetailSocial").innerHTML='<button type="button" id="portalLikeGame">'+(liked?"♥ Liked":"♡ Like")+' · '+likes+'</button><button type="button" id="portalFavoriteGame">'+(favorite?"★ Favorited":"☆ Favorite")+'</button>';
  const statsPanel=accountData?'<div class="portal-detail-stats"><div class="portal-detail-stat"><small>Sessions played</small><b>'+esc(accountData.stats?.games?.[game.id]?.played||0)+'</b></div><div class="portal-detail-stat"><small>Personal best</small><b>'+esc(accountData.stats?.games?.[game.id]?.bestScore||0)+'</b></div><div class="portal-detail-stat"><small>Career chapter</small><b>'+progress.chapter+'/6</b></div></div>':'<p class="portal-auth-foot">Sign in to save favourites, likes and game progress.</p>';
  const careerName=accountData?progress.rank:"Sign in to track your career";
  const careerMessage=!accountData?"Create a profile to save career ranks and session progress.":progress.complete?"You have completed every career rank for this game.":progress.remaining+" more session"+(progress.remaining===1?"":"s")+" to reach "+progress.nextRank+".";
  const careerAction=accountData?(progress.sessions?"CONTINUE PLAYING":"PLAY TO PROGRESS"):"SIGN IN TO SAVE PROGRESS";
  $p("portalDetailProgress").innerHTML=statsPanel+'<section class="portal-career-panel"><div class="portal-career-panel-head"><div><div class="portal-eyebrow">CAREER TRACK</div><strong>'+esc(careerName)+'</strong></div><span>'+(accountData?"RANK "+(progress.stage+1)+" / 6":"PROFILE REQUIRED")+'</span></div><div class="portal-xp-track"><span style="width:'+(accountData?progress.percent:0)+'%"></span></div><p>'+esc(careerMessage)+'</p><button type="button" class="portal-career-launch" id="portalCareerLaunch">'+careerAction+'</button></section>';
  $p("portalLikeGame").addEventListener("click",()=>toggleGameLike(game));$p("portalFavoriteGame").addEventListener("click",()=>toggleGameFavorite(game));
  $p("portalCareerLaunch").addEventListener("click",()=>{
   if(!accountData){showAccountPrompt("login");return;}
   const launch=game.buttons?.[0];
   if(!launch){toast("A career start is not available for this game.");return;}
   setCurrentGame(game.title);launch.click();closeGameDetail();
  });
 }
 async function toggleGameLike(game){
  if(!accountData){showAccountPrompt("login");return;}
  try{const result=await apiRequest("/account/games/"+encodeURIComponent(game.id)+"/like",{method:"POST",body:{}});const liked=new Set(accountData.likedGames||[]);if(result.liked)liked.add(game.id);else liked.delete(game.id);accountData.likedGames=[...liked];if(weeklyData){weeklyData.likes[game.id]=result.likes;renderWeeklyHighlights();}renderGameSocial(game);toast(result.liked?"Game liked.":"Like removed.");}
  catch(error){toast(error.message||"Could not save your like.");}
 }
 async function toggleGameFavorite(game){
  if(!accountData){showAccountPrompt("login");return;}
  try{const result=await apiRequest("/account/favorites",{method:"POST",body:{gameId:game.id}});accountData.profile.favoriteGames=result.favoriteGames||[];renderGameSocial(game);renderCategories();toast(result.favorite?"Added to favourites.":"Removed from favourites.");}
  catch(error){toast(error.message||"Could not update favourites.");}
 }

 function closeGameDetail(){$p("portalGameDetail").classList.remove("open");}
 $p("portalDetailClose").addEventListener("click",closeGameDetail);
 $p("portalGameDetail").addEventListener("click",e=>{if(e.target===$p("portalGameDetail"))closeGameDetail();});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")closeGameDetail();});
 function apiRequest(path,options){
  const config={method:options?.method||"GET",headers:{"Content-Type":"application/json"},cache:"no-store"};
  if(accountToken)config.headers.Authorization="Bearer "+accountToken;
  if(options?.body!==undefined)config.body=JSON.stringify(options.body);
  return fetch(API_BASE+path,config).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok){const error=new Error(data.error||("Request failed ("+response.status+")."));error.status=response.status;throw error;}
   return data;
  });
 }
 async function loadWeeklyHighlights(){
  try{weeklyData=await apiRequest("/portal/games/weekly");renderWeeklyHighlights();return weeklyData;}
  catch(error){$p("portalWeeklyShelf").innerHTML='<div class="portal-section-panel"><div class="portal-eyebrow">THIS WEEK</div><h2>Weekly highlights unavailable</h2><p>Rankings will appear when the stats service is available.</p></div>';return null;}
 }
 function getGame(gameId){return games.find(game=>game.id===gameId)||null;}
 const CAREER_STEPS=[{from:0,to:1},{from:1,to:5},{from:5,to:10},{from:10,to:25},{from:25,to:50},{from:50,to:50}];
 const CAREER_RANKS={
  "Racing":["Rookie Driver","Club Racer","Semi-Pro Driver","Pro Driver","Elite Driver","Racing Legend"],
  "Sports":["Rookie","Team Player","All-Star","Pro Athlete","Elite Champion","Hall of Fame"],
  "Simulation":["Trainee","Operator","Specialist","Expert","Master","Simulation Legend"],
  "Arcade":["Newcomer","Regular Player","Challenger","Veteran","Arcade Champion","Arcade Legend"],
  "Puzzle":["Beginner","Solver","Strategist","Mastermind","Grandmaster","Puzzle Legend"],
  "Sandbox":["Explorer","Builder","Creator","Pioneer","World Maker","Sandbox Legend"],
  "External Games":["Newcomer","Regular","Skilled Player","Expert","Veteran","Legend"],
  "default":["Newcomer","Regular","Skilled Player","Expert","Veteran","Legend"]
 };
 function careerProgressFor(game,careerItem,gameStats){
  const sessions=Math.max(0,Math.floor(Math.max(Number(careerItem?.sessions)||0,Number(gameStats?.played)||0)));
  const stage=sessions>=50?5:sessions>=25?4:sessions>=10?3:sessions>=5?2:sessions>=1?1:0;
  const step=CAREER_STEPS[stage],ranks=CAREER_RANKS[game?.genre]||CAREER_RANKS.default,complete=sessions>=50;
  const percent=complete?100:Math.max(0,Math.min(100,Math.round((sessions-step.from)/Math.max(1,step.to-step.from)*100)));
  return {sessions,stage,chapter:stage+1,rank:ranks[stage]||"Newcomer",nextRank:complete?"":(ranks[stage+1]||"next rank"),nextGoal:complete?50:step.to,remaining:complete?0:Math.max(0,step.to-sessions),percent,complete};
 }
 function weeklyGameTile(label,gameId,count,emptyText){
  const game=getGame(gameId);
  return '<article class="portal-weekly-card"><small>'+esc(label)+'</small><b>'+esc(game?.title||"No results yet")+'</b><span>'+(count>0?esc(count+" recorded"):esc(emptyText))+'</span></article>';
 }
 function renderWeeklyHighlights(){
  const host=$p("portalWeeklyShelf");if(!host||!weeklyData)return;
  const featured=getGame(weeklyData.featured?.gameId),played=weeklyData.mostPlayed||{},liked=weeklyData.mostLiked||{};
  host.innerHTML='<div class="portal-weekly-head"><div><div class="portal-eyebrow">PLAYSPACE WEEKLY</div><h2>Community highlights</h2></div><span class="portal-week-tag">Week of '+esc(weeklyData.weekStartsAt||"This week")+'</span></div><div class="portal-weekly-grid">'+
   '<article class="portal-weekly-feature"><small>FEATURED GAME OF THE WEEK</small><b>'+(featured?esc(featured.title):"Coming soon")+'</b><span>'+(featured?esc(featured.genre+" · Try it this week"):"Featured games rotate weekly")+'</span>'+(featured?'<button type="button" class="portal-week-link" data-week-game="'+esc(featured.id)+'">VIEW GAME →</button>':'')+'</article>'+
   weeklyGameTile("MOST PLAYED THIS WEEK",played.gameId,played.count,"No sessions recorded yet")+weeklyGameTile("MOST LIKED THIS WEEK",liked.gameId,liked.count,"No likes recorded yet")+'</div>';
  host.querySelector("[data-week-game]")?.addEventListener("click",()=>{const game=getGame(featured.id);if(game)openGameDetail(game);});
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
  if(!accountData){host.innerHTML='<div class="portal-section-panel"><h2>Sign in to your player profile</h2><p>Your username, XP, trophies, favourites and statistics are saved to your account when persistent storage is connected.</p><button class="portal-primary" id="profileSignIn">SIGN IN / CREATE PROFILE</button></div>';$p("profileSignIn").addEventListener("click",()=>showAccountPrompt("login"));return;}
  const profile=accountData.profile||{},stats=accountData.stats||{},skin=Number(profile.avatar??profile.skin)||0,avatar=AVATAR_EMOJI[Math.max(0,Math.min(13,skin))];
  const played=Number(stats.gamesPlayed)||Object.values(stats.games||{}).reduce((sum,item)=>sum+(Number(item.played)||0),0),favorites=(profile.favoriteGames||[]).map(getGame).filter(Boolean),unlocked=accountData.achievements||[],unlockedIds=new Set(unlocked.map(item=>item.id));
  const trophyDefs=games.filter(game=>game.id).flatMap(game=>[{id:"first-"+game.id,title:"First Session",game:game.title,tier:"bronze",target:"1 session"},{id:"regular-"+game.id,title:"Regular Player",game:game.title,tier:"silver",target:"10 sessions"},{id:"dedicated-"+game.id,title:"Dedicated Player",game:game.title,tier:"gold",target:"50 sessions"},{id:"record-"+game.id,title:"Personal Best",game:game.title,tier:"silver",target:"Set a new best score"}]);
  const trophies=[...unlocked.map(item=>({...item,unlocked:true})),...trophyDefs.filter(item=>!unlockedIds.has(item.id)).map(item=>({...item,unlocked:false}))];
  const career=accountData.career||{},careerCards=games.filter(game=>game.id).map(game=>{
   const progress=careerProgressFor(game,career[game.id],stats.games?.[game.id]);
   return '<button type="button" class="portal-career-card" data-career-open="'+esc(game.id)+'"><span class="portal-career-meta">'+esc(game.genre)+'</span><strong>'+esc(game.title)+'</strong><span class="portal-career-rank">'+esc(progress.rank)+' · Rank '+progress.chapter+'/6</span><span class="portal-xp-track"><span style="width:'+progress.percent+'%"></span></span><small>'+(progress.complete?"CAREER COMPLETE":esc(progress.sessions+' / '+progress.nextGoal+' sessions'))+'</small></button>';
  }).join("");
  host.innerHTML='<div class="portal-profile-layout"><div class="portal-profile-hero"><div class="portal-avatar">'+avatar+'</div><div class="portal-eyebrow">PLAYER PROFILE</div><h2>'+esc(profile.username||username)+'</h2><div class="portal-level-pill">LEVEL '+esc(profile.level||1)+' · '+esc(profile.xp||0)+' XP</div><div class="portal-xp-track"><span style="width:'+Math.max(0,Math.min(100,Number(profile.levelProgress)||0))+'%"></span></div><small class="portal-muted">'+esc(profile.xpIntoLevel||0)+' / '+esc(profile.xpForNextLevel||100)+' XP to next level</small><form id="portalEditProfile" class="portal-profile-form"><div class="portal-field"><label for="portalEditUsername">Username</label><input id="portalEditUsername" maxlength="20" minlength="3" pattern="[A-Za-z0-9_]{3,20}" value="'+esc(profile.username||username)+'" required></div><div class="portal-field"><label for="portalEditAvatar">Avatar</label><select id="portalEditAvatar" class="portal-control">'+AVATAR_EMOJI.map((emoji,i)=>'<option value="'+i+'" '+(i===skin?"selected":"")+'>'+emoji+' Avatar '+(i+1)+'</option>').join("")+'</select></div><button class="portal-primary" type="submit">SAVE PROFILE</button><div class="portal-status" id="portalEditStatus"></div></form><button class="portal-secondary portal-danger" id="portalSignOut" type="button">SIGN OUT</button></div>'+
   '<div><div class="portal-stat-grid"><div class="portal-stat-tile"><small>Total XP</small><strong>'+esc(profile.xp||0)+'</strong></div><div class="portal-stat-tile"><small>Games played</small><strong>'+esc(played)+'</strong></div><div class="portal-stat-tile"><small>Play time</small><strong>'+esc(formatDuration(stats.timePlayedSeconds||0))+'</strong></div><div class="portal-stat-tile"><small>Trophies</small><strong>'+unlocked.length+'</strong></div><div class="portal-stat-tile"><small>Hockey wins</small><strong>'+esc(stats.wins||0)+'</strong></div><div class="portal-stat-tile"><small>Win rate</small><strong>'+esc(stats.winRate||0)+'%</strong></div></div>'+
   '<div class="portal-section-panel" style="margin-top:14px"><div class="portal-eyebrow">FAVOURITE GAMES</div><div class="portal-chip-list">'+(favorites.length?favorites.map(game=>'<button type="button" class="portal-secondary" data-favorite-open="'+esc(game.id)+'">'+esc(game.title)+'</button>').join(""):'<span class="portal-muted">No favourites yet. Open a game and press Favorite.</span>')+'</div></div>'+
   '<div class="portal-section-panel" style="margin-top:14px"><div class="portal-eyebrow">CAREER PROGRESS</div><h2>Game careers</h2>'+'<div class="portal-career-grid">'+careerCards+'</div>'+'</div></div></div>'+
   '<div class="portal-section-panel" style="margin-top:15px"><div class="portal-eyebrow">TROPHY CABINET</div><h2>'+unlocked.length+' trophies unlocked</h2><div class="portal-trophy-grid">'+trophies.map(item=>'<div class="portal-trophy-card '+(item.unlocked?"unlocked":"locked")+'"><span>'+({bronze:"🥉",silver:"🥈",gold:"🥇"}[item.tier]||"🏆")+'</span><b>'+esc(item.title)+'</b><small>'+esc(item.game||item.description||"PlaySpace")+'</small><em>'+(item.unlocked?"UNLOCKED":esc(item.target||"LOCKED"))+'</em></div>').join("")+'</div></div>';
  $p("portalEditProfile").addEventListener("submit",async event=>{event.preventDefault();const status=$p("portalEditStatus");status.textContent="Saving…";status.className="portal-status";try{const result=await apiRequest("/account/profile",{method:"POST",body:{username:$p("portalEditUsername").value,avatar:Number($p("portalEditAvatar").value)}});accountData={...accountData,...result};username=result.profile.username;updateUsernameDisplay();renderProfile();toast("Profile saved.");}catch(error){status.textContent=error.message||"Could not save profile.";status.className="portal-status error";}});
  $p("portalSignOut").addEventListener("click",async()=>{try{await apiRequest("/account/logout",{method:"POST",body:{}});}catch(error){}accountToken="";accountData=null;try{sessionStorage.removeItem("playspaceAccountToken");}catch(error){}username="Guest";updateUsernameDisplay();renderProfile();showAccountPrompt("login");});
  host.querySelectorAll("[data-favorite-open]").forEach(button=>button.addEventListener("click",()=>{const game=getGame(button.dataset.favoriteOpen);if(game)openGameDetail(game);}));
  host.querySelectorAll("[data-career-open]").forEach(button=>button.addEventListener("click",()=>{const game=getGame(button.dataset.careerOpen);if(game)openGameDetail(game);}));
 }
 let friendsData={friends:[],incoming:[],outgoing:[]};
 async function loadFriends(){if(!accountToken)return null;const data=await apiRequest("/account/friends");friendsData=data;return data;}
 async function renderFriends(){
  const host=$p("portalFriendsContent");
  if(!accountData){host.innerHTML='<div class="portal-section-panel"><h2>Sign in to use friends</h2><p>Friend requests and your list are connected to your player account.</p><button class="portal-primary" id="friendsSignIn">SIGN IN</button></div>';$p("friendsSignIn").addEventListener("click",()=>showAccountPrompt("login"));return;}
  host.innerHTML='<div class="portal-section-panel"><h2>Add a friend</h2><p>Send a request using their exact username. Requests must be accepted before a player appears in your friends list.</p><form class="portal-friend-add" id="portalFriendAdd"><input id="portalFriendUsername" class="portal-control" placeholder="Username" minlength="3" maxlength="20" required><button class="portal-primary" type="submit">SEND REQUEST</button></form><div class="portal-status" id="portalFriendStatus"></div></div><div class="portal-friend-columns"><section class="portal-section-panel"><div class="portal-eyebrow">INCOMING REQUESTS</div><div id="portalIncomingFriends">Loading…</div></section><section class="portal-section-panel"><div class="portal-eyebrow">YOUR FRIENDS</div><div id="portalFriendsList">Loading…</div></section></div>';
  try{
   const data=await loadFriends(),incoming=$p("portalIncomingFriends"),list=$p("portalFriendsList");
   incoming.innerHTML=data.incoming.length?data.incoming.map(friend=>'<div class="portal-friend-row"><span class="portal-avatar">'+AVATAR_EMOJI[friend.avatar||0]+'</span><div><b>'+esc(friend.username)+'</b><small>Level '+esc(friend.level)+'</small></div><button class="portal-secondary" data-friend-accept="'+esc(friend.username)+'">ACCEPT</button><button class="portal-secondary portal-danger" data-friend-decline="'+esc(friend.username)+'">DECLINE</button></div>').join(""):'<p class="portal-muted">No incoming requests.</p>';
   list.innerHTML=data.friends.length?data.friends.map(friend=>'<div class="portal-friend-row"><span class="portal-avatar">'+AVATAR_EMOJI[friend.avatar||0]+'</span><div><b>'+esc(friend.username)+'</b><small>Level '+esc(friend.level)+'</small></div><button class="portal-secondary" data-friend-remove="'+esc(friend.username)+'">REMOVE</button><button class="portal-secondary portal-danger" data-friend-block="'+esc(friend.username)+'">BLOCK</button></div>').join(""):'<p class="portal-muted">No friends yet. Add a player by username.</p>';
   host.querySelectorAll("[data-friend-accept]").forEach(button=>button.addEventListener("click",()=>respondFriend(button.dataset.friendAccept,true)));
   host.querySelectorAll("[data-friend-decline]").forEach(button=>button.addEventListener("click",()=>respondFriend(button.dataset.friendDecline,false)));
   host.querySelectorAll("[data-friend-remove]").forEach(button=>button.addEventListener("click",()=>mutateFriend("/account/friends/remove",button.dataset.friendRemove)));
   host.querySelectorAll("[data-friend-block]").forEach(button=>button.addEventListener("click",()=>mutateFriend("/account/friends/block",button.dataset.friendBlock)));
  }catch(error){$p("portalIncomingFriends").textContent=error.message;$p("portalFriendsList").textContent="";}
  $p("portalFriendAdd").addEventListener("submit",async event=>{event.preventDefault();const status=$p("portalFriendStatus");status.textContent="Sending…";status.className="portal-status";try{await apiRequest("/account/friends/request",{method:"POST",body:{username:$p("portalFriendUsername").value}});$p("portalFriendUsername").value="";status.textContent="Friend request sent.";status.className="portal-status success";await renderFriends();}catch(error){status.textContent=error.message;status.className="portal-status error";}});
 }
 async function respondFriend(name,accept){try{await apiRequest("/account/friends/respond",{method:"POST",body:{username:name,accept}});await renderFriends();}catch(error){toast(error.message);}}
 async function mutateFriend(endpoint,name){try{await apiRequest(endpoint,{method:"POST",body:{username:name}});await renderFriends();}catch(error){toast(error.message);}}
 function formatDuration(value){
  const total=Math.max(0,Math.floor(Number(value)||0)),hours=Math.floor(total/3600),minutes=Math.floor((total%3600)/60);
  return hours?hours+"h "+minutes+"m":minutes+"m";
 }
 function toast(message){
  const el=$p("portalToast");el.textContent=message;el.classList.add("show");
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3600);
 }

 const gameTitleByType={tennis:"Tennis Rally",hockey:"Hockey",reaction:"Reaction Game",click:"Click Test",breaker:"Neon Breaker",skydash:"Flappy Bird",snake:"Neon Snake",defender:"Space Defender",memory:"Memory Match",vehicle:"Tank Arena"};
 async function startTrackedGame(title){
  const gameId=gameIdByTitle[String(title||"")];if(!accountToken||!gameId)return null;
  if(Object.keys(activeGameSessions).length||currentTrackedGameId)return null;
  currentTrackedGameId=gameId;activeGameScores[gameId]=0;
  try{const started=await apiRequest("/account/game/start",{method:"POST",body:{gameId}});activeGameSessions[gameId]=started.sessionId;return started;}
  catch(error){currentTrackedGameId="";delete activeGameScores[gameId];console.warn("Could not start account game session:",error.message);return null;}
 }
 function reportTrackedGameScore(gameId,score){
  const id=String(gameId||""),value=Number(score);
  if(!id||id!==currentTrackedGameId||!Number.isFinite(value))return false;
  const safe=Math.max(0,Math.min(100000000,Math.floor(value)));
  activeGameScores[id]=Math.max(Number(activeGameScores[id])||0,safe);
  return true;
 }
 async function finishTrackedGame(){
  const gameId=Object.keys(activeGameSessions)[0];if(!gameId||!accountToken)return null;
  const sessionId=activeGameSessions[gameId],score=Number(activeGameScores[gameId])||0;
  try{
   const frame=document.getElementById("standaloneGameFrame");
   await frame?.contentWindow?.PlaySpaceGameBridge?.sync?.();
  }catch(error){}
  delete activeGameSessions[gameId];currentTrackedGameId="";delete activeGameScores[gameId];
  try{
   const result=await apiRequest("/account/game/complete",{method:"POST",body:{sessionId,score}});
   const latest=await apiRequest("/account/me");accountData={...latest,token:accountToken};updateUsernameDisplay();
   if(document.querySelector("#portalProfileView.active"))renderProfile();
   loadWeeklyHighlights().catch(()=>{});
   toast("+"+result.xpEarned+" XP · "+(result.achievements?.length||0)+" new trophies");
   return result;
  }catch(error){console.warn("Could not save game session:",error.message);return null;}
 }
 window.PlaySpaceAccount={
  isSignedIn:()=>!!accountToken,
  getProfile:()=>accountData?.profile||null,
  reportScore:(gameId,score)=>reportTrackedGameScore(gameId,score),
  request:(endpoint,options)=>apiRequest(endpoint,options),
  save:(gameId,save)=>apiRequest("/account/saves/"+encodeURIComponent(gameId),{method:"POST",body:{save}}),
  load:(gameId)=>apiRequest("/account/saves/"+encodeURIComponent(gameId)),
  startGame:startTrackedGame,
  completeGame:finishTrackedGame
 };
 const originalPortalOpenGame=window.openGame;
 if(typeof originalPortalOpenGame==="function"){
  window.openGame=async function(type){
   const title=gameTitleByType[String(type)]||String(type||"Game");
   setCurrentGame(title);startTrackedGame(title);
   return originalPortalOpenGame.apply(this,arguments);
  };
 }
 const originalPortalOpenStandaloneGame=window.openStandaloneGame;
 if(typeof originalPortalOpenStandaloneGame==="function"){
  window.openStandaloneGame=function(file,title){
   const gameTitle=String(title||"Game");
   const gameId=gameIdByTitle[gameTitle]||"";
   const frame=document.getElementById("standaloneGameFrame");
   if(frame&&gameId){
    frame.addEventListener("load",()=>{
     try{
      const doc=frame.contentDocument;
      if(!doc?.head||doc.querySelector("[data-playspace-bridge]"))return;
      const bridge=document.createElement("script");
      bridge.src=new URL("./playspace-game-bridge.js",window.location.href).href;
      bridge.dataset.playspaceBridge="1";
      bridge.dataset.gameId=gameId;
      doc.head.appendChild(bridge);
     }catch(error){console.warn("Could not attach cloud saves to "+gameTitle,error);}
    },{once:true});
   }
   setCurrentGame(gameTitle);startTrackedGame(gameTitle);
   return originalPortalOpenStandaloneGame.apply(this,arguments);
  };
 }
 const originalPortalCloseGame=window.closeGame;
 if(typeof originalPortalCloseGame==="function"){
  window.closeGame=async function(){
   try{return await originalPortalCloseGame.apply(this,arguments);}
   finally{await finishTrackedGame();setCurrentGame("");}
  };
 }
 const originalPortalCloseStandaloneGame=window.closeStandaloneGame;
 if(typeof originalPortalCloseStandaloneGame==="function"){
  window.closeStandaloneGame=async function(){
   await finishTrackedGame();
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
 const settingDefaults={theme:"playstation",columns:4,cardSize:"normal",motion:true,reduceMotion:false,highContrast:false,textSize:"normal",backgroundGlow:true,hoverEffects:true,sound:true,soundVolume:70,musicEnabled:true,musicVolume:48,autoMusic:false,sidebarExpanded:true,compactDetails:false,reduceTransparency:false,rememberSearch:true,openGameFullscreen:true,confirmExternal:true};
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
  document.body.classList.toggle("portal-high-contrast",!!portalSettings.highContrast);
  document.body.classList.toggle("portal-reduced-motion",!!portalSettings.reduceMotion||!portalSettings.motion);
  document.body.dataset.portalTextSize=["small","normal","large","xlarge"].includes(portalSettings.textSize)?portalSettings.textSize:"normal";
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
    '<section class="portal-setting-group"><h3>Accessibility</h3>'+settingSelect("textSize","Text size",[["small","Small"],["normal","Normal"],["large","Large"],["xlarge","Extra large"]],portalSettings.textSize)+settingCheck("highContrast","High contrast",portalSettings.highContrast)+settingCheck("reduceMotion","Reduce animation and motion",portalSettings.reduceMotion)+'</section>'+
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
  const players=Array.isArray(data.players)?data.players:[],accounts=Array.isArray(data.accounts)?data.accounts:[];
  const rows=players.length?players.map(player=>'<tr><td>'+esc(player.name)+'</td><td>'+esc(player.game)+'</td></tr>').join(""):'<tr><td colspan="2" class="portal-muted">No one is online right now.</td></tr>';
  const accountRows=accounts.length?accounts.map(account=>'<tr><td>'+esc(account.username)+'</td><td>'+esc(account.level)+'</td><td>'+esc(account.xp)+'</td><td>'+esc(account.gamesPlayed)+'</td><td>'+esc(formatDuration(account.timePlayedSeconds))+'</td><td>'+esc(account.achievements)+'</td></tr>').join(""):'<tr><td colspan="6" class="portal-muted">No saved player accounts yet.</td></tr>';
  host.innerHTML='<div class="portal-section-panel"><div class="portal-eyebrow">LIVE ACTIVITY</div><h2 style="margin-top:5px">Who&#39;s online</h2><table class="portal-table"><thead><tr><th>Username</th><th>Playing</th></tr></thead><tbody>'+rows+'</tbody></table><div class="portal-eyebrow" style="margin-top:20px">PLAYER DATABASE</div><h2 style="margin-top:5px">Saved player statistics</h2><div class="portal-online-table-wrap"><table class="portal-table"><thead><tr><th>Username</th><th>Level</th><th>XP</th><th>Games</th><th>Play time</th><th>Trophies</th></tr></thead><tbody>'+accountRows+'</tbody></table></div><div class="portal-muted" style="font-size:8px;margin-top:10px">Updated '+new Date(data.updatedAt||Date.now()).toLocaleTimeString()+'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="portal-secondary" id="portalDevRefresh">Refresh now</button><button class="portal-secondary" id="portalDevLock">Lock Dev Mode</button></div></div>';
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
