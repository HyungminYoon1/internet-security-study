import test from 'node:test';
import assert from 'node:assert/strict';
import {publicError} from '../dist/src/cloud/neon.js';
test('origin configuration errors are not misreported as an expired user login',()=>{
  assert.match(publicError({status:403,code:'INVALID_ORIGIN'}),/접속 주소/);
});
test('provider error messages and tokens are never reflected to the user',()=>{
  assert.ok(!publicError({message:'secret-token-value'}).includes('secret-token-value'));
  assert.match(publicError({status:429}),/요청이 많/);
});

test('blocked browser session has an actionable error without requesting verification again',()=>{
  assert.match(publicError({code:'SESSION_UNAVAILABLE'}),/로그인 세션을 유지하지 못했습니다/);
  assert.match(publicError({code:'SESSION_UNAVAILABLE'}),/다른 브라우저/);
});

test('managed duplicate-account and already-verified errors give safe actionable guidance',()=>{
  assert.match(publicError({code:'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'}),/기존 계정이라면/);
  assert.match(publicError({code:'EMAIL_ALREADY_VERIFIED'}),/로그인해 주세요/);
});
