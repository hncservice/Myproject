'use strict';
// Pure preflight for a FUTURE separately authorized harness. Never connects or
// reads environment/configuration files. Not installed in production startup.
function validateIntegrationTarget(input) {
  const reject = () => { throw Object.assign(new Error('Integration target is not an approved isolated sandbox'), { code: 'UNSAFE_INTEGRATION_TARGET' }); };
  const keys = ['mongoUri','httpBaseUrl','environment','emailAdapter','allocationEnabled','campaignParticipationEnabled'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype,null].includes(Object.getPrototypeOf(input))) reject();
  for (const key of Reflect.ownKeys(input)) {
    const property = Object.getOwnPropertyDescriptor(input,key);
    if (!keys.includes(key) || !property.enumerable || !Object.hasOwn(property,'value')) reject();
  }
  if (keys.some(key => !Object.hasOwn(input,key)) || input.environment !== 'integration-sandbox' || input.emailAdapter !== 'memory' || input.allocationEnabled !== false || input.campaignParticipationEnabled !== false || typeof input.mongoUri !== 'string' || input.mongoUri.length > 2048 || typeof input.httpBaseUrl !== 'string' || input.httpBaseUrl.length > 200) reject();
  let db, http;
  try { db=new URL(input.mongoUri);http=new URL(input.httpBaseUrl); } catch { reject(); }
  const loopback = host => ['127.0.0.1','localhost','[::1]'].includes(host);
  if (db.protocol !== 'mongodb:' || !loopback(db.hostname) || db.pathname !== '/hnc_step15q_sandbox' || db.hash || input.mongoUri.includes(',') || !db.port || !/^\d+$/.test(db.port)) reject();
  for (const key of db.searchParams.keys()) if (!['authSource','replicaSet'].includes(key) || db.searchParams.getAll(key).length !== 1) reject();
  if ((db.searchParams.has('authSource') && db.searchParams.get('authSource') !== 'hnc_step15q_sandbox') || !/^[A-Za-z0-9_-]{1,64}$/.test(db.searchParams.get('replicaSet') || '')) reject();
  if (http.protocol !== 'http:' || !loopback(http.hostname) || http.username || http.password || http.pathname !== '/' || http.search || http.hash || !http.port || Number(http.port)<1024) reject();
  return Object.freeze({ databaseName:'hnc_step15q_sandbox',mongoHostname:db.hostname,httpBaseUrl:http.origin,allocationEnabled:false,campaignParticipationEnabled:false,emailAdapter:'memory' });
}
module.exports = { validateIntegrationTarget };
