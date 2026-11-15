(() => {
  "use strict";
  const app=document.getElementById("arcadeRoot");
  const account=window.HomeAccount;
  if(!app||!account?.request)return;

  const nav=document.querySelector(".portal-nav");
  const views=document.getElementById("portalViews");
  if(!nav||!views)return;

  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const iconFor=slot=>({frame:"▣",badge:"✦",banner:"▤"}[slot]||"◇");
  let shopData=null,activeTab="shop",activeCategory="All",loading=false;

  const navItem=document.createElement("button");
  navItem.className="portal-nav-item";
  navItem.dataset.view="shop";
  navItem.type="button";
  navItem.innerHTML='<span class="portal-nav-icon" aria-hidden="true">◈</span><span class="portal-nav-label-text">Shop</span>';
  const friends=nav.querySelector('[data-view="friends"]');
  if(friends)friends.insertAdjacentElement("afterend",navItem);else nav.appendChild(navItem);

  const section=document.createElement("section");
  section.className="portal-view";
  section.id="portalShopView";
  section.dataset.page="shop";
  section.innerHTML=`
    <div class="portal-welcome">
      <div><div class="portal-eyebrow">PLAYER REWARDS</div><h1>Shop</h1><p>Use Credits earned through play to unlock profile items. Higher levels open new shop tiers.</p></div>
    </div>
    <div id="portalShopContent" aria-live="polite"><div class="portal-empty">Open the shop to load your rewards.</div></div>`;
  views.appendChild(section);

  const topbar=document.querySelector(".portal-topbar");
  if(topbar&&!document.getElementById("portalCreditsPill")){
    const pill=document.createElement("div");
    pill.id="portalCreditsPill";
    pill.className="portal-shop-top-balance";
    pill.hidden=true;
    pill.innerHTML='<span aria-hidden="true">◈</span><strong id="portalCreditsValue">0</strong><span>Credits</span>';
    const signIn=document.getElementById("portalQuickSignIn");
    topbar.insertBefore(pill,signIn||null);
  }

  function notify(message){
    const toast=document.getElementById("portalToast");
    if(toast){toast.textContent=message;toast.classList.add("show");clearTimeout(notify.timer);notify.timer=setTimeout(()=>toast.classList.remove("show"),2800);}
  }

  function setPage(){
    document.querySelectorAll(".portal-view").forEach(view=>view.classList.toggle("active",view.dataset.page==="shop"));
    document.querySelectorAll(".portal-nav-item[data-view]").forEach(button=>button.classList.toggle("active",button.dataset.view==="shop"));
    const kicker=document.getElementById("portalPageKicker"),title=document.getElementById("portalPageTitle");
    if(kicker)kicker.textContent="PLAYER REWARDS";
    if(title)title.textContent="Shop";
  }

  function showSignedOut(){
    const host=document.getElementById("portalShopContent");
    host.innerHTML='<div class="portal-section-panel"><h2>Sign in to use the shop</h2><p>Your Credits, purchases and unlocks are saved to your Home player account.</p><button class="portal-primary" id="portalShopSignIn" type="button">Sign in</button></div>';
    document.getElementById("portalShopSignIn").addEventListener("click",()=>document.getElementById("portalQuickSignIn")?.click());
    const pill=document.getElementById("portalCreditsPill");if(pill)pill.hidden=true;
  }

  async function loadShop(){
    if(!account.isSignedIn?.()){showSignedOut();return;}
    if(loading)return;
    loading=true;
    const host=document.getElementById("portalShopContent");
    host.innerHTML='<div class="portal-empty">Loading your shop…</div>';
    try{
      shopData=await account.request("/account/shop");
      render();
      applyEquippedAppearance();
    }catch(error){
      host.innerHTML='<div class="portal-empty">'+esc(error.message||"The shop is temporarily unavailable.")+'</div>';
    }finally{loading=false;}
  }

  function renderTierStrip(){
    return '<div class="portal-shop-tier-grid">'+shopData.tiers.map(tier=>
      '<div class="portal-shop-tier '+(tier.unlocked?"unlocked":"locked")+'"><div class="portal-shop-tier-heading"><strong>'+esc(tier.name)+'</strong><span>'+(tier.unlocked?"Unlocked":"Level "+tier.minLevel)+'</span></div><p>'+esc(tier.description)+'</p><div class="portal-shop-tier-level">LEVEL '+tier.minLevel+'</div></div>'
    ).join("")+'</div>';
  }

  function renderItem(item){
    const owned=item.owned;
    const canBuy=item.unlocked&&!owned&&shopData.currency.balance>=item.price;
    let action=owned?'<button class="portal-secondary" type="button" disabled>Owned</button>':
      !item.unlocked?'<button class="portal-secondary" type="button" disabled>Level '+item.minLevel+' required</button>':
      !canBuy?'<button class="portal-secondary" type="button" disabled>Not enough Credits</button>':
      '<button class="portal-primary" type="button" data-shop-buy="'+esc(item.id)+'">Unlock · '+item.price+' Credits</button>';
    return '<article class="portal-shop-item '+(item.unlocked?"":"locked")+'"><div class="portal-shop-item-art slot-'+esc(item.slot)+'"><span>'+iconFor(item.slot)+'</span></div><div class="portal-shop-item-copy"><div class="portal-shop-item-meta"><span>'+esc(item.category)+'</span><span>'+esc(item.tier)+'</span></div><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="portal-shop-item-requirement">'+(item.unlocked?"Available":"Unlocks at level "+item.minLevel)+'</div></div><div class="portal-shop-item-action">'+action+'</div></article>';
  }

  function renderShopTab(){
    const categories=["All","Frames","Badges","Banners"];
    const items=shopData.items.filter(item=>activeCategory==="All"||item.category===activeCategory);
    return '<div class="portal-section-panel portal-shop-wallet"><div><div class="portal-eyebrow">YOUR BALANCE</div><strong>'+Number(shopData.currency.balance).toLocaleString()+' Credits</strong><small>Earn Credits by completing games and unlocking achievements.</small></div><div class="portal-shop-level"><span>PLAYER LEVEL</span><strong>'+shopData.level+'</strong></div></div>'+
      '<div class="portal-shop-tabs"><button type="button" class="portal-filter active" data-shop-tab="shop">Shop items</button><button type="button" class="portal-filter" data-shop-tab="inventory">My inventory ('+shopData.inventory.length+')</button></div>'+
      '<div class="portal-shop-section"><div class="portal-genre-head"><h2>Shop progression</h2><span>Level up to unlock new tiers</span></div>'+renderTierStrip()+'</div>'+
      '<div class="portal-shop-section"><div class="portal-genre-head"><h2>Available rewards</h2><span>'+items.length+' items</span></div><div class="portal-filter-row">'+categories.map(category=>'<button type="button" class="portal-filter '+(activeCategory===category?"active":"")+'" data-shop-category="'+category+'">'+category+'</button>').join("")+'</div><div class="portal-shop-grid">'+(items.length?items.map(renderItem).join(""):'<div class="portal-empty">No items in this category yet.</div>')+'</div></div>'+
      '<div class="portal-section-panel portal-shop-history"><h2>Recent activity</h2><div class="portal-shop-transactions">'+(shopData.transactions.length?shopData.transactions.slice(0,8).map(tx=>'<div class="portal-shop-transaction"><span>'+esc(tx.reason.replaceAll("_"," "))+'</span><strong class="'+(tx.amount>0?"positive":"negative")+'">'+(tx.amount>0?"+":"")+Number(tx.amount).toLocaleString()+'</strong><small>'+new Date(tx.createdAt).toLocaleDateString()+'</small></div>').join(""):'<p>No Credits activity yet. Play a game to earn your first Credits.</p>')+'</div></div>';
  }

  function renderInventoryTab(){
    const owned=shopData.inventory.map(entry=>({entry,item:shopData.items.find(item=>item.id===entry.itemId)})).filter(row=>row.item);
    return '<div class="portal-section-panel portal-shop-wallet"><div><div class="portal-eyebrow">YOUR COLLECTION</div><strong>'+owned.length+' items owned</strong><small>Equip one item in each cosmetic slot. Your selections are saved to your player account.</small></div><div class="portal-shop-level"><span>CREDITS</span><strong>'+Number(shopData.currency.balance).toLocaleString()+'</strong></div></div>'+
      '<div class="portal-shop-tabs"><button type="button" class="portal-filter" data-shop-tab="shop">Shop items</button><button type="button" class="portal-filter active" data-shop-tab="inventory">My inventory ('+owned.length+')</button></div>'+
      '<div class="portal-shop-grid">'+(owned.length?owned.map(({entry,item})=>{
        const equipped=shopData.equipped?.[item.slot]===item.id;
        return '<article class="portal-shop-item"><div class="portal-shop-item-art slot-'+esc(item.slot)+'"><span>'+iconFor(item.slot)+'</span></div><div class="portal-shop-item-copy"><div class="portal-shop-item-meta"><span>'+esc(item.category)+'</span><span>'+esc(item.tier)+'</span></div><h3>'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="portal-shop-item-requirement">Added '+new Date(entry.acquiredAt).toLocaleDateString()+'</div></div><div class="portal-shop-item-action">'+(equipped?'<button type="button" class="portal-secondary" data-shop-unequip="'+esc(item.id)+'">Unequip</button>':'<button type="button" class="portal-primary" data-shop-equip="'+esc(item.id)+'">Equip</button>')+'</div></article>';
      }).join(""):'<div class="portal-empty">Your inventory is empty. Unlock an item in the shop to see it here.</div>')+'</div>';
  }

  function render(){
    if(!shopData)return;
    const host=document.getElementById("portalShopContent");
    host.innerHTML=activeTab==="inventory"?renderInventoryTab():renderShopTab();
    const pill=document.getElementById("portalCreditsPill"),value=document.getElementById("portalCreditsValue");
    if(pill)pill.hidden=false;if(value)value.textContent=Number(shopData.currency.balance).toLocaleString();
    host.querySelectorAll("[data-shop-tab]").forEach(button=>button.addEventListener("click",()=>{activeTab=button.dataset.shopTab;render();}));
    host.querySelectorAll("[data-shop-category]").forEach(button=>button.addEventListener("click",()=>{activeCategory=button.dataset.shopCategory;render();}));
    host.querySelectorAll("[data-shop-buy]").forEach(button=>button.addEventListener("click",()=>purchase(button.dataset.shopBuy,button)));
    host.querySelectorAll("[data-shop-equip]").forEach(button=>button.addEventListener("click",()=>equip(button.dataset.shopEquip,true)));
    host.querySelectorAll("[data-shop-unequip]").forEach(button=>button.addEventListener("click",()=>equip(button.dataset.shopUnequip,false)));
  }

  async function purchase(itemId,button){
    if(!account.isSignedIn?.()){showSignedOut();return;}
    button.disabled=true;button.textContent="Purchasing…";
    try{
      const result=await account.request("/account/shop/purchase",{method:"POST",body:{itemId}});
      notify("Unlocked "+result.item.name+"."+(result.achievementsUnlocked?.length?" Achievement unlocked!":""));
      await loadShop();
      if(activeTab!=="inventory"){activeTab="inventory";render();}
    }catch(error){notify(error.message||"Purchase failed.");await loadShop();}
  }

  async function equip(itemId,equipped){
    try{
      await account.request("/account/shop/equip",{method:"POST",body:{itemId,equipped}});
      shopData=await account.request("/account/shop");
      render();applyEquippedAppearance();
      notify(equipped?"Item equipped.":"Item unequipped.");
    }catch(error){notify(error.message||"Could not update your inventory.");}
  }

  function applyEquippedAppearance(){
    if(!shopData)return;
    const items=new Map(shopData.items.map(item=>[item.id,item]));
    const equipped=shopData.equipped||{};
    const frame=items.get(equipped.frame),banner=items.get(equipped.banner),badge=items.get(equipped.badge);
    document.querySelectorAll(".portal-avatar").forEach(avatar=>{
      avatar.classList.remove("shop-frame-classic","shop-frame-copper","shop-frame-silver","shop-frame-gold","shop-frame-carbon","shop-frame-legendary");
      if(frame)avatar.classList.add("shop-frame-"+frame.appearance);
    });
    const hero=document.querySelector(".portal-profile-hero");
    if(hero){
      hero.classList.remove("shop-banner-checkered","shop-banner-grand-prix","shop-banner-champion");
      if(banner)hero.classList.add("shop-banner-"+banner.appearance);
      const old=hero.querySelector(".portal-shop-profile-badge");
      if(badge){
        if(old?.textContent!==badge.appearance){
          old?.remove();
          const heading=hero.querySelector("h2");
          if(heading){const tag=document.createElement("span");tag.className="portal-shop-profile-badge";tag.textContent=badge.appearance;heading.insertAdjacentElement("afterend",tag);}
        }
      }else old?.remove();
    }
  }

  navItem.addEventListener("click",()=>{activeTab="shop";setPage();loadShop();});
  const profileHost=document.getElementById("portalProfileContent");
  if(profileHost){
    const observer=new MutationObserver(()=>applyEquippedAppearance());
    observer.observe(profileHost,{childList:true,subtree:true});
  }
  document.addEventListener("click",event=>{
    if(event.target.closest('[data-view="profile"]'))setTimeout(applyEquippedAppearance,0);
  });
  window.HomeShop={open:()=>{activeTab="shop";setPage();loadShop();},refresh:loadShop};
})();