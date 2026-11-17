import { WEAPONS } from './weapons.js';

const $ = (id) => document.getElementById(id);

const WEAPON_SHORT = { pistol: 'PULSE', shotgun: 'NOVA', rifle: 'ION' };
const WEAPON_FULL = {
  pistol: 'PULSE PISTOL',
  shotgun: 'NOVA SHOTGUN',
  rifle: 'ION RIFLE',
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class UI {
  constructor() {
    this.menu = $('menu');
    this.hud = $('hud');
    this.boot = $('boot');
    this.bootText = $('boot-text');
    this.healthFill = $('health-fill');
    this.healthValue = $('health-value');
    this.killsEl = $('kills');
    this.deathsEl = $('deaths');
    this.streakChip = $('streak-chip');
    this.streakValue = $('streak-value');
    this.shieldChip = $('shield-chip');
    this.timerEl = $('match-timer');
    this.roomCodeEl = $('room-code');
    this.roomChip = $('room-chip');
    this.weaponName = $('weapon-name');
    this.ammoMag = $('ammo-mag');
    this.ammoReserve = $('ammo-reserve');
    this.weaponSlots = [...document.querySelectorAll('.weapon-slot')];
    this.reloadIndicator = $('reload-indicator');
    this.reloadFill = $('reload-fill');
    this.crosshair = $('crosshair');
    this.hitmarkerEl = $('hitmarker');
    this.damageNumbers = $('damage-numbers');
    this.killBannerEl = $('kill-banner');
    this.killFeedEl = $('killfeed');
    this.noticesEl = $('notices');
    this.scoreboardEl = $('scoreboard');
    this.scoreboardBody = $('scoreboard-body');
    this.scoreboardRoom = $('scoreboard-room');
    this.deathEl = $('death-screen');
    this.deathKiller = $('death-killer');
    this.deathWeapon = $('death-weapon');
    this.respawnCountdown = $('respawn-countdown');
    this.respawnFill = $('respawn-fill');
    this.pauseEl = $('pause');
    this.resultsEl = $('results');
    this.resultsTitle = $('results-title');
    this.resultsSub = $('results-sub');
    this.resultsList = $('results-list');
    this.resultsCountdown = $('results-countdown');
    this.signalLostEl = $('signal-lost');
    this.damageFlashEl = $('damage-flash');
    this.lowHealthEl = $('low-health-vignette');
    this.lockHint = $('lock-hint');
    this.respawnHint = $('respawn-hint');
    this.menuError = $('menu-error');
    this.sensValue = $('sens-value');
    this.sensitivity = $('sensitivity');
    this.soundToggle = $('sound-toggle');
    this.soundTogglePause = $('sound-toggle-pause');

    this.selfId = null;
    this.selfName = null;
    this.deathDeadline = 0;
    this.deathDuration = 3200;
    this.resultsDeadline = 0;
    this.lastTimer = '';
    this.healthShown = 100;
    this.weaponId = 'rifle';
    this.magSize = 32;
    this.feedTimers = [];
  }

  // ---------------- screens ----------------
  setBoot(text) {
    if (this.bootText && text) this.bootText.textContent = text;
  }

  hideBoot() {
    if (!this.boot) return;
    this.boot.classList.add('done');
    setTimeout(() => this.boot.classList.add('hidden'), 600);
  }

  showMenu() {
    this.menu.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.hideDeath();
    this.showPause(false);
    this.showResults(null);
    this.signalLost(false);
    this.showScoreboard(false);
    this.clearFeed();
    this.setLockHint(false);
    this.lowHealth(false);
    this.deathDeadline = 0;
    this.resultsDeadline = 0;
    this.soundToggle?.blur();
  }

  showHud() {
    this.menu.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }

  setMenuBusy(busy, text = 'CONNECTING…') {
    const quick = $('quickplay-btn');
    const join = $('join-room-btn');
    if (!quick || !join) return;
    if (busy && quick.disabled) return;
    if (busy) {
      quick.dataset.label = quick.innerHTML;
      quick.innerHTML = `<span class="btn-arrow">◌</span> ${text}`;
      quick.disabled = true;
      join.disabled = true;
      quick.style.opacity = '0.7';
      join.style.opacity = '0.6';
    } else {
      if (quick.dataset.label) quick.innerHTML = quick.dataset.label;
      quick.disabled = false;
      join.disabled = false;
      quick.style.opacity = '';
      join.style.opacity = '';
    }
  }

  setMenuError(message) {
    this.menuError.textContent = message || '';
    this.setMenuBusy(false);
  }

  // ---------------- HUD ----------------
  setSelf(id, name) {
    this.selfId = id;
    this.selfName = name;
  }

  setRoom(code) {
    this.roomCodeEl.textContent = code || '----';
    this.scoreboardRoom.textContent = code || '----';
    this.roomChip.dataset.code = code || '';
  }

  setTimer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const text = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (text !== this.lastTimer) {
      this.lastTimer = text;
      this.timerEl.textContent = text;
    }
    this.timerEl.classList.toggle('urgent', s <= 30);
  }

  setHealth(health) {
    const hp = Math.max(0, Math.min(100, Math.round(health)));
    if (hp === this.healthShown) return;
    this.healthShown = hp;
    this.healthValue.textContent = hp;
    this.healthFill.style.width = `${hp}%`;
    this.healthFill.classList.toggle('mid', hp <= 60 && hp > 30);
    this.healthFill.classList.toggle('low', hp <= 30);
    this.lowHealth(hp > 0 && hp <= 30);
  }

  setScores(kills, deaths) {
    this.killsEl.textContent = kills;
    this.deathsEl.textContent = deaths;
  }

  setStreak(streak) {
    const on = streak >= 2;
    this.streakChip.classList.toggle('hidden', !on);
    if (on) this.streakValue.textContent = streak;
  }

  setShield(on) {
    this.shieldChip?.classList.toggle('hidden', !on);
  }

  setWeapon(def) {
    if (!def) return;
    this.weaponId = def.id;
    this.weaponName.textContent = def.name.toUpperCase();
    this.weaponName.style.color = def.color;
    this.crosshair.className = `crosshair crosshair-${def.crosshair || def.id}`;
    for (const slot of this.weaponSlots) {
      slot.classList.toggle('active', slot.dataset.weapon === def.id);
    }
    this.setCrosshairGap(this.baseGap);
  }

  get baseGap() {
    return this.weaponId === 'shotgun' ? 14 : this.weaponId === 'pistol' ? 8 : 10;
  }

  setAmmo(mag, reserve = '∞') {
    this.ammoMag.textContent = mag;
    this.ammoReserve.textContent = reserve;
    this.ammoMag.classList.toggle('low', mag <= Math.max(1, Math.ceil(this.magSize * 0.25)));
  }

  setMagSize(size) {
    this.magSize = size;
  }

  setReload(progress) {
    if (progress === null || progress === undefined) {
      this.reloadIndicator.classList.add('hidden');
      return;
    }
    this.reloadIndicator.classList.remove('hidden');
    this.reloadFill.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
  }

  setCrosshairGap(gap) {
    this.crosshair.style.setProperty('--gap', `${Math.round(gap * 10) / 10}px`);
  }

  setCrosshairVisible(visible) {
    this.crosshair.classList.toggle('hidden-ch', !visible);
  }

  setLockHint(show) {
    this.lockHint.classList.toggle('hidden', !show);
  }

  setRespawnHint(show, text = 'RESPAWNING…') {
    this.respawnHint.classList.toggle('hidden', !show);
    if (text) this.respawnHint.textContent = text;
  }

  // ---------------- feedback ----------------
  hitmarker(headshot = false, killed = false) {
    this.hitmarkerEl.classList.remove('show', 'headshot', 'kill');
    void this.hitmarkerEl.offsetWidth;
    this.hitmarkerEl.classList.add('show');
    if (headshot) this.hitmarkerEl.classList.add('headshot');
    if (killed) this.hitmarkerEl.classList.add('kill');
  }

  damageNumber(amount, headshot = false) {
    const node = el('div', `dmg-number${headshot ? ' head' : ''}`, headshot ? `${amount} HEAD` : `${amount}`);
    node.style.left = `${(Math.random() * 2 - 1) * 46}px`;
    node.style.top = `${(Math.random() * 2 - 1) * 10}px`;
    this.damageNumbers.appendChild(node);
    setTimeout(() => node.remove(), 720);
  }

  flashDamage() {
    this.damageFlashEl.classList.remove('pulse');
    void this.damageFlashEl.offsetWidth;
    this.damageFlashEl.classList.add('pulse');
  }

  lowHealth(on) {
    this.lowHealthEl.classList.toggle('on', !!on);
  }

  killBanner(text) {
    this.killBannerEl.textContent = text;
    this.killBannerEl.classList.remove('show');
    void this.killBannerEl.offsetWidth;
    this.killBannerEl.classList.add('show');
  }

  killFeed({ killerName, victimName, weapon, headshot, selfKill, selfDeath }) {
    const row = el('div', `killfeed-row${selfKill ? ' self' : ''}`);
    row.appendChild(el('span', 'kf-killer', killerName));
    row.appendChild(el('span', 'kf-icon', headshot ? '◎' : '✖'));
    row.appendChild(el('span', 'kf-weapon', WEAPON_SHORT[weapon] || 'RIFT'));
    row.appendChild(el('span', 'kf-victim', victimName));
    this.killFeedEl.appendChild(row);
    while (this.killFeedEl.children.length > 6) this.killFeedEl.firstElementChild.remove();
    const timer = setTimeout(() => {
      row.classList.add('out');
      setTimeout(() => row.remove(), 320);
    }, 6000);
    this.feedTimers.push(timer);
    if (this.feedTimers.length > 20) this.feedTimers.shift();
    void selfDeath;
  }

  notice(text, kind = '') {
    if (!text) return;
    const node = el('div', `notice${kind ? ` ${kind}` : ''}`, text);
    this.noticesEl.appendChild(node);
    while (this.noticesEl.children.length > 4) this.noticesEl.firstElementChild.remove();
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 380);
    }, 4200);
  }

  clearFeed() {
    this.killFeedEl.replaceChildren();
    this.noticesEl.replaceChildren();
    for (const t of this.feedTimers) clearTimeout(t);
    this.feedTimers = [];
  }

  // ---------------- death ----------------
  showDeath(killerName, weapon, respawnMs) {
    this.deathKiller.textContent = killerName || 'THE ARENA';
    this.deathWeapon.textContent = WEAPON_FULL[weapon] || 'RIFT ENERGY';
    this.deathDuration = respawnMs || 3200;
    this.deathDeadline = performance.now() + this.deathDuration;
    this.deathEl.classList.remove('hidden');
    this.respawnCountdown.textContent = (this.deathDuration / 1000).toFixed(1);
    this.respawnFill.style.width = '0%';
    this.setRespawnHint(false);
    this.setCrosshairVisible(false);
    this.lowHealth(false);
  }

  hideDeath() {
    this.deathEl.classList.add('hidden');
    this.deathDeadline = 0;
    this.setCrosshairVisible(true);
  }

  // ---------------- scoreboard ----------------
  showScoreboard(show) {
    this.scoreboardEl.classList.toggle('hidden', !show);
  }

  updateScoreboard(players, selfId) {
    if (!this.scoreboardEl || this.scoreboardEl.classList.contains('hidden')) return;
    const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const frag = document.createDocumentFragment();
    sorted.forEach((p, i) => {
      const tr = document.createElement('tr');
      if (p.id === selfId) tr.className = 'self';
      const rankTd = el('td', 'rank', `${i + 1}`);
      const nameTd = document.createElement('td');
      const wrap = el('div', 'player-cell');
      const dot = el('span', 'player-dot');
      dot.style.color = p.id === selfId ? '#7dff6b' : '#43e8ff';
      wrap.appendChild(dot);
      wrap.appendChild(el('span', '', p.name));
      if (p.bot) wrap.appendChild(el('span', 'bot-tag', 'BOT'));
      if (!p.alive) wrap.appendChild(el('span', 'dead-tag', 'DOWN'));
      nameTd.appendChild(wrap);
      const kTd = el('td', '', String(p.kills));
      const dTd = el('td', '', String(p.deaths));
      const sTd = el('td', '', String(p.streak || 0));
      tr.append(rankTd, nameTd, kTd, dTd, sTd);
      frag.appendChild(tr);
    });
    this.scoreboardBody.replaceChildren(frag);
  }

  // ---------------- pause / results / disconnect ----------------
  showPause(show) {
    this.pauseEl.classList.toggle('hidden', !show);
  }

  showResults(data, selfId, restartIn = 14) {
    if (!data) {
      this.resultsEl.classList.add('hidden');
      this.resultsDeadline = 0;
      return;
    }
    const standings = data.standings || [];
    const winner = standings[0];
    const isWinner = winner && winner.id === selfId && winner.kills > 0;
    this.resultsTitle.textContent = isWinner ? 'VICTORY' : 'MATCH COMPLETE';
    this.resultsSub.textContent = winner
      ? `${winner.name} takes the rift with ${winner.kills} elimination${winner.kills === 1 ? '' : 's'}`
      : 'Top fraggers of the rift';
    const frag = document.createDocumentFragment();
    standings.forEach((p, i) => {
      const li = document.createElement('li');
      if (p.id === selfId) li.className = 'self';
      li.appendChild(el('span', 'res-rank', `#${i + 1}`));
      li.appendChild(el('span', 'res-name', p.name + (p.bot ? ' [BOT]' : '')));
      li.appendChild(el('span', 'res-score', `${p.kills} K`));
      li.appendChild(el('span', 'res-deaths', `${p.deaths} D`));
      frag.appendChild(li);
    });
    this.resultsList.replaceChildren(frag);
    this.resultsEl.classList.remove('hidden');
    this.resultsDeadline = performance.now() + restartIn * 1000;
    this.resultsCountdown.textContent = Math.ceil(restartIn);
    this.showScoreboard(false);
    this.showPause(false);
    this.hideDeath();
    this.setCrosshairVisible(false);
    this.setLockHint(false);
  }

  signalLost(show) {
    this.signalLostEl.classList.toggle('hidden', !show);
    if (show) {
      this.setLockHint(false);
      this.showPause(false);
      this.showScoreboard(false);
    }
  }

  // ---------------- per-frame countdowns ----------------
  tick(now) {
    if (this.deathDeadline) {
      const remaining = Math.max(0, this.deathDeadline - now);
      this.respawnCountdown.textContent = (remaining / 1000).toFixed(1);
      this.respawnFill.style.width = `${Math.min(100, (1 - remaining / this.deathDuration) * 100)}%`;
    }
    if (this.resultsDeadline) {
      const remaining = Math.max(0, Math.ceil((this.resultsDeadline - now) / 1000));
      this.resultsCountdown.textContent = remaining;
    }
  }

  // ---------------- menu settings ----------------
  setMuted(muted) {
    const label = muted ? 'OFF' : 'ON';
    for (const btn of [this.soundToggle, this.soundTogglePause]) {
      if (!btn) continue;
      btn.textContent = label;
      btn.classList.toggle('muted', muted);
    }
  }

  setSensitivity(value) {
    if (this.sensitivity) this.sensitivity.value = value;
    if (this.sensValue) this.sensValue.textContent = Number(value).toFixed(2).replace(/0$/, '');
  }

  setQuality(q) {
    for (const btn of document.querySelectorAll('#quality-toggle button')) {
      btn.classList.toggle('active', btn.dataset.quality === q);
    }
  }
}

export { WEAPONS };
