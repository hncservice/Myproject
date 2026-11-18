'use strict';
// Offline pure-math check. No database connection, no game session, no attempt.
const {positionAt, ratingForDistance} = require('../features/games/services/perfectShotGameplayService');
const motion = {phaseX: 1.206784815223738, phaseY: 0.04067734167868064,
 speedX: 1.4584336, speedY: 1.25, amplitudeX: 31, amplitudeY: 20};
const shotIndex = 0, elapsedMs = 1200;
const target = positionAt(elapsedMs, shotIndex, motion);
const checks = [
 {name:'Center', x:target.x, y:target.y, expected:100},
 {name:'Great', x:target.x + 3, y:target.y, expected:70},
 {name:'Nice hit', x:target.x + 6, y:target.y, expected:40},
 {name:'Miss', x:target.x + 15, y:target.y, expected:0},
];
for(const c of checks){
 const distance=Math.hypot((c.x-target.x)*5,(c.y-target.y)*5);
 const points=ratingForDistance(distance).points;
 const pass=points===c.expected;
 console.log(`${pass?'PASS':'FAIL'} ${c.name} distance=${distance.toFixed(2)} points=${points}`);
 if(!pass)process.exitCode=1;
}
console.log('Target:',target);
console.log('No MongoDB calls, no API calls, no attempts consumed.');
