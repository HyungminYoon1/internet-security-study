import test from 'node:test';
import assert from 'node:assert/strict';
import { matchRules, firewallScenario, classifyDetection, correlationMatches, responseSteps } from '../dist/src/domain/cases.js';

test('first matching firewall rule wins; order matters for overlapping permit and deny', () => {
  const deny = { id: 'deny', source: '198.51.100.27', destination: 'any', port: 'any', action: 'deny' };
  const allow = { id: 'web', source: 'any', destination: '192.0.2.10', port: 443, action: 'allow' };
  const packet = { source: '198.51.100.27', destination: '192.0.2.10', port: 443 };
  assert.equal(matchRules([deny, allow], packet).action, 'deny');
  assert.equal(matchRules([allow, deny], packet).action, 'allow');
  assert.equal(matchRules([allow], { ...packet, port: 22 }).action, 'deny');
  for (let seed = 0; seed < 100; seed++) assert.deepEqual(firewallScenario(String(seed)), firewallScenario(String(seed)));
});
test('false positives and negatives distinguish actual condition from detection', () => {
  assert.equal(classifyDetection(true, false), '오탐');
  assert.equal(classifyDetection(false, true), '미탐');
  assert.equal(classifyDetection(true, true), '정탐');
  assert.equal(classifyDetection(false, false), '정상 판정');
});
test('a declared half-open one-minute correlation window handles exact thresholds', () => {
  const events = [{ at: 0, source: 'a', target: 'x' }, ...Array.from({ length: 19 }, (_, i) => ({ at: 1000 + i, source: 'a', target: 'y' }))];
  assert.equal(correlationMatches(events, { start: 0, end: 60000, minimum: 20, targets: 2 }).length, 1);
  assert.equal(correlationMatches([...events.slice(1), { at: 60000, source: 'a', target: 'x' }], { start: 0, end: 60000, minimum: 20, targets: 2 }).length, 0);
  assert.equal(correlationMatches(events.map(e => ({ ...e, target: 'same' })), { start: 0, end: 60000, minimum: 20, targets: 2 }).length, 0);
});
test('incident steps have a reasoned answer and unique choices', () => {
  assert(responseSteps.length >= 4);
  for (const step of responseSteps) {
    assert.equal(step.options.length, 4); assert.equal(new Set(step.options.map(o => o.text)).size, 4);
    assert(step.options.some(o => o.id === step.answerId));
    assert(step.options.every(o => o.explanation.length > 20));
  }
});
