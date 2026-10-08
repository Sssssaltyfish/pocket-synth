import assert from 'node:assert/strict';
import {NativeSynthOutput} from '../src/native-engine.js';

class Param {
  events=[];
  setValueAtTime(value,time){this.events.push(['set',value,time]);}
  linearRampToValueAtTime(value,time){this.events.push(['ramp',value,time]);}
}
class Node {
  constructor(type,registry){this.kind=type;this.type=type;this.registry=registry;this.connections=[];this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.started=false;this.stopped=false;registry.push(this);}
  connect(to){this.connections.push(to);return to;}
  disconnect(){this.connections=[];}
  start(){this.started=true;}
  stop(){this.stopped=true;}
}
class Context {
  constructor(){this.currentTime=2;this.nodes=[];}
  node(type){return new Node(type,this.nodes);}
  createGain(){return this.node('gain');}
  createOscillator(){return this.node('oscillator');}
  createBiquadFilter(){return this.node('filter');}
  createWaveShaper(){return this.node('shaper');}
  createStereoPanner(){return this.node('pan');}
  createDelay(){return this.node('delay');}
}
const ctx=new Context();const native=new NativeSynthOutput(ctx,48);
const sounds=[
  {note:41,s:'sine',gain:.14,attack:.005,decay:.34,sustain:.45,release:.11,cutoff:330},
  {note:53,s:'sawtooth',gain:.10,attack:.005,decay:.21,sustain:.22,release:.13,cutoff:2600,resonance:2.7,fmi:3.4,fmh:1.43,fmdecay:.19,fmsustain:.06,distort:.86,lpdepth:1.24,lprate:1.3},
  {note:65,s:'square',gain:.0475,attack:.005,decay:.09,sustain:.02,release:.24,cutoff:9500,fmi:6.8,fmh:3.71,delay:.17,delaytime:60/138*.5}
];
for(const sound of sounds)native.trigger(sound,ctx.currentTime+.1,.35);
assert.equal(native.voices.size,3);
assert(ctx.nodes.some(n=>n.kind==='shaper' && n.curve.length===2048));
assert(ctx.nodes.some(n=>n.kind==='delay'));
assert(ctx.nodes.some(n=>n.kind==='pan'));
assert(ctx.nodes.filter(n=>n.kind==='oscillator'&&n.started).length>=5);
for(let i=0;i<60;i++)native.trigger(sounds[0],ctx.currentTime,.05);
assert.equal(native.voices.size,48,'bounded polyphony');
native.dispose();assert.equal(native.voices.size,0);
assert(ctx.nodes.filter(n=>n.kind==='oscillator').every(n=>n.stopped));
console.log('PASS native fallback: 3-layer stress patch, FM, drive, LFO, echo, bounded 48-voice polyphony, full cleanup');
