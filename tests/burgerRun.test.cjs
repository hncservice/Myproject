'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const rules=require('../server/features/games/burger-run/burgerRunRules');
const assessment=require('../server/features/games/burger-run/burgerRunAssessment');
function winning(seed=1991){
 const s=rules.create(seed),world=rules.level(seed),inputs=[];let previous=-1;
 while(s.phase==='playing'){
  const obstacle=world.obstacles.find(o=>rules.obstacleX(o,s.tick)>s.x+30&&rules.obstacleX(o,s.tick)<s.x+115);
  const mask=2|(s.grounded&&obstacle?4:0);
  if(mask!==previous){inputs.push([s.tick,mask]);previous=mask;}
  rules.step(s,mask,world);
 }
 return {state:s,inputs,ticks:s.tick};
}
function load(file,dependencies){
 const module={exports:{}};
 const context={module,exports:module.exports,require:name=>{if(!(name in dependencies))throw Error(`Unmocked dependency: ${name}`);return dependencies[name];},Buffer,process:{env:{JWT_SECRET:'test-only-secret'}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return module.exports;
}
const plain=x=>JSON.parse(JSON.stringify(x));
test('client and server simulation implementations are identical',async()=>{
 const client=await import('../client/src/features/games/burger-run/burgerRunRules.mjs');
 for(const seed of [0,1,1991,0xffffffff]){const run=winning(seed);assert.deepEqual(client.replay(seed,run.ticks,run.inputs),run.state);}
 const frontend=fs.readFileSync(path.join(root,'client/src/features/games/burger-run/burgerRunRules.mjs'),'utf8').replace(/\nexport \{[^]*$/,'').trim();
 const backend=fs.readFileSync(path.join(root,'server/features/games/burger-run/burgerRunRules.js'),'utf8').replace(/^'use strict';\n/,'').replace(/\nmodule.exports =[^]*$/,'').trim();assert.equal(frontend,backend);
});
test('level remains winnable across 100 seeds with bounded input evidence',()=>{
 for(let seed=0;seed<100;seed++){const r=winning(seed);assert.equal(r.state.phase,'won');assert.ok(r.state.collected.length>=10);assert.ok(r.inputs.length<=rules.RULES.maxInputs);assert.deepEqual(rules.replay(seed,r.ticks,r.inputs),r.state);}
});
test('stationary run times out without qualifying',()=>{const s=rules.replay(1,5400,[[0,0]]);assert.equal(s.phase,'lost');assert.equal(s.score,0);});
test('running into obstacles consumes hearts and loses',()=>{const s=rules.create(7),w=rules.level(7);while(s.phase==='playing')rules.step(s,2,w);assert.equal(s.phase,'lost');assert.equal(s.hearts,0);});
test('jump is edge triggered; holding jump does not auto-repeat',()=>{const s=rules.create(1),w=rules.level(1);for(let i=0;i<100;i++)rules.step(s,4,w);assert.equal(s.grounded,true);assert.equal(s.y,332);rules.step(s,0,w);rules.step(s,4,w);assert.ok(s.vy<0);});
test('left boundary and opposing directions remain bounded',()=>{const s=rules.create(1),w=rules.level(1);for(let i=0;i<200;i++)rules.step(s,1,w);assert.equal(s.x,0);const x=s.x;for(let i=0;i<100;i++)rules.step(s,3,w);assert.equal(s.x,x);});
test('finish without required food cannot qualify',()=>{const s=rules.create(1),w=rules.level(1);s.x=w.finish;rules.step(s,0,w);assert.equal(s.phase,'lost');});
test('reject malformed, excessive and post-finish input traces',()=>{
 for(const [ticks,inputs] of [[0,[[0,0]]],[5401,[[0,0]]],[5,[]],[5,[[1,0]]],[5,[[0,8]]],[5,[[0,NaN]]],[5,[[0,0],[0,2]]],[5,[[0,0],[5,2]]],[5,[[0,0,1]]],[500,Array.from({length:257},(_,i)=>[i,2])]])assert.throws(()=>rules.replay(1,ticks,inputs));
 const r=winning();assert.throws(()=>rules.replay(1991,r.ticks+1,r.inputs));assert.throws(()=>rules.level(-1));
});
function fixture(){
 const r=winning(),end=new Date(),start=new Date(end-30000),play=new Date(end-25000);
 return {_id:'a'.repeat(24),userId:'b'.repeat(24),campaignId:'test-campaign',gameId:'burger-run',status:'completed',outcome:'qualified',score:r.state.score,startedAt:start,completedAt:end,expiresAt:new Date(+start+120000),gameState:{kind:'burger-run',version:1,phase:'finished',seed:1991,playStartedAt:play,ticks:r.ticks,inputs:r.inputs,result:rules.summary(r.state)},events:[{type:'burger-run-finish',serverAt:end,ticks:r.ticks,food:r.state.collected.length,score:r.state.score}]};
}
test('consistent qualifying run still requires pilot admin review',()=>{assert.deepEqual(assessment.assessIntegrity(fixture()),{assessmentVersion:2,reviewRequired:true,riskReasons:['BURGER_RUN_PILOT_REVIEW']});assert.equal(assessment.assessBehavior().enforcementAllowed,false);});
test('assessment detects score, timing, event and replay tampering',()=>{
 const s=fixture();s.score=999;assert.ok(assessment.assessIntegrity(s).riskReasons.includes('BURGER_RUN_SCORE_MISMATCH'));
 s.gameState.playStartedAt=new Date(+s.completedAt-10);assert.ok(assessment.assessIntegrity(s).riskReasons.includes('BURGER_RUN_TIMING_MISMATCH'));
 s.events=[];assert.ok(assessment.assessIntegrity(s).riskReasons.includes('BURGER_RUN_EVENT_MISMATCH'));
 s.gameState.inputs=[[0,999]];assert.ok(assessment.assessIntegrity(s).riskReasons.includes('BURGER_RUN_EVIDENCE_INVALID'));
});
function harness(options={}){
 const completed=fixture();let row={...completed,status:'active',outcome:null,score:0,completedAt:null,events:[],gameState:options.prepared===false?null:{kind:'burger-run',version:1,phase:'playing',seed:1991,playStartedAt:new Date(Date.now()-25000)}};
 const token=crypto.createHmac('sha256','test-only-secret').update(`${row._id}:${row.userId}:${row.campaignId}:burger-run`).digest('hex');row.sessionTokenHash=crypto.createHash('sha256').update(token).digest('hex');
 let writes=0,decisions=0,eligibility=0;
 function matches(q){return row&&Object.entries(q).every(([k,v])=>{const a=k.split('.').reduce((a,x)=>a?.[x],row);return v&&v.$gt!==undefined?+a>+v.$gt:String(a)===String(v);});}
 const query=value=>({select:()=>Promise.resolve(value)});
 const model={findOne:q=>query(matches(q)?structuredClone(row):null),updateOne:async(q,u)=>{if(matches(q)){Object.assign(row,u.$set);writes++;}},findOneAndUpdate:async(q,u)=>{if(options.race){row={...completed,sessionTokenHash:row.sessionTokenHash};return null;}if(!matches(q))return null;Object.assign(row,u.$set);writes++;return structuredClone(row);}};
 const service=load('server/features/games/services/burgerRunGameplayService.js',{'node:crypto':crypto,mongoose:{isValidObjectId:v=>/^[a-f0-9]{24}$/.test(String(v))},'../models/GameSession':model,'../../../config/gameConfig':{CAMPAIGN_POLICY:{campaignId:'test-campaign'}},'./gameStartService':{checkCustomerEligibility:async()=>{eligibility++;if(options.blocked)throw Object.assign(Error('blocked'),{code:'PRIZE_ALREADY_AWARDED'});}},'./gameCompletionDecisionService':{processQualifiedCompletion:async()=>{decisions++;return {status:'pending_review'};}},'../burger-run/burgerRunRules':rules});
 return {service,body:{sessionId:row._id,sessionToken:token},user:row.userId,get row(){return row;},set row(v){row=v;},counts:()=>({writes,decisions,eligibility})};
}
test('prepare initializes seed once and resumes same session',async()=>{const h=harness({prepared:false});const a=await h.service.prepare(h.user,h.body),b=await h.service.prepare(h.user,h.body);assert.equal(a.resumed,false);assert.equal(b.resumed,true);assert.equal(a.seed,b.seed);assert.equal(h.counts().writes,1);assert.equal(a.sessionToken,undefined);});
test('ownership, token and strict body checks reject writes',async()=>{
 const h=harness();await assert.rejects(h.service.prepare('c'.repeat(24),h.body),{code:'SESSION_NOT_FOUND'});await assert.rejects(h.service.prepare(h.user,{...h.body,sessionToken:'0'.repeat(64)}),{code:'INVALID_SESSION_TOKEN'});await assert.rejects(h.service.finish(h.user,{...h.body,score:1000}),{code:'INVALID_GAME_REQUEST'});h.row.campaignId='other';await assert.rejects(h.service.prepare(h.user,h.body),{code:'SESSION_NOT_FOUND'});assert.equal(h.counts().writes,0);
});
test('expired session and existing campaign prize reject gameplay',async()=>{const h=harness();h.row.expiresAt=new Date(Date.now()-1);await assert.rejects(h.service.prepare(h.user,h.body),{code:'SESSION_EXPIRED'});assert.equal(h.row.status,'expired');const blocked=harness({blocked:true});await assert.rejects(blocked.service.prepare(blocked.user,blocked.body),{code:'PRIZE_ALREADY_AWARDED'});assert.equal(blocked.counts().writes,0);});
test('fast finish and malformed evidence fail without completing',async()=>{const h=harness(),r=winning();h.row.gameState.playStartedAt=new Date();await assert.rejects(h.service.finish(h.user,{...h.body,ticks:r.ticks,inputs:r.inputs}),{code:'GAME_TOO_FAST'});await assert.rejects(h.service.finish(h.user,{...h.body,ticks:10,inputs:[[0,9]]}),{code:'INVALID_REPLAY'});assert.equal(h.counts().writes,0);});
test('playing run cannot be submitted as a completed result',async()=>{const h=harness();await assert.rejects(h.service.finish(h.user,{...h.body,ticks:10,inputs:[[0,0]]}),{code:'GAME_NOT_FINISHED'});assert.equal(h.counts().writes,0);});
test('valid winning run is server-scored and repeated finish is idempotent',async()=>{const h=harness(),r=winning();const body={...h.body,ticks:r.ticks,inputs:r.inputs};const a=await h.service.finish(h.user,body);assert.equal(a.outcome,'qualified');assert.equal(a.score,r.state.score);assert.deepEqual(plain(assessment.assessIntegrity(h.row).riskReasons),['BURGER_RUN_PILOT_REVIEW']);const b=await h.service.finish(h.user,body);assert.equal(b.resumed,true);assert.equal(h.counts().writes,1);assert.equal(h.counts().decisions,1);});
test('concurrent finish returns committed session without second write',async()=>{const h=harness({race:true}),r=winning();const a=await h.service.finish(h.user,{...h.body,ticks:r.ticks,inputs:r.inputs});assert.equal(a.status,'completed');assert.equal(a.resumed,true);assert.equal(h.counts().decisions,0);});
test('loss completes without qualification',async()=>{const h=harness();h.row.gameState.playStartedAt=new Date(Date.now()-95000);const a=await h.service.finish(h.user,{...h.body,ticks:5400,inputs:[[0,0]]});assert.equal(a.outcome,'not-qualified');assert.equal(a.score,0);assert.equal(h.row.events.length,1);});
test('legacy adapter preserves Perfect Shot argument and return identity',()=>{
 const {createLegacyGameEngine}=require('../server/features/games/engine/legacyGameEngineFactory');let args;const expected={ok:true};const services={registry:{find:()=>({execution:'legacy'}),require:()=>({actions:['shoot','prepare','finish']})},sessions:{},start:{},status:{},monkey:{},perfectShot:{shoot:(...a)=>{args=a;return expected;}},burgerRun:{prepare:(u,b)=>({u,b}),finish:()=>expected}};
 const engine=createLegacyGameEngine(services),body={shot:1};assert.equal(engine.perfectShot.shoot('u',body,123),expected);assert.deepEqual(args,['u',body,123]);assert.equal(engine.burgerRun.finish('u',{}),expected);assert.equal(createLegacyGameEngine({...services,burgerRun:undefined}).burgerRun,undefined);
});
test('new actions follow auth middleware and customer route is protected',()=>{
 const routes=fs.readFileSync(path.join(root,'server/features/games/routes/gameRoutes.js'),'utf8');assert.ok(routes.indexOf('router.use(authUser)')<routes.indexOf("router.post('/burger-run/prepare'"));assert.ok(routes.indexOf('router.use(authUser)')<routes.indexOf("router.post('/burger-run/finish'"));const front=fs.readFileSync(path.join(root,'client/src/app/routes/AppRoutes.jsx'),'utf8');assert.match(front,/path="\/user\/burger-run" element={<ProtectedRoute allowedRole="user"/);
});
test('renderer runs across narrow, tablet and desktop canvas sizes',async()=>{
 const {drawGame}=await import('../client/src/features/games/burger-run/burgerRunRenderer.mjs');
 let calls=0;const gradient={addColorStop(){}};
 const ctx=new Proxy({createLinearGradient:()=>gradient},{get(target,key){return key in target?target[key]:(...args)=>{assert.ok(args.every(a=>typeof a!=='number'||Number.isFinite(a)),`Invalid draw ${String(key)}`);calls++;};},set(target,key,value){target[key]=value;return true;}});
 for(const width of [240,320,375,768,1080]){const canvas={clientWidth:width,clientHeight:280,width:0,height:0,getContext:()=>ctx};const run=winning();drawGame(canvas,rules.create(1991),rules.level(1991));drawGame(canvas,run.state,rules.level(1991));assert.equal(canvas.width,width);assert.equal(canvas.height,280);}
 assert.ok(calls>100);
});
