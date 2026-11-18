'use strict';
const assert = require('node:assert/strict');
const Joi = require('joi');
const load = require('./helpers/loadAuthSource.cjs');
const run = require('./helpers/runCases.cjs');
const response = () => ({ statusCode: 200, headers: {}, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; }, set(k,v) { this.headers[k] = v; return this; }, setHeader(k,v) { this.headers[k] = v; } });
const query = value => ({ select() { return this; }, sort() { return this; }, skip() { return this; }, limit(n) { this.cap = n; return this; }, populate() { return this; }, session() { return this; }, lean: async () => value, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } });
const aid = 'a'.repeat(24), vid = 'b'.repeat(24);
const safety = load('infrastructure/reporting/reportSafety.js', {});
const metadata = load('infrastructure/logging/errorMetadata.js', {});
function fixture() {
  const calls = { audits: [], fences: [], queries: [], cells: [], emails: 0, redemptions: 0, creates: [] };
  const options = { count: 0, rows: [], revoked: false, exportFailure: false, auditFailure: false };
  const vendor = { _id: vid, name: 'Synthetic Vendor', email: 'vendor@example.com', tokenVersion: 2, isActive: true, save: async () => {} };
  const item = { _id: vid, title: 'Synthetic prize', probabilityWeight: 1, quantityTotal: 10, quantityAllocated: 4, quantityRedeemed: 2, isActive: true, save: async () => {} };
  const Vendor = { findOne: () => query(null), findById: () => query(vendor), find: () => query(options.rows), countDocuments: async () => options.count,
    create: async (rows, opts) => { calls.creates.push({ rows, opts }); return rows.map(r => ({ _id: vid, ...r })); } };
  const Admin = { async findOneAndUpdate(filter, update, opts) { calls.fences.push({ filter, update, opts }); return options.revoked ? null : { _id: aid, prizeReviewFence: 1 }; } };
  const mongoose = { isValidObjectId: v => typeof v === 'string' && /^[a-f0-9]{24}$/.test(v), connection: { readyState: 1, transaction: async fn => fn({ synthetic: true }) } };
  const Audit = { async create(rows, opts) { if (options.auditFailure) throw new Error('synthetic internal error'); calls.audits.push({ rows, opts }); } };
  const model = { find(filter) { calls.queries.push(filter); return query(options.rows); }, countDocuments: async filter => { calls.queries.push(filter); return options.count; }, aggregate: async () => [] };
  const decision = { _id: vid, campaignId: 'synthetic', gameSessionId: 'c'.repeat(24), userId: aid, gameId: 'monkey', status: 'pending_review', riskReasons: ['synthetic integrity finding'] };
  options.gameQualified = true; options.reviewConflict = false;
  const Decision = { findOne: filter => { calls.queries.push(filter); return query(decision.status === 'pending_review' ? decision : null); }, findOneAndUpdate: async (filter, update) => { calls.queries.push(filter); if(options.reviewConflict) return null; Object.assign(decision, update.$set); return decision; } };
  const review = load('features/prizes/services/prizeReviewService.js', { mongoose, '../../administration/models/AdminUser': Admin, '../../administration/models/AdminAuditLog': Audit, '../models/PrizeDecision': Decision, '../../games/models/GameSession': { findOne: filter => { calls.queries.push(filter); return query(options.gameQualified ? {} : null); } }, '../../../config/gameConfig': { CAMPAIGN_POLICY: { campaignId: 'synthetic' } } });
  class Workbook { constructor() { this.xlsx = { writeBuffer: async () => { if (options.exportFailure) throw new Error('synthetic workbook failure'); return Buffer.from('synthetic-workbook'); } }; } addWorksheet() { return { addRow: r => calls.cells.push(r), getRow: () => ({}) }; } }
  const admin = load('features/administration/controllers/adminController.js', { bcrypt: { hash: async v => 'synthetic:' + v }, joi: Joi, exceljs: { Workbook }, mongoose,
    '../../vendors/models/Vendor': Vendor, '../../prizes/models/WheelItem': { ...model, create: Vendor.create, findById: () => query(item) }, '../../games/models/Spin': model, '../../authentication/models/User': {}, '../models/AdminAuditLog': Audit,
    '../../prizes/services/prizeReviewService': review, '../../../infrastructure/reporting/reportSafety': safety, '../../../infrastructure/logging/errorMetadata': metadata });
  const controller = load('features/vendors/controllers/vendorController.js', { joi: Joi, exceljs: { Workbook }, '../../games/models/Spin': model, '../../prizes/models/WheelItem': {},
    '../../../infrastructure/reporting/reportSafety': safety, '../../../infrastructure/logging/errorMetadata': metadata, '../../../infrastructure/email/emailService': { sendRedemptionEmail: async () => { calls.emails++; } },
    '../../prizes/services/prizeRedemptionService': { redeemPrize: async () => { calls.redemptions++; throw Object.assign(new Error('Already redeemed'), { status: 409, code: 'ALREADY_REDEEMED' }); } } });
  const ops = load('features/administration/controllers/adminOperationsController.js', { joi: Joi, '../../games/models/GameSession': model, '../../games/models/Spin': model, '../models/AdminAuditLog': model,
    '../../../config/gameConfig': { CAMPAIGN_POLICY: { campaignId: 'synthetic' } }, '../../games/registry/gameRegistry': { discover: () => [{ id: 'monkey', version: 1 }] } });
  const req = (body = {}, more = {}) => ({ body, query: {}, params: { id: vid }, admin: { _id: aid }, adminTokenVersion: 0, vendor: { _id: vid }, vendorTokenVersion: 2, ...more });
  return { calls, options, vendor, item, admin, controller, review, ops, req };
}
const cases = [
  ['vendor creation is fenced and audited without password disclosure', async () => { const f=fixture(), r=response(); await f.admin.createVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',password:'password'}),r); assert.equal(r.statusCode,201); assert.equal(f.calls.fences.length,1); assert.equal(f.calls.audits[0].rows[0].action,'VENDOR_CREATED'); assert.equal(JSON.stringify(r.body).includes('password'),false); assert.equal(JSON.stringify(f.calls.audits).includes('synthetic:password'),false); }],
  ['revoked administrator cannot create vendor', async () => { const f=fixture(),r=response(); f.options.revoked=true; await f.admin.createVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',password:'password'}),r); assert.equal(r.statusCode,403); assert.equal(f.calls.creates.length,0); }],
  ['failed audit fails creation response closed', async () => { const f=fixture(),r=response(); f.options.auditFailure=true; await f.admin.createVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',password:'password'}),r); assert.equal(r.statusCode,500); assert.deepEqual(r.body,{message:'Server error'}); }],
  ['deactivation revokes sessions and audits no tokens', async () => { const f=fixture(),r=response(); await f.admin.updateVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',isActive:false}),r); assert.equal(r.statusCode,200); assert.equal(f.vendor.tokenVersion,3); assert.equal(f.vendor.isActive,false); assert.ok(f.vendor.disabledAt instanceof Date); assert.equal(f.calls.audits[0].rows[0].details.sessionsRevoked,true); }],
  ['explicit revocation increments once', async () => { const f=fixture(),r=response(); await f.admin.updateVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',revokeSessions:true,password:'password'}),r); assert.equal(r.statusCode,200); assert.equal(f.vendor.tokenVersion,3); }],
  ['ordinary vendor edit preserves token version', async () => { const f=fixture(),r=response(); await f.admin.updateVendor(f.req({name:'Renamed Vendor',email:'vendor@example.com'}),r); assert.equal(r.statusCode,200); assert.equal(f.vendor.tokenVersion,2); }],
  ['version overflow rejects revocation', async () => { const f=fixture(),r=response(); f.vendor.tokenVersion=Number.MAX_SAFE_INTEGER; await f.admin.updateVendor(f.req({name:'Synthetic Vendor',email:'vendor@example.com',revokeSessions:true}),r); assert.equal(r.statusCode,409); assert.equal(f.calls.audits.length,0); }],
  ['prize creation fenced and audited', async () => { const f=fixture(),r=response(); await f.admin.createWheelItem(f.req({title:'Synthetic item',probabilityWeight:1,quantityTotal:0}),r); assert.equal(r.statusCode,201); assert.equal(f.calls.audits[0].rows[0].action,'WHEEL_ITEM_CREATED'); assert.equal(f.calls.fences.length,1); }],
  ['invalid vendor report query rejected before data access', async () => { const f=fixture(),r=response(); await f.controller.getVendorDashboard(f.req({}, {query:{days:'NaN'}}),r); assert.equal(r.statusCode,400); assert.equal(f.calls.queries.length,0); }],
  ['vendor export cannot select another vendor', async () => { const f=fixture(),r=response(); await f.controller.exportVendorRedemptions(f.req({}, {query:{vendorId:aid}}),r); assert.equal(r.statusCode,400); assert.equal(f.calls.queries.length,0); }],
  ['vendor export scope and spreadsheet safety', async () => { const f=fixture(),r=response(); f.options.rows=[{_id:'synthetic-redemption',wheelItemId:{title:'=HYPERLINK()'},userId:{name:'@cmd',email:'synthetic@example.com',phone:'+97412345678'}}]; await f.controller.exportVendorRedemptions(f.req(),r); assert.equal(r.statusCode,200); assert.equal(f.calls.queries.every(q=>q.redeemedByVendorId===vid),true); assert.equal(f.calls.cells[0].prize,"'=HYPERLINK()"); assert.equal(f.calls.cells[0].userPhone,"'+97412345678"); assert.equal(r.headers['Cache-Control'],'no-store'); }],
  ['oversized vendor export rejected', async () => { const f=fixture(),r=response(); f.options.count=5001; await f.controller.exportVendorRedemptions(f.req(),r); assert.equal(r.statusCode,413); assert.equal(f.calls.cells.length,0); }],
  ['export construction failure occurs before attachment headers', async () => { const f=fixture(),r=response(); f.options.exportFailure=true; await f.controller.exportVendorRedemptions(f.req(),r); assert.equal(r.statusCode,500); assert.equal(r.headers['Content-Disposition'],undefined); }],
  ['malformed QR never calls redemption or email port', async () => { const f=fixture(),r=response(); await f.controller.scanQr(f.req({qrToken:'unsafe'}),r); assert.equal(r.statusCode,400); assert.equal(f.calls.redemptions+f.calls.emails,0); }],
  ['missing vendor identity cannot scan', async () => { const f=fixture(),r=response(); await f.controller.scanQr(f.req({qrToken:'a'.repeat(32)}, {vendor:null}),r); assert.equal(r.statusCode,401); assert.equal(f.calls.redemptions,0); }],
  ['duplicate redemption rejection never delivers email', async () => { const f=fixture(),r=response(); await f.controller.scanQr(f.req({qrToken:'a'.repeat(32)}),r); assert.equal(r.statusCode,409); assert.equal(r.body.code,'ALREADY_REDEEMED'); assert.equal(f.calls.emails,0); }],
  ['admin fence checks disabled role version and session', async () => { const f=fixture(); await f.review.claimAdminReviewFence({adminId:aid,adminTokenVersion:0,session:{synthetic:true}}); const c=f.calls.fences[0]; assert.equal(c.filter.disabledAt,null); assert.deepEqual(c.filter.role,{$in:['admin','superadmin']}); assert.equal(c.filter.$or.length,2); assert.equal(c.opts.session.synthetic,true); }],
  ['invalid administrator identity never reaches model', async () => { const f=fixture(); await assert.rejects(f.review.claimAdminReviewFence({adminId:'invalid',adminTokenVersion:0}),{code:'ADMIN_SESSION_INVALID'}); assert.equal(f.calls.fences.length,0); }],
  ['configuration metadata is read-only', async () => { const f=fixture(),r=response(); f.ops.configuration({},r); assert.equal(r.body.readOnly,true); assert.equal(r.body.games[0].id,'monkey'); }],
  ['spreadsheet control characters and formulas sanitized', () => { assert.equal(safety.safeExcelText('\u0000 =1'),"' =1"); assert.equal(safety.safeExcelText(null),''); assert.equal(safety.safeExcelText('x'.repeat(40000)).length,32000); }],
];
for (const name of ['sessions','redemptions','audit']) {
  cases.push([name+' reports are bounded and redact sensitive fields', async () => { const f=fixture(),r=response(); f.options.rows=[{_id:vid,adminId:aid,action:'VENDOR_CREATED',targetType:'Vendor',targetId:vid,userId:aid,gameId:'monkey',status:'completed',qrToken:'secret',sessionTokenHash:'secret',passwordHash:'secret',details:{password:'secret'},email:'customer@example.com'}]; await f.ops[name](f.req({}, {query:{limit:'10',page:'2',q:'.*',sort:'oldest'}}),r); assert.equal(r.statusCode,200); assert.equal(r.body.page,2); assert.equal(JSON.stringify(r.body).includes('secret'),false); assert.equal(JSON.stringify(r.body).includes('customer@example.com'),false); assert.ok(f.calls.queries[0].$or.every(c=>Object.values(c)[0].$regex==='\\.\\*')); if(name==='sessions') assert.equal(f.calls.queries[0].campaignId,'synthetic'); }]);
  cases.push([name+' rejects unbounded or unknown query fields', async () => { const f=fixture(),r=response(); await f.ops[name](f.req({}, {query:{limit:51,includeSecrets:true}}),r); assert.equal(r.statusCode,400); assert.equal(f.calls.queries.length,0); }]);
}
function redemptionFixture() {
  const spin = { _id: 'c'.repeat(24), userId: aid, wheelItemId: vid, status: 'won', redemptionStatus: 'pending', qrExpiry: new Date(Date.now()+60000) };
  const options = { spin, active: true, claim: 1, inventory: 1, award: null };
  const calls = { writes: [], fences: [] };
  const service = load('features/prizes/services/prizeRedemptionService.js', {
    mongoose: { isValidObjectId: id => /^[a-f0-9]{24}$/.test(id), connection: { readyState: 1, transaction: async fn => fn({ synthetic: true }) } },
    '../../games/models/Spin': { findOne: () => query(options.spin), updateOne: async (filter, update, session) => { calls.writes.push({filter,update,session}); return {modifiedCount: options.claim}; } },
    '../models/WheelItem': { findById: () => query({_id:vid,title:'Synthetic prize'}), updateOne: async (filter,update,session) => { calls.writes.push({filter,update,session}); return {modifiedCount:options.inventory}; } },
    '../../authentication/models/User': { findById: () => query({name:'Synthetic user',email:'synthetic@example.com'}) },
    '../models/PrizeAward': { findOne: () => query(options.award) },
    '../../vendors/models/Vendor': { findOneAndUpdate: async (filter,update,session) => { calls.fences.push({filter,update,session}); return options.active ? {_id:vid,name:'Synthetic Vendor',redemptionFence:1} : null; } },
  });
  const redeem = patch => service.redeemPrize({qrToken:'a'.repeat(32),vendorId:vid,tokenVersion:2,...patch});
  return { options, calls, redeem };
}
cases.push(['synthetic redemption uses version fence and conditional ownership claim', async () => { const f=redemptionFixture(),r=await f.redeem(); assert.equal(r.prize,'Synthetic prize'); assert.equal(f.calls.fences[0].filter.tokenVersion,2); assert.deepEqual(f.calls.fences[0].filter.isActive,{$ne:false}); assert.equal(f.calls.writes[0].filter.redemptionStatus,'pending'); assert.equal(f.calls.writes[0].update.$set.redeemedByVendorId,vid); assert.ok(f.calls.writes[1].filter.$expr); }]);
for (const [name, change, code] of [
  ['disabled or revoked vendor', f=>{f.options.active=false;}, 'VENDOR_SESSION_INVALID'],
  ['unknown QR',f=>{f.options.spin=null;},'INVALID_QR'],
  ['replayed QR',f=>{f.options.spin.redemptionStatus='redeemed';},'ALREADY_REDEEMED'],
  ['expired QR',f=>{f.options.spin.qrExpiry=new Date(0);},'QR_EXPIRED'],
  ['non-winning QR',f=>{f.options.spin.status='lost';},'INVALID_PRIZE'],
  ['incomplete prize',f=>{f.options.spin.userId=null;},'INCOMPLETE_PRIZE'],
  ['foreign award owner',f=>{f.options.award={userId:vid,wheelItemId:vid};},'AWARD_MISMATCH'],
  ['conditional claim loser',f=>{f.options.claim=0;},'REDEMPTION_CONFLICT'],
  ['inventory inconsistency',f=>{f.options.inventory=0;},'INVENTORY_RECONCILIATION_REQUIRED'],
]) cases.push([name+' fails closed', async()=>{const f=redemptionFixture(); change(f); await assert.rejects(f.redeem(),{code}); if(!['REDEMPTION_CONFLICT','INVENTORY_RECONCILIATION_REQUIRED'].includes(code)) assert.equal(f.calls.writes.length,0); }]);
cases.push(['malformed redemption credentials never query models', async()=>{const f=redemptionFixture(); await assert.rejects(f.redeem({qrToken:'bad'}),{code:'INVALID_QR'}); await assert.rejects(f.redeem({tokenVersion:-1}),{code:'INVALID_VENDOR_SESSION'}); assert.equal(f.calls.fences.length,0);}]);
cases.push(['all original and new administrative routes follow one global authorization gate', () => {
  const f=fixture(), calls=[], guard=()=>{}, router={}; for(const method of ['use','get','post','put','delete']) router[method]=(...args)=>calls.push({method,args});
  load('features/administration/routes/adminRoutes.js', { express:{Router:()=>router}, '../../authentication/middleware/authMiddleware':{authAdmin:guard}, '../controllers/adminController':f.admin,
      '../../prizes/controllers/prizeReviewController':Object.fromEntries(['listPrizeReviews','getPrizeReview','approvePrizeReview','rejectPrizeReview'].map(k=>[k,()=>{}])), '../controllers/adminOperationsController':f.ops,
      '../../campaigns/controllers/campaignAdministrationController':Object.fromEntries(['list','create','update','activity'].map(k=>[k,()=>{}])) });
  assert.equal(calls[0].method,'use'); assert.equal(calls[0].args[0],guard);
  assert.equal(calls.slice(1).every(c=>typeof c.args[1]==='function'),true);
  for(const p of ['/configuration','/sessions','/redemptions','/audit-logs']) assert.ok(calls.some(c=>c.method==='get'&&c.args[0]===p));
  assert.equal(calls.some(c=>String(c.args[0]).includes('fraud-report')),false);
}]);
for(const role of ['user','vendor']) cases.push([role+' tokens cannot enter administration',async()=>{
  const f=require('./helpers/createAuthFixture.cjs')(); const token=f.jwtService.signToken({id:aid,type:role,tokenVersion:0});const r=response();let next=0;
  await f.middleware.authAdmin({headers:{authorization:'Bearer '+token}},r,()=>next++); assert.equal(next,0);assert.ok([401,403].includes(r.statusCode));
}]);
cases.push(['customer token cannot enter vendor operations',async()=>{
  const f=require('./helpers/createAuthFixture.cjs')();const token=f.jwtService.signToken({id:aid,type:'user',tokenVersion:0});const r=response();let next=0;
  await f.middleware.authVendor({headers:{authorization:'Bearer '+token}},r,()=>next++);assert.equal(next,0);assert.ok([401,403].includes(r.statusCode));
}]);
for(const [name,body] of [['unknown inventory privileges',{title:'Synthetic',probabilityWeight:1,quantityAllocated:10}],['negative inventory',{title:'Synthetic',probabilityWeight:1,quantityTotal:-1}],['malformed vendor activation',{name:'Vendor',email:'vendor@example.com',isActive:{force:true}}]]) cases.push([name+' rejected before writes',async()=>{const f=fixture(),r=response();await f.admin[name.includes('vendor')?'updateVendor':'createWheelItem'](f.req(body),r);assert.equal(r.statusCode,400);assert.equal(f.calls.fences.length,0);assert.equal(f.calls.creates.length,0);}]);
cases.push(['inventory cannot be reduced below allocation',async()=>{const f=fixture(),r=response();await f.admin.updateWheelItem(f.req({title:'Synthetic prize',probabilityWeight:1,quantityTotal:3}),r);assert.equal(r.statusCode,409);assert.equal(f.item.quantityTotal,10);assert.equal(f.calls.audits.length,0);}]);
cases.push(['inventory deactivation retains inventory and writes audit',async()=>{const f=fixture(),r=response();await f.admin.deleteWheelItem(f.req(),r);assert.equal(r.statusCode,200);assert.equal(f.item.isActive,false);assert.equal(f.item.quantityAllocated,4);assert.equal(f.calls.audits.length,1);assert.equal(f.calls.fences.length,1);}]);
cases.push(['revoked administrator cannot mutate inventory',async()=>{const f=fixture(),r=response();f.options.revoked=true;await f.admin.updateWheelItem(f.req({title:'Synthetic prize',probabilityWeight:1,quantityTotal:20}),r);assert.equal(r.statusCode,403);assert.equal(f.item.quantityTotal,10);assert.equal(f.calls.audits.length,0);}]);
for(const action of ['approve','reject']) cases.push([action+' review is campaign-qualified audited and never allocates',async()=>{
  const f=fixture();const input={decisionId:vid,adminId:aid,adminTokenVersion:0,action};const r=await f.review.reviewPrizeDecision(input);
  assert.equal(r.status,action==='approve'?'approved':'rejected');assert.equal(r.prizeAllocated,false);assert.equal(r.drawExecuted,false);assert.equal(f.calls.audits.length,1);
  assert.equal(f.calls.queries[0].campaignId,'synthetic');assert.equal(f.calls.queries[1].userId,aid);assert.equal(f.calls.queries[1].outcome,'qualified');
  await assert.rejects(f.review.reviewPrizeDecision(input),{code:'REVIEW_NOT_PENDING'});
}]);
cases.push(['review cannot approve unqualified gameplay',async()=>{const f=fixture();f.options.gameQualified=false;await assert.rejects(f.review.reviewPrizeDecision({decisionId:vid,adminId:aid,adminTokenVersion:0,action:'approve'}),{code:'GAME_NOT_QUALIFIED'});assert.equal(f.calls.audits.length,0);}]);
cases.push(['review conditional update conflict rejects without audit',async()=>{const f=fixture();f.options.reviewConflict=true;await assert.rejects(f.review.reviewPrizeDecision({decisionId:vid,adminId:aid,adminTokenVersion:0,action:'approve'}),{code:'REVIEW_CONFLICT'});assert.equal(f.calls.audits.length,0);}]);
cases.push(['review rejects unsupported allocation actions before model access',async()=>{const f=fixture();await assert.rejects(f.review.reviewPrizeDecision({decisionId:vid,adminId:aid,adminTokenVersion:0,action:'allocate'}),{code:'INVALID_REVIEW_ACTION'});assert.equal(f.calls.fences.length,0);}]);
run('VENDOR/ADMINISTRATION OFFLINE',cases);
