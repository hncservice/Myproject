'use strict';
// In-memory unit checks only; deliberately DOES NOT invoke the private
// allocation transaction or connect to MongoDB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../features/prizes/services/prizeAllocationService.js'), 'utf8');
let dbCalls = 0;
const databaseStub = new Proxy({}, {get() { return () => {dbCalls++; throw Error('DB access forbidden in isolated test');}; }});
const fakeMongoose = { isValidObjectId: () => true, connection: {transaction: () => {dbCalls++; throw Error('transaction forbidden');}} };
const mocks = {
  '../models/WheelItem': databaseStub,
  '../../games/models/GameSession': databaseStub,
  '../models/PrizeAward': databaseStub,
  '../models/PrizeDecision': databaseStub,
  '../../games/models/Spin': databaseStub,
  '../../authentication/models/User': { ...databaseStub, collection: databaseStub },
  '../../../config/gameConfig': { CAMPAIGN_POLICY: {campaignId:'hnc-isolated-test-only'} },
  mongoose: fakeMongoose,
  crypto,
};
const moduleSandbox = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Buffer, console, Date, process }, {filename:'prizeAllocationService.js'})(
  (name) => {if (!(name in mocks)) throw Error(`Unexpected require: ${name}`);return mocks[name];},
  moduleSandbox, moduleSandbox.exports
);
const service = moduleSandbox.exports;
(async () => {
  let passed = 0;
  function check(name, fn) { fn(); passed++; console.log('PASS:', name); }
  check('No Prize remains an explicit weighted possibility', () => {
    assert.equal(service.weightedSelect([], 40), null);
  });
  check('Stock filtering rejects exhausted items', () => {
    assert.equal(service.hasAvailableStock({isActive:true,quantityTotal:1,quantityAllocated:1}),false);
    assert.equal(service.hasAvailableStock({isActive:true,quantityTotal:1,quantityAllocated:0}),true);
  });
  check('Prizes with unlimited inventory are available', () => {
    assert.equal(service.hasAvailableStock({isActive:true,quantityTotal:null,quantityAllocated:0}),true);
  });
  let disabled = false;
  try { await service.allocatePrize({userId:'any',gameSessionId:'any'}); }
  catch(err) { disabled = err.code === 'PRIZE_ALLOCATION_DISABLED' && err.status === 503; }
  check('Real allocation rejects before any database access', () => assert.equal(disabled,true));
  check('No database calls', () => assert.equal(dbCalls,0));
  check('Transactional per-user fence exists in source', () => {
    assert.match(source, /User\.collection\.updateOne\s*\(/);
    assert.match(source, /prizeAllocationFence:\s*1/);
  });
  console.log(`\nHNC STEP 15I SAFE UNIT TEST: PASS (${passed}/6)`);
  console.log('No MongoDB connection, no changed attempts, no prizes.');
  console.log('NOT a real transaction/concurrency test.');
})().catch((err) => {console.error(err);process.exitCode=1;});

