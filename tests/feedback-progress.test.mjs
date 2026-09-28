import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyFeedbackProgress, parseFeedbackProgress, completeRecognitionFlow, nextFeedbackMilestone, acknowledgeFeedbackMilestone } from '../lib/feedback-progress.ts';

function complete(progress, first, last) {
  for (let i = first; i <= last; i++) progress = completeRecognitionFlow(progress, `batch-${i}`);
  return progress;
}

test('first invitation is due on five confirmed recognition flows', () => {
  let progress = complete(emptyFeedbackProgress(), 1, 4);
  assert.equal(nextFeedbackMilestone(progress), null);
  progress = completeRecognitionFlow(progress, 'batch-5');
  assert.equal(nextFeedbackMilestone(progress), 5);
});

test('multiple confirmations from one recognition batch do not increase the count', () => {
  const progress = completeRecognitionFlow(emptyFeedbackProgress(), 'one-meal');
  assert.strictEqual(completeRecognitionFlow(progress, 'one-meal'), progress);
  assert.equal(progress.completedBatchIds.length, 1);
});

test('unrecognized legacy records and recommendations do not count', () => {
  const progress = emptyFeedbackProgress();
  assert.strictEqual(completeRecognitionFlow(progress, undefined), progress);
  assert.equal(nextFeedbackMilestone(progress), null);
});

test('dismissing the fifth invitation prevents repeat until the tenth flow', () => {
  let progress = complete(emptyFeedbackProgress(), 1, 5);
  progress = acknowledgeFeedbackMilestone(progress, 5);
  progress = parseFeedbackProgress(JSON.stringify(progress));
  assert.equal(nextFeedbackMilestone(progress), null);
  progress = complete(progress, 6, 9);
  assert.equal(nextFeedbackMilestone(progress), null);
  progress = completeRecognitionFlow(progress, 'batch-10');
  assert.equal(nextFeedbackMilestone(progress), 10);
  progress = acknowledgeFeedbackMilestone(progress, 10);
  progress = complete(progress, 11, 15);
  assert.equal(nextFeedbackMilestone(progress), 15);
});

test('unshown invitations survive reload and are acknowledged in order', () => {
  let progress = parseFeedbackProgress(JSON.stringify(complete(emptyFeedbackProgress(), 1, 10)));
  assert.equal(nextFeedbackMilestone(progress), 5);
  assert.strictEqual(acknowledgeFeedbackMilestone(progress, 10), progress);
  progress = acknowledgeFeedbackMilestone(progress, 5);
  assert.equal(nextFeedbackMilestone(progress), 10);
});

test('invalid local storage cannot manufacture counts or invalid milestones', () => {
  assert.deepEqual(parseFeedbackProgress('{broken'), emptyFeedbackProgress());
  assert.deepEqual(parseFeedbackProgress('null'), emptyFeedbackProgress());
  const parsed = parseFeedbackProgress(JSON.stringify({completedBatchIds:['a','a',null,42,''],lastInvitedMilestone:999}));
  assert.deepEqual(parsed,{completedBatchIds:['a'],lastInvitedMilestone:0});
});
