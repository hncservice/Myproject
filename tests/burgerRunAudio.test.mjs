import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBurgerRunAudio } from '../client/src/features/games/burger-run/burgerRunAudio.mjs';
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(fetchOverride) {
  const played = [], gains = []; let closed = false, resumes = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  function source(kind) { return { kind, connect() {}, disconnect() {}, loop: false, stops: 0, start() { played.push(this); }, stop() { this.stops++; this.onended?.(); }, frequency: parameter() }; }
  const context = { state: 'suspended', currentTime: 1, destination: {}, resume() { this.state = 'running'; resumes++; return Promise.resolve(); }, close() { closed = true; this.state = 'closed'; return Promise.resolve(); }, decodeAudioData: async bytes => bytes,
    createBufferSource: () => source('sample'), createOscillator: () => source('jump'), createGain: () => { const gain = { gain: parameter(), connect() {}, disconnect() {} }; gains.push(gain); return gain; } };
  let fetched = 0;
  const audio = createBurgerRunAudio({ background:'bg', start:'start', collect:'collect', hit:'hit', win:'win', lose:'lose' }, { makeContext: () => context, fetch: fetchOverride || (async () => { fetched++; return { ok:true, arrayBuffer:async()=>new ArrayBuffer(4) }; }) });
  return { audio, played, gains, get fetched() { return fetched; }, get closed() { return closed; }, get resumes() { return resumes; } };
}
test('does not start audio or requests before user begins',async()=>{ const h=setup();h.audio.setActive(false);await settle();assert.equal(h.played.length,0);assert.equal(h.fetched,0);h.audio.dispose(); });
test('starts one medium-volume background loop and reuses decoded buffers',async()=>{ const h=setup();h.audio.begin();await settle();assert.equal(h.played.filter(s=>s.loop).length,1);assert.ok(h.gains.some(g=>g.gain.value===0.30));h.audio.setActive(true);await settle();assert.equal(h.played.filter(s=>s.loop).length,1);const count=h.fetched;await h.audio.play('collect');await h.audio.play('collect');assert.equal(h.fetched,count);h.audio.dispose(); });
test('pause stops music and resume can start it again',async()=>{ const h=setup();h.audio.begin();await settle();const bg=h.played.find(s=>s.loop);h.audio.setActive(false);assert.equal(bg.stops,1);h.audio.unlock();h.audio.setActive(true);await settle();assert.equal(h.played.filter(s=>s.loop).length,2);h.audio.dispose(); });
test('mute stops sources and suppresses effects until enabled',async()=>{ const h=setup();h.audio.begin();await settle();h.audio.setEnabled(false);const count=h.played.length;await h.audio.play('hit');h.audio.jump();assert.equal(h.played.length,count);assert.ok(h.played.every(s=>s.stops>0));h.audio.setEnabled(true);await settle();assert.ok(h.played.length>count);h.audio.dispose(); });
test('jump and result effects do not create additional background loops',async()=>{ const h=setup();h.audio.begin();await settle();h.audio.jump();await h.audio.play('win');await h.audio.play('lose');assert.equal(h.played.filter(s=>s.kind==='jump').length,1);assert.equal(h.played.filter(s=>s.loop).length,1);h.audio.dispose();assert.equal(h.closed,true);const count=h.played.length;await h.audio.play('collect');h.audio.begin();await settle();assert.equal(h.played.length,count); });
test('audio download failure does not throw into gameplay',async()=>{ const h=setup(async()=>{throw Error('offline');});h.audio.begin();await settle();await h.audio.play('collect');assert.equal(h.played.length,0);h.audio.dispose(); });
test('unmount while loading prevents delayed background playback',async()=>{ let release;const h=setup(()=>new Promise(resolve=>{release=resolve;}));h.audio.begin();h.audio.dispose();release({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();assert.equal(h.played.length,0);assert.equal(h.closed,true); });
