import test from 'node:test';
import assert from 'node:assert/strict';
import { ON_TIME_DAILY_MASTERY_POINTS, STANDARD_MASTERY_POINTS, standardMasteryPoints } from '../src/meta/mastery/MasteryPoints.ts';

test('approved Trifold Mastery point weights are fixed',()=>{
 assert.deepEqual(STANDARD_MASTERY_POINTS,{easy:1,medium:2,hard:3});
 assert.equal(ON_TIME_DAILY_MASTERY_POINTS,2);
 assert.equal(standardMasteryPoints('medium'),2);
});
