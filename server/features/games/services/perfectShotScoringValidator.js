'use strict';

// Step 15G - pure, observational scoring verifier.
// It cannot prove physical click timing or prize eligibility.
const CONFIG = Object.freeze({
  referenceSize: 500,
  minimumReactionMs: 90,
  maxCompensationMs: 950,
  futureToleranceMs: 75,
  highLatencyReviewMs: 650,
});
function reject(code, message) {
  return { accepted: false, code, message, score: null,
    risk: { reviewRequired: false, reasons: [] }, prizeEligible: false };
}
function validMs(v) { return typeof v === 'number' && Number.isSafeInteger(v); }
function validateAndScoreShot(input) {
  const {shot,x,y,shotAt,receivedAt,shotStartedAt,shotExpiresAt,motion,positionAt,ratingForDistance} = input || {};
  if (!Number.isInteger(shot) || shot < 1 || shot > 5 ||
      typeof x !== 'number' || typeof y !== 'number' ||
      !Number.isFinite(x) || !Number.isFinite(y) ||
      x < 0 || x > 100 || y < 0 || y > 100)
    return reject('INVALID_INPUT', 'Invalid shot or coordinates');
  if (![receivedAt,shotStartedAt,shotExpiresAt].every(validMs) || shotExpiresAt <= shotStartedAt)
    return reject('INVALID_SERVER_TIME','Invalid trusted server timing');
  if (typeof positionAt !== 'function' || typeof ratingForDistance !== 'function')
    return reject('INVALID_CONFIGURATION','Missing movement/scoring functions');
  if (!validMs(shotAt)) return reject('INVALID_CAPTURE_TIME','Missing client timestamp');
  const claimedLatencyMs=receivedAt-shotAt;
  const elapsedMs=shotAt-shotStartedAt;
  if(elapsedMs<CONFIG.minimumReactionMs || shotAt>=shotExpiresAt)
    return reject('INVALID_SHOT_TIME','Shot outside playing window');
  if(claimedLatencyMs< -CONFIG.futureToleranceMs || claimedLatencyMs>CONFIG.maxCompensationMs)
    return reject('INVALID_LATENCY','Timestamp outside latency bounds');
  if (!motion || !['phaseX','phaseY','speedX','speedY','amplitudeX','amplitudeY']
    .every(k=>Number.isFinite(motion[k])))
    return reject('INVALID_MOTION','Missing or invalid session motion');
  const target=positionAt(elapsedMs,shot-1,motion);
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y))
    return reject('INVALID_TARGET','Could not compute target');
  const distance=Math.hypot((x-target.x)*CONFIG.referenceSize/100,(y-target.y)*CONFIG.referenceSize/100);
  const rating=ratingForDistance(distance);
  if(!rating || ![0,40,70,100].includes(rating.points))
    return reject('INVALID_SCORE','Unexpected scoring result');
  const reasons=[];
  if(claimedLatencyMs<0) reasons.push('FUTURE_CAPTURE_TIMESTAMP');
  if(claimedLatencyMs>CONFIG.highLatencyReviewMs) reasons.push('HIGH_CLAIMED_LATENCY');
  return {accepted:true,code:'SHOT_ACCEPTED',
    score:{points:rating.points,category:rating.category,label:rating.label,distance:Number(distance.toFixed(2)),target},
    timing:{elapsedMs,claimedLatencyMs,compensated:true},
    risk:{reviewRequired:reasons.length>0,reasons},prizeEligible:false};
}
module.exports={validateAndScoreShot,CONFIG};
