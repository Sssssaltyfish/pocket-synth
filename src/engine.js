// Pocket Synth 3 · AGPL-3.0-or-later. Strudel Cyclist and SuperDough with a native fallback.
import {Cyclist} from '@strudel/core';
import {webaudioOutput,initAudio,loadWorklets,registerSynthSounds,getAudioContext,getSuperdoughAudioController,resetGlobalEffects} from '@strudel/webaudio';
import {buildPattern} from './sound.js';
import {NativeSynthOutput} from './native-engine.js';

const message = e => e?.message || String(e);
// SuperDough bundles its worklets as data: URLs. Some ChatGPT iframe CSPs
// prohibit that scheme even when normal Web Audio nodes remain available.
let probeNumber = 0;
async function canLoadDataWorklets(ctx) {
  if (!ctx.audioWorklet?.addModule || typeof AudioWorkletNode === 'undefined') return false;
  const name = `pocket-synth-probe-${++probeNumber}`;
  const script = `registerProcessor('${name}',class extends AudioWorkletProcessor{process(){return false}})`;
  try {
    await ctx.audioWorklet.addModule(`data:text/javascript;base64,${btoa(script)}`);
    return true;
  } catch { return false; }
}

// SuperDough 1.3.0 silently consumes rejections from loadWorklets(). Track
// addModule promises ourselves so partial registrations cannot masquerade as success.
async function initializeWorklets(ctx) {
  const worklet = ctx.audioWorklet;
  const original = worklet.addModule;
  const jobs = [];
  let observing = false;
  try {
    worklet.addModule = function (...args) {
      const job = original.apply(this, args);
      jobs.push(Promise.resolve(job));
      return job;
    };
    observing = worklet.addModule !== original;
    if (!observing) throw Error('AudioWorklet registration cannot be observed');
    await initAudio({maxPolyphony:48, disableWorklets:true});
    await loadWorklets();
    const results = await Promise.allSettled(jobs);
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
  } finally {
    if (observing) {
      try { delete worklet.addModule; } catch { worklet.addModule = original; }
    }
  }
}

export class SynthPlayer {
 constructor(onState=()=>{},onError=()=>{}) {this.onState=onState;this.onError=onError;this.volume=.16;this.generation=0;this.running=false;this.starting=false;this.scheduler=null;this.timer=null;this.ctx=null;this.meter=null;this.native=null;this.mode=null;this.forceNative=false;}
 async play(definition,loop=true) {
  if(this.starting)return;
  if(this.running){this.update(definition);return;}
  const pattern=buildPattern(definition),ticket=++this.generation;this.starting=true;this.onState('Starting');
  try {
   registerSynthSounds();this.ctx=getAudioContext();await this.ctx.resume();
   if(ticket!==this.generation)return;
   let ready=false;
   if(!this.forceNative && await canLoadDataWorklets(this.ctx)) {
     if(ticket!==this.generation)return;
     try {await initializeWorklets(this.ctx);ready=true;}catch(e){console.warn('Pocket Synth: worklet effects unavailable, using native audio nodes:',message(e));}
   }
   if(ticket!==this.generation)return;
   if(this.ctx.state!=='running')throw Error('Audio is suspended. Press Play again to unlock it.');
   this.mode=ready?'superdough':'native';
   if(!ready){this.forceNative=true;this.native=new NativeSynthOutput(this.ctx);}
   this.installOutput(ready?getSuperdoughAudioController().output.destinationGain:this.native.output);
   this.scheduler=new Cyclist({getTime:()=>this.ctx.currentTime,onTrigger:(hap,deadline,duration,cps,t)=>{
     if(!this.running)return;
     const length=Math.min(10,duration*(hap.value.legato??1));
     if(this.mode==='native'){
       try{this.native.trigger(hap.value,t,length);}catch(e){this.fail(e);}
     }else webaudioOutput(hap,deadline,length,cps,t).catch(e=>this.fail(e));
   },onError:e=>this.fail(e)});
   this.scheduler.setCps(definition.bpm/240);await this.scheduler.setPattern(pattern);this.running=true;await this.scheduler.start();
   if(ticket!==this.generation){this.scheduler?.stop();return;}
   this.starting=false;this.onState(ready?'Playing':'Playing (native)');this.definition=definition;this.loop=loop;this.armEnd();
  }catch(e){if(ticket===this.generation)this.fail(new Error('Audio could not start: '+message(e)));}
 }
 installOutput(output){output.disconnect();output.gain.value=this.volume;this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-9;this.compressor.knee.value=6;this.compressor.ratio.value=20;this.compressor.attack.value=.003;this.compressor.release.value=.15;this.meter=this.ctx.createAnalyser();this.meter.fftSize=1024;output.connect(this.compressor).connect(this.meter).connect(this.ctx.destination);this.output=output;}
 update(definition){const pattern=buildPattern(definition);this.definition=definition;if(this.running){this.scheduler.setCps(definition.bpm/240);this.scheduler.setPattern(pattern);this.armEnd();}}
 armEnd(){clearTimeout(this.timer);if(!this.loop&&this.running){const remaining=Math.max(0,this.definition.cycles-this.scheduler.now())*240/this.definition.bpm;this.timer=setTimeout(()=>this.stop(),remaining*1000+120);}}
 setLoop(loop){this.loop=loop;this.armEnd();}
 setVolume(volume){this.volume=Math.max(0,Math.min(.35,volume));if(this.output)this.output.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.02);}
 stop(){++this.generation;clearTimeout(this.timer);this.scheduler?.stop();this.scheduler=null;this.running=false;this.starting=false;if(this.output){this.output.gain.cancelScheduledValues(this.ctx.currentTime);this.output.gain.value=0;}if(this.ctx){if(this.mode==='superdough')resetGlobalEffects();this.compressor?.disconnect();this.meter?.disconnect();}this.native?.dispose();this.native=null;this.mode=null;this.output=null;this.meter=null;this.onState('Stopped');}
 fail(error){this.stop();this.onError(error);}
 position(){return Math.max(0,this.scheduler?.now()||0);}
}
