(() => {
  "use strict";
  const root = document.getElementById("arcadeRoot");
  const account = window.HomeAccount;
  if (!root || !account?.request) return;

  const nav = document.querySelector(".portal-nav");
  const views = document.getElementById("portalViews");
  if (!nav || !views || document.querySelector('[data-view="challenges"]')) return;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));

  const navButton = document.createElement("button");
  navButton.type = "button";
  navButton.className = "portal-nav-item";
  navButton.dataset.view = "challenges";
  navButton.innerHTML = '<span class="portal-nav-icon" aria-hidden="true">✓</span><span class="portal-nav-label-text">Challenges</span>';
  const gamesButton = nav.querySelector('[data-view="games"]');
  if (gamesButton) gamesButton.insertAdjacentElement("afterend", navButton);
  else nav.appendChild(navButton);

  const page = document.createElement("section");
  page.className = "portal-view";
  page.id = "portalChallengesView";
  page.dataset.page = "challenges";
  page.innerHTML = [
    '<div class="portal-welcome"><div><div class="portal-eyebrow">PLAY · PROGRESS · EARN</div><h1>Challenges</h1><p>Complete daily and weekly goals across Home games. Rewards are added automatically when you finish a qualifying session.</p></div></div>',
    '<div id="portalChallengesContent" aria-live="polite"><div class="portal-empty">Open challenges to load your progress.</div></div>'
  ].join("");
  views.appendChild(page);

  function showPage() {
    document.querySelectorAll(".portal-view").forEach(view => view.classList.toggle("active", view.dataset.page === "challenges"));
    document.querySelectorAll(".portal-nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === "challenges"));
    const kicker = document.getElementById("portalPageKicker");
    const title = document.getElementById("portalPageTitle");
    if (kicker) kicker.textContent = "PLAY · PROGRESS · EARN";
    if (title) title.textContent = "Challenges";
  }

  function timeLabel(timestamp) {
    const value = new Date(timestamp);
    return Number.isNaN(value.getTime()) ? "Reset time unavailable" : "Resets " + value.toLocaleString([], {weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit"});
  }

  function renderChallenge(item) {
    const progress = Math.max(0, Math.min(item.target, Number(item.progress) || 0));
    const percent = item.target ? Math.round(progress / item.target * 100) : 0;
    return [
      '<article class="portal-challenge-card ' + (item.completed ? "completed" : "") + '">',
        '<div class="portal-challenge-card-top"><span class="portal-challenge-tag">' + escapeHtml(item.gameId === "f1-simulator" ? "F1 SIMULATOR" : "HOME GAMES") + '</span>',
        '<span class="portal-challenge-state">' + (item.completed ? "Completed" : progress + " / " + item.target) + '</span></div>',
        '<h3>' + escapeHtml(item.title) + '</h3><p>' + escapeHtml(item.description) + '</p>',
        '<div class="portal-challenge-progress" role="progressbar" aria-label="' + escapeHtml(item.title) + ' progress" aria-valuemin="0" aria-valuemax="' + item.target + '" aria-valuenow="' + progress + '"><span style="width:' + percent + '%"></span></div>',
        '<div class="portal-challenge-footer"><span>' + progress + ' of ' + item.target + ' completed</span><strong>+' + Number(item.xpReward).toLocaleString() + ' XP · +' + Number(item.currencyReward).toLocaleString() + ' Credits</strong></div>',
        (item.completed ? '<div class="portal-challenge-complete">✓ Complete — rewards added to your account</div>' : ''),
      '</article>'
    ].join("");
  }

  function renderGroup(title, subtitle, group) {
    return [
      '<section class="portal-challenge-group">',
        '<div class="portal-genre-head"><h2>' + title + '</h2><span>' + escapeHtml(subtitle) + '</span></div>',
        '<div class="portal-challenge-grid">' + group.items.map(renderChallenge).join("") + '</div>',
        '<div class="portal-challenge-reset">' + timeLabel(group.resetsAt) + ' · Period starts ' + escapeHtml(group.period) + ' UTC</div>',
      '</section>'
    ].join("");
  }

  async function loadChallenges() {
    const host = document.getElementById("portalChallengesContent");
    if (!account.isSignedIn?.()) {
      host.innerHTML = '<div class="portal-section-panel"><h2>Sign in to track challenges</h2><p>Your progress and rewards are saved to your Home player account.</p><button id="portalChallengesSignIn" class="portal-primary" type="button">Sign in</button></div>';
      document.getElementById("portalChallengesSignIn")?.addEventListener("click", () => document.getElementById("portalQuickSignIn")?.click());
      return;
    }
    host.innerHTML = '<div class="portal-empty">Loading your challenges…</div>';
    try {
      const data = await account.request("/account/challenges");
      const count = [...data.daily.items, ...data.weekly.items].filter(item => item.completed).length;
      host.innerHTML = [
        '<div class="portal-section-panel portal-challenge-summary"><div><div class="portal-eyebrow">CURRENT PROGRESS</div><strong>' + count + ' / ' + (data.daily.items.length + data.weekly.items.length) + ' completed</strong><small>Finish activities in any connected game to earn XP and Credits.</small></div>',
        '<button id="portalChallengesRefresh" class="portal-secondary" type="button">Refresh progress</button></div>',
        renderGroup("Daily challenges", "Refresh every day", data.daily),
        renderGroup("Weekly challenges", "A longer set of goals", data.weekly)
      ].join("");
      document.getElementById("portalChallengesRefresh")?.addEventListener("click", loadChallenges);
    } catch (error) {
      host.innerHTML = '<div class="portal-empty">' + escapeHtml(error.message || "Challenges are unavailable right now.") + '<p><button class="portal-secondary" id="portalChallengesRetry" type="button">Try again</button></p></div>';
      document.getElementById("portalChallengesRetry")?.addEventListener("click", loadChallenges);
    }
  }

  navButton.addEventListener("click", () => {
    showPage();
    loadChallenges();
  });
  window.HomeChallenges = { open: () => { showPage(); loadChallenges(); }, refresh: loadChallenges };
})();