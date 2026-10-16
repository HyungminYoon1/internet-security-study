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
