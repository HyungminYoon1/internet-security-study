import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateWeek } from '../dist/src/domain/content.js';
const weeks=[5,6,7].map(n=>JSON.parse(readFileSync(new URL(`../dist/content/week-0${n}.json`,import.meta.url),'utf8')));
const questions=new Map(weeks.flatMap(w=>w.questions.map(q=>[q.id,q])));
const objectives=new Map(weeks.flatMap(w=>w.objectives.map(o=>[o.id,o])));

test('Part 2 removes confirmed unrelated distractor shortcuts',()=>{
  const unrelated=/암호문 길이가 자동으로 0|저장 장치의 물리 용량|반드시 저장 장치가 손상|사용자의 기억 속 비밀번호|프로그램 이름만 변경|NIDS 이름을 HIDS로 변경|장비 외형|제품 이름에 dual|로그가 과거로 전송|암호키 길이가 자동 증가|고객의 실제 구매 의도/;
  for(const q of questions.values())for(const o of q.options)if(o.id!==q.answerId)assert(!unrelated.test(o.text),`${q.id}: unrelated distractor: ${o.text}`);
});
test('IDS log confidentiality and stateless inspection receive substantive teaching',()=>{
  const h=objectives.get('w07-hids-nids').explanation.join(' ');
  assert(/개인정보|개인 정보/.test(h)&&/수집.{0,12}최소|최소.{0,12}수집/.test(h)&&/보존/.test(h),'IDS log privacy teaching');
  const s=objectives.get('w07-snort-options').explanation.join(' ');
  assert(s.includes('stateless')&&/상태와 (무관|관계없이)/.test(s),'stateless inspection teaching');
  assert(objectives.get('w07-hids-nids').pages.includes(12),'privacy source page is linked');
  assert(/수집|보존/.test(objectives.get('w07-hids-nids').check.answer),'privacy retrieval check');
  const q=questions.get('w07-q039');
  const answer=q.options.find(o=>o.id===q.answerId);
  assert(/TCP/.test(answer.text)&&/stateless/.test(answer.text),'state distinction is assessed');
  assert.equal(q.explanation,answer.explanation,'question summary matches the refined correct rationale');
});
test('Part 2 retains identities, counts, keyed reasoning and source integrity',()=>{
  assert.deepEqual(weeks.map(w=>w.questions.length),[48,50,53]);
  const identities={
    w05:'7517540307d877722984f625376b7c52cfb9a4a547da65ba6a8b92c172454f6e',
    w06:'4fdd73f946202c5121908272e949cee0cbe42cb4224b2c8dc1da6dcf450481e2',
    w07:'a1b44351eb49d17c8098b0a287f37130ec1d0f269c0f2622eb1cf05143a57b65',
  };
  for(const w of weeks){
    const identity=w.questions.map(({id,objectiveId,family,answerId,sourcePages})=>({id,objectiveId,family,answerId,sourcePages}));
    assert.equal(createHash('sha256').update(JSON.stringify(identity)).digest('hex'),identities[w.id],`${w.id}: IDs, families, keys and page links must not drift`);
  }
  for(const w of weeks){validateWeek(w);assert.equal(new Set(w.coverage.flatMap(c=>c.pages)).size,w.source.pages);for(const q of w.questions)assert(q.sourcePages.every(p=>w.coverage.some(c=>c.pages.includes(p)&&c.objectiveIds.includes(q.objectiveId))));}
  const expected={
    'w06-q025':'1번 규칙으로 거부','w06-q026':'3번 규칙으로 거부',
    'w07-q021':'75%','w07-q022':'15/23','w07-q037':'SAFE',
  };
  for(const [id,text]of Object.entries(expected)){const q=questions.get(id);assert.equal(q.options.find(o=>o.id===q.answerId).text,text,id);}
});
