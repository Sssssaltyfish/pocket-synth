// Pocket Synth 3 · AGPL-3.0-or-later. Actual Strudel Cyclist + SuperDough audio.
import {Cyclist} from '@strudel/core';
import {webaudioOutput,initAudio,registerSynthSounds,getAudioContext,getSuperdoughAudioController,resetGlobalEffects} from '@strudel/webaudio';
import {buildPattern} from './sound.js';
import {loadOfficialWorklets} from './worklet-loader.js';
export class SynthPlayer {
 constructor(onState=()=>{},onError=()=>{}) {this.onState=onState;this.onError=onError;this.volume=.16;this.generation=0;this.running=false;this.starting=false;this.scheduler=null;this.timer=null;this.ctx=null;this.meter=null;}
 async play(definition,loop=true) {
  if(this.starting)return;
  if(this.running){this.update(definition);return;}
  const pattern=buildPattern(definition),ticket=++this.generation;this.starting=true;this.onState('Starting');
  try {
   registerSynthSounds();this.ctx=getAudioContext();await this.ctx.resume();
   if(ticket!==this.generation)return;
   // Keep upstream synthesis and FX; only replace its data-URL module loader.
   await initAudio({maxPolyphony:48,disableWorklets:true});
   if(ticket!==this.generation)return;
   await loadOfficialWorklets(this.ctx);
   if(ticket!==this.generation)return;
   if(this.ctx.state!=='running')throw Error('Audio is suspended. Press Play again to unlock it.');
   this.installOutput();
   const scheduler=new Cyclist({getTime:()=>this.ctx.currentTime,onTrigger:(hap,deadline,duration,cps,t)=>{if(this.running&&ticket===this.generation)webaudioOutput(hap,deadline,Math.min(10,duration*(hap.value.legato??1)),cps,t).catch(e=>{if(ticket===this.generation)this.fail(e)});},onError:e=>{if(ticket===this.generation)this.fail(e)}});
   this.scheduler=scheduler;
   scheduler.setCps(definition.bpm/240);await scheduler.setPattern(pattern);
   if(ticket!==this.generation){scheduler.stop();return;}
   this.running=true;await scheduler.start();
   if(ticket!==this.generation){scheduler.stop();return;}
   this.starting=false;this.onState('Playing');this.definition=definition;this.loop=loop;this.armEnd();
  }catch(e){if(ticket===this.generation)this.fail(new Error('Audio could not start: '+e.message,{cause:e}));}
 }
 installOutput(){const output=getSuperdoughAudioController().output.destinationGain;output.disconnect();output.gain.value=this.volume;this.compressor=this.ctx.createDynamicsCompressor();this.compressor.threshold.value=-9;this.compressor.knee.value=6;this.compressor.ratio.value=20;this.compressor.attack.value=.003;this.compressor.release.value=.15;this.meter=this.ctx.createAnalyser();this.meter.fftSize=1024;output.connect(this.compressor).connect(this.meter).connect(this.ctx.destination);this.output=output;}
 update(definition){const pattern=buildPattern(definition);this.definition=definition;if(this.running){this.scheduler.setCps(definition.bpm/240);this.scheduler.setPattern(pattern);this.armEnd();}}
 armEnd(){clearTimeout(this.timer);if(!this.loop&&this.running){const remaining=Math.max(0,this.definition.cycles-this.scheduler.now())*240/this.definition.bpm;this.timer=setTimeout(()=>this.stop(),remaining*1000+120);}}
 setLoop(loop){this.loop=loop;this.armEnd();}
 setVolume(volume){this.volume=Math.max(0,Math.min(.35,volume));if(this.output)this.output.gain.setTargetAtTime(this.volume,this.ctx.currentTime,.02);}
 stop(){++this.generation;clearTimeout(this.timer);this.scheduler?.stop();this.scheduler=null;this.running=false;this.starting=false;if(this.output){this.output.gain.cancelScheduledValues(this.ctx.currentTime);this.output.gain.value=0;}if(this.ctx){resetGlobalEffects();this.compressor?.disconnect();this.meter?.disconnect();}this.output=null;this.meter=null;this.onState('Stopped');}
 fail(error){this.stop();this.onError(error);}
 position(){return Math.max(0,this.scheduler?.now()||0);}
}
