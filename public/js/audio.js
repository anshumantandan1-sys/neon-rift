/**
 * NEON RIFT audio engine.
 * Every sound is synthesized live with the Web Audio API — no asset files,
 * no network requests, instant load.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.volume = 0.55;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.makeNoise(1.0);
      this.ready = true;
    } catch (err) {
      console.warn('[audio] unavailable', err);
    }
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  noise({ dur = 0.1, gain = 0.15, type = 'lowpass', freq = 1200, freqEnd = null, q = 0.8, when = 0 }) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (freqEnd) filt.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15, gain = 0.12, attack = 0.004, when = 0, detune = 0 }) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.value = detune;
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  playShoot(weaponId) {
    if (!this.ready) return;
    const pitch = 0.94 + Math.random() * 0.12;
    if (weaponId === 'shotgun') {
      this.noise({ dur: 0.32, gain: 0.38, type: 'lowpass', freq: 1400, freqEnd: 180, q: 0.6 });
      this.tone({ freq: 160 * pitch, freqEnd: 42, type: 'sine', dur: 0.3, gain: 0.33 });
      this.tone({ freq: 80, freqEnd: 35, type: 'triangle', dur: 0.35, gain: 0.22 });
      this.noise({ dur: 0.09, gain: 0.2, type: 'highpass', freq: 2600, freqEnd: 900 });
    } else if (weaponId === 'pistol') {
      this.tone({ freq: 780 * pitch, freqEnd: 190, type: 'square', dur: 0.1, gain: 0.1 });
      this.tone({ freq: 1450 * pitch, freqEnd: 500, type: 'triangle', dur: 0.07, gain: 0.06 });
      this.noise({ dur: 0.1, gain: 0.16, type: 'bandpass', freq: 2200, freqEnd: 500, q: 1.1 });
    } else if (weaponId === 'smg') {
      this.tone({ freq: 620 * pitch, freqEnd: 150, type: 'square', dur: 0.055, gain: 0.07 });
      this.tone({ freq: 1700 * pitch, freqEnd: 640, type: 'triangle', dur: 0.04, gain: 0.04 });
      this.noise({ dur: 0.05, gain: 0.12, type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.2 });
    } else if (weaponId === 'dmr') {
      this.tone({ freq: 320 * pitch, freqEnd: 70, type: 'sawtooth', dur: 0.16, gain: 0.11 });
      this.tone({ freq: 980 * pitch, freqEnd: 260, type: 'square', dur: 0.1, gain: 0.05 });
      this.noise({ dur: 0.16, gain: 0.2, type: 'highpass', freq: 1900, freqEnd: 380 });
      this.noise({ dur: 0.28, gain: 0.08, type: 'lowpass', freq: 900, freqEnd: 150, when: 0.03 });
    } else {
      this.tone({ freq: 460 * pitch, freqEnd: 95, type: 'sawtooth', dur: 0.09, gain: 0.08 });
      this.tone({ freq: 1250 * pitch, freqEnd: 420, type: 'square', dur: 0.06, gain: 0.035 });
      this.noise({ dur: 0.08, gain: 0.15, type: 'highpass', freq: 1700, freqEnd: 700 });
    }
  }

  playRemoteShoot(weaponId, distance = 10) {
    if (!this.ready) return;
    const vol = Math.max(0.02, Math.min(1, 1 - distance / 55));
    if (vol < 0.04) return;
    if (weaponId === 'shotgun') {
      this.noise({ dur: 0.26, gain: 0.22 * vol, type: 'lowpass', freq: 900, freqEnd: 150 });
      this.tone({ freq: 130, freqEnd: 40, type: 'sine', dur: 0.24, gain: 0.18 * vol });
    } else if (weaponId === 'pistol') {
      this.noise({ dur: 0.08, gain: 0.1 * vol, type: 'bandpass', freq: 1900, freqEnd: 500 });
    } else if (weaponId === 'smg') {
      this.noise({ dur: 0.045, gain: 0.075 * vol, type: 'bandpass', freq: 2400, freqEnd: 800 });
      this.tone({ freq: 520, freqEnd: 160, type: 'square', dur: 0.045, gain: 0.035 * vol });
    } else if (weaponId === 'dmr') {
      this.noise({ dur: 0.14, gain: 0.13 * vol, type: 'highpass', freq: 1700, freqEnd: 400 });
      this.tone({ freq: 300, freqEnd: 80, type: 'sawtooth', dur: 0.13, gain: 0.06 * vol });
    } else {
      this.noise({ dur: 0.07, gain: 0.11 * vol, type: 'highpass', freq: 1500, freqEnd: 600 });
      this.tone({ freq: 400, freqEnd: 90, type: 'sawtooth', dur: 0.07, gain: 0.04 * vol });
    }
  }

  playHitmarker(headshot = false, killed = false) {
    if (killed) {
      this.tone({ freq: 720, freqEnd: 1180, type: 'triangle', dur: 0.16, gain: 0.14 });
      this.tone({ freq: 1180, type: 'sine', dur: 0.12, gain: 0.08, when: 0.07 });
      return;
    }
    this.tone({ freq: headshot ? 1980 : 1420, type: 'square', dur: 0.035, gain: 0.055 });
    this.tone({ freq: headshot ? 2400 : 1800, type: 'sine', dur: 0.045, gain: 0.04, when: 0.015 });
  }

  playDamage(amount = 20) {
    this.tone({ freq: 160, freqEnd: 60, type: 'sawtooth', dur: 0.28, gain: 0.16 });
    this.noise({ dur: 0.22, gain: 0.1, type: 'lowpass', freq: 700, freqEnd: 120 });
    if (amount > 35) this.tone({ freq: 70, type: 'sine', dur: 0.35, gain: 0.12 });
  }

  playKill() {
    this.tone({ freq: 880, type: 'triangle', dur: 0.09, gain: 0.1 });
    this.tone({ freq: 1320, type: 'triangle', dur: 0.09, gain: 0.1, when: 0.08 });
    this.tone({ freq: 1760, type: 'triangle', dur: 0.16, gain: 0.1, when: 0.16 });
  }

  playDodge() {
    this.noise({ dur: 0.22, gain: 0.11, type: 'bandpass', freq: 900, freqEnd: 2600, q: 0.7 });
    this.tone({ freq: 300, freqEnd: 520, type: 'sine', dur: 0.16, gain: 0.045 });
    this.noise({ dur: 0.18, gain: 0.06, type: 'lowpass', freq: 600, freqEnd: 160, when: 0.05 });
  }

  playDodgeRemote(distance = 10) {
    if (!this.ready) return;
    const vol = Math.max(0.02, Math.min(1, 1 - distance / 40));
    if (vol < 0.05) return;
    this.noise({ dur: 0.2, gain: 0.07 * vol, type: 'bandpass', freq: 800, freqEnd: 2200, q: 0.7 });
    this.noise({ dur: 0.14, gain: 0.05 * vol, type: 'lowpass', freq: 500, freqEnd: 140, when: 0.04 });
  }

  playHeal() {
    this.tone({ freq: 620, freqEnd: 930, type: 'sine', dur: 0.18, gain: 0.07 });
    this.tone({ freq: 930, freqEnd: 1240, type: 'triangle', dur: 0.2, gain: 0.055, when: 0.09 });
    this.tone({ freq: 1240, type: 'sine', dur: 0.22, gain: 0.035, when: 0.19 });
  }

  playDeath() {
    this.tone({ freq: 320, freqEnd: 55, type: 'sawtooth', dur: 1.1, gain: 0.18 });
    this.noise({ dur: 0.9, gain: 0.14, type: 'lowpass', freq: 1800, freqEnd: 100 });
  }

  playReload(weaponId) {
    const long = weaponId === 'shotgun';
    const times = long ? [0, 0.25, 0.55, 0.85, 1.35] : [0, 0.18, 0.55, 0.9];
    for (const t of times) {
      this.noise({ dur: 0.045, gain: 0.07, type: 'highpass', freq: 2400 + Math.random() * 800, when: t });
    }
    this.tone({ freq: 240, freqEnd: 320, type: 'square', dur: 0.05, gain: 0.03, when: times[1] || 0.2 });
  }

  playSwitch() {
    this.noise({ dur: 0.04, gain: 0.06, type: 'highpass', freq: 3000 });
    this.tone({ freq: 500, freqEnd: 700, type: 'square', dur: 0.04, gain: 0.03, when: 0.03 });
  }

  playFootstep() {
    this.noise({ dur: 0.06, gain: 0.045, type: 'lowpass', freq: 500 + Math.random() * 220, freqEnd: 120 });
  }

  playJump() {
    this.tone({ freq: 260, freqEnd: 420, type: 'sine', dur: 0.12, gain: 0.05 });
  }

  playLand() {
    this.noise({ dur: 0.1, gain: 0.08, type: 'lowpass', freq: 420, freqEnd: 90 });
    this.tone({ freq: 110, freqEnd: 55, type: 'sine', dur: 0.12, gain: 0.07 });
  }

  playRespawn() {
    this.tone({ freq: 220, freqEnd: 660, type: 'triangle', dur: 0.35, gain: 0.1 });
    this.tone({ freq: 440, freqEnd: 1320, type: 'sine', dur: 0.4, gain: 0.06, when: 0.08 });
  }

  playUiHover() {
    this.tone({ freq: 900, type: 'sine', dur: 0.03, gain: 0.018 });
  }

  playUiClick() {
    this.tone({ freq: 520, freqEnd: 880, type: 'triangle', dur: 0.07, gain: 0.06 });
  }

  playEmpty() {
    this.noise({ dur: 0.03, gain: 0.05, type: 'highpass', freq: 3200 });
  }

  startMusic() {
    if (!this.ready || this.musicTimer) return;
    this.musicStep = 0;
    const bass = [55, 55, 65.41, 73.42];
    const arp = [220, 261.63, 329.63, 392, 440, 392, 329.63, 261.63];
    const playBar = () => {
      if (!this.ready) return;
      const root = bass[Math.floor(this.musicStep / 8) % bass.length];
      this.tone({ freq: root, type: 'triangle', dur: 3.4, gain: 0.035, attack: 0.8, when: 0 });
      this.tone({ freq: root * 1.5, type: 'sine', dur: 3.6, gain: 0.018, attack: 1.2, when: 0 });
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.18) continue;
        const note = arp[(i + this.musicStep) % arp.length];
        this.tone({
          freq: note * (Math.random() < 0.1 ? 2 : 1),
          type: 'triangle',
          dur: 0.32,
          gain: 0.016,
          when: i * 0.42,
        });
      }
      this.musicStep++;
    };
    playBar();
    this.musicTimer = setInterval(playBar, 3400);
  }
}
