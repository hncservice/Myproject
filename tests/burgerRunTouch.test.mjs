import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunnerInput, createSwipeJump } from '../client/src/features/games/burger-run/burgerRunControls.mjs';
import { gameViewport, drawGame } from '../client/src/features/games/burger-run/burgerRunRenderer.mjs';
import { level, create, step, replay, obstacleX } from '../client/src/features/games/burger-run/burgerRunRules.mjs';

test('two controls can move and jump simultaneously',()=>{const c=createRunnerInput();c.set('finger:1','right');c.set('finger:2','jump');assert.equal(c.nextMask(),6);c.remove('finger:2');assert.equal(c.nextMask(),2);});
test('releasing a finger does not release a held keyboard input',()=>{const c=createRunnerInput();c.set('key:ArrowRight','right');c.set('pointer:1','right');c.remove('pointer:1');assert.equal(c.peekMask(),2);c.remove('key:ArrowRight');assert.equal(c.peekMask(),0);});
test('jump swipe pulse expires by simulation ticks without timers',()=>{const c=createRunnerInput();c.set('pointer:1','right');c.queueJump();for(let i=0;i<8;i++)assert.equal(c.nextMask(),6);assert.equal(c.nextMask(),2);});
test('pause and blur clear held controls and queued jumps',()=>{const c=createRunnerInput();c.set('finger:1','left');c.queueJump();c.clear();assert.equal(c.nextMask(),0);});
test('swipe up triggers during move and once per gesture',()=>{const s=createSwipeJump();s.start(4,100,200,0);assert.equal(s.move(4,103,179,50),false);assert.equal(s.move(4,104,164,90),true);assert.equal(s.move(4,104,110,120),false);s.end(4);assert.equal(s.move(4,104,80,140),false);});
test('downward, horizontal, tiny, expired and reversed-time gestures do not jump',()=>{for(const [x,y,t] of [[100,240,80],[140,170,80],[101,180,80],[100,160,701],[100,160,-1]]){const s=createSwipeJump();s.start(1,100,200,0);assert.equal(s.move(1,x,y,t),false);}});
test('multiple swipe fingers and cancellation stay independent',()=>{const s=createSwipeJump();s.start(1,10,90,0);s.start(2,50,90,0);s.end(1);assert.equal(s.move(1,10,40,80),false);assert.equal(s.move(2,50,40,80),true);s.clear();assert.equal(s.move(2,50,0,90),false);});
test('opposing directions remain explicit and unknown controls are ignored',()=>{const c=createRunnerInput();c.set(1,'left');c.set(2,'right');c.set(3,'up');assert.equal(c.peekMask(),3);});
test('touch-generated input remains valid under unchanged server replay',()=>{
 for(let seed=0;seed<50;seed++){
  const s=create(seed),w=level(seed),c=createRunnerInput(),inputs=[];let previous=-1;c.set('pointer:1','right');
  while(s.phase==='playing'){
   const o=w.obstacles.find(o=>obstacleX(o,s.tick)>s.x+30&&obstacleX(o,s.tick)<s.x+115);
   if(s.grounded&&o)c.queueJump();const mask=c.nextMask();if(mask!==previous){inputs.push([s.tick,mask]);previous=mask;}step(s,mask,w);
  }
  assert.equal(s.phase,'won');assert.ok(inputs.length<=256);assert.deepEqual(replay(seed,s.tick,inputs),s);
 }
});
test('viewport keeps a useful view ahead and enlarges portrait character',()=>{
 for(const [width,height] of [[280,360],[320,380],[375,480],[768,600],[1024,640],[1280,580],[780,210]]){
  const v=gameViewport(width,height);assert.ok(v.view>=320);assert.ok(Number.isFinite(v.offsetY));const feet=390*v.scale+v.offsetY;assert.ok(feet>height*.8&&feet<height*.9);assert.ok(113*v.scale+v.offsetY>=0,'highest platform jump stays visible');
 }
 assert.ok(58*gameViewport(375,480).scale>58*280/480);
});
test('renderer preserves simulation data through animations and resize',()=>{
 let calls=0;const context=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get(o,k){return k in o?o[k]:(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)));calls++;};},set(o,k,v){o[k]=v;return true;}});
 const canvas={clientWidth:375,clientHeight:480,width:0,height:0,getContext:()=>context},s=create(1),w=level(1);
 for(let i=0;i<500;i++){step(s,2,w);const before=JSON.stringify(s);if(i===100)canvas.clientWidth=768;drawGame(canvas,s,w);assert.equal(JSON.stringify(s),before);}
 assert.ok(calls>500);assert.equal(canvas.width,768);
});
