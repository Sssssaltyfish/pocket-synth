// Pocket Synth · AGPL-3.0-or-later.
// Worklet-free Web Audio fallback for embedded hosts that block data: AudioWorklet modules.
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
const curveCache = new Map();
function driveCurve(amount) {
  const step = Math.round(clamp(amount, 0, 1) * 100);
  if (!curveCache.has(step)) {
    const samples = new Float32Array(2048), k = 1 + step * 0.12;
    for (let i = 0; i < samples.length; i++) {
      const x = i / (samples.length - 1) * 2 - 1;
      samples[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    curveCache.set(step, samples);
  }
  return curveCache.get(step);
}
function ramp(param, value, time) {
  param.linearRampToValueAtTime(value, time);
}

// The transport still comes from official Strudel Cyclist. Only the sound output
// is replaced, with native nodes that work without AudioWorklet or script URLs.
export class NativeSynthOutput {
  constructor(ctx, maxVoices = 48) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.maxVoices = maxVoices;
    this.voices = new Set();
  }

  trigger(v, when, length) {
    const ctx = this.ctx;
    const midi = Number(v.note);
    if (!Number.isFinite(midi)) return;
    const start = Math.max(ctx.currentTime, Number.isFinite(when) ? when : ctx.currentTime);
    const duration = clamp(length, 0.01, 10);
    const end = start + duration;
    const release = clamp(v.release ?? 0.2, 0.02, 6);
    const stopTime = end + release;
    const attack = Math.min(clamp(v.attack ?? 0.02, 0.005, 6), duration);
    const decay = Math.min(clamp(v.decay ?? 0.3, 0.01, 6), Math.max(0, duration - attack));
    const sustain = clamp(v.sustain ?? 0.5, 0, 1);
    const volume = clamp(v.gain ?? 0.15, 0, 0.5);
    const nodes = [];
    const connect = (node, target) => { node.connect(target); nodes.push(node); return node; };
    const carrier = ctx.createOscillator();
    carrier.type = ({sine:'sine', triangle:'triangle', sawtooth:'sawtooth', square:'square'})[v.s] || 'sine';
    const hz = freq(midi);
    carrier.frequency.setValueAtTime(hz, start);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, start);
    ramp(envelope.gain, volume, start + attack);
    ramp(envelope.gain, volume * sustain, start + attack + decay);
    envelope.gain.setValueAtTime(volume * sustain, end);
    ramp(envelope.gain, 0, stopTime);
    connect(carrier, envelope);
    let node = envelope;
    nodes.push(envelope);
    if (Number(v.distort) > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve(v.distort);
      shaper.oversample = '2x';
      connect(node, shaper); node = shaper;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(v.cutoff ?? 7000, 80, 16000), start);
    filter.Q.setValueAtTime(clamp(v.resonance ?? 0.7, 0.1, 8), start);
    connect(node, filter); node = filter;
    const pan = ctx.createStereoPanner?.() || ctx.createGain();
    if (pan.pan) pan.pan.setValueAtTime(clamp((v.pan ?? 0.5) * 2 - 1, -1, 1), start);
    connect(node, pan); node = pan;
    connect(node, this.output);
    const auxiliaries = [];
    if (Number(v.fmi) > 0) {
      const mod = ctx.createOscillator(), depth = ctx.createGain();
      mod.type = 'sine';
      const harmonicity = clamp(v.fmh ?? 2, 0.1, 12);
      mod.frequency.setValueAtTime(hz * harmonicity, start);
      const fmAmount = clamp(v.fmi, 0, 12) * hz * harmonicity;
      depth.gain.setValueAtTime(0, start);
      ramp(depth.gain, fmAmount, start + 0.005);
      ramp(depth.gain, fmAmount * clamp(v.fmsustain ?? 0, 0, 1), Math.min(end, start + clamp(v.fmdecay ?? 0.3, 0.01, 6)));
      depth.gain.setValueAtTime(fmAmount * clamp(v.fmsustain ?? 0, 0, 1), end);
      ramp(depth.gain, 0, stopTime);
      mod.connect(depth).connect(carrier.frequency);
      nodes.push(mod, depth); auxiliaries.push(mod);
    }
    if (Number(v.lpdepth) > 0 && Number(v.lprate) > 0) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.setValueAtTime(clamp(v.lprate, 0.02, 4), start);
      depth.gain.setValueAtTime(clamp(v.cutoff ?? 7000, 80, 16000) * clamp(v.lpdepth, 0, 2) * 0.45, start);
      lfo.connect(depth).connect(filter.frequency);
      nodes.push(lfo, depth); auxiliaries.push(lfo);
    }
    let tail = 0;
    if (Number(v.delay) > 0) {
      const delayTime = clamp(v.delaytime ?? 0.25, 0.01, 2);
      const delay = ctx.createDelay(2), feedback = ctx.createGain(), wet = ctx.createGain();
      delay.delayTime.setValueAtTime(delayTime, start);
      feedback.gain.setValueAtTime(0.28, start);
      wet.gain.setValueAtTime(clamp(v.delay, 0, 0.5), start);
      node.connect(delay);delay.connect(wet).connect(this.output);delay.connect(feedback).connect(delay);
      nodes.push(delay, wet, feedback);
      tail = Math.min(3, delayTime * 6);
    }
    const voice = {nodes, carrier, auxiliaries, timer:null};
    if (this.voices.size >= this.maxVoices) this.disposeVoice(this.voices.values().next().value);
    this.voices.add(voice);
    carrier.onended = () => {
      // Echo requires a short grace period after the oscillator stops.
      if (tail) voice.timer = setTimeout(() => this.disposeVoice(voice), tail * 1000);
      else this.disposeVoice(voice);
    };
    for (const osc of [carrier, ...auxiliaries]) { osc.start(start); osc.stop(stopTime + 0.01); }
  }

  disposeVoice(voice) {
    if (!voice || !this.voices.delete(voice)) return;
    clearTimeout(voice.timer);
    voice.carrier.onended = null;
    for (const oscillator of [voice.carrier, ...voice.auxiliaries]) {
      try { oscillator.stop(); } catch { /* already ended */ }
    }
    for (const node of voice.nodes) { try { node.disconnect(); } catch { /* torn down */ } }
  }

  dispose() {
    for (const voice of [...this.voices]) this.disposeVoice(voice);
    this.output.disconnect();
  }
}
