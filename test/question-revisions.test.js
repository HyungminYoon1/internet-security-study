import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildCatalog,validateWeek,WEEK_NUMBERS,activeQuestionId,isBookmarked,toggleBookmark} from '../dist/src/domain/content.js';
import {initialState,validateState,makeBackup,parseBackup} from '../dist/src/domain/backup.js';
import {newExam,finishExam} from '../dist/src/domain/learning.js';
const weeks=await Promise.all(WEEK_NUMBERS.map(n=>readFile(new URL(`../dist/content/week-${String(n).padStart(2,'0')}.json`,import.meta.url),'utf8').then(JSON.parse)));
const catalog=buildCatalog(weeks);
const hashes=JSON.parse(await readFile(new URL('./fixtures/retired-question-hashes.json',import.meta.url),'utf8'));
test('all 58 historical definitions match the pre-session production content byte for byte',()=>{
  for(const week of weeks)for(const archived of week.retiredQuestions??[]){
    const {supersededBy,...old}=archived;
    assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),hashes[old.id],old.id);
  }
});
test('58 handout-oriented questions are replaced; all 144 concepts still have active practice',()=>{
  assert.equal(catalog.questions.length,631);assert.equal(catalog.retiredQuestions.length,58);
  assert.equal(catalog.objectives.length,144);
  for(const q of catalog.questions)assert.doesNotMatch(q.prompt,/교안|오타|오기를|정정|학습 앱/);
  for(const o of catalog.objectives)assert.ok(catalog.questions.filter(q=>q.objectiveId===o.id).length>=3,o.id);
});
test('old attempts/bookmarks/active and finished exams remain readable without changing their answer keys',()=>{
  const old=catalog.retiredQuestions.find(q=>q.id==='w01-q001');
  assert.equal(old.answerId,'a');assert.match(old.options[0].text,/1969/);
  const state=initialState();state.bookmarks=[old.id];
  state.attempts=[{id:'historic-attempt',questionId:old.id,objectiveId:old.objectiveId,family:old.family,answerId:'a',correct:true,confidence:'sure',at:1700000000000,mode:'practice'}];
  state.activeExam=newExam([old],{exam:'midterm',count:1,id:'historic-exam',seed:'old',now:1700000000000});
  state.activeExam.answers[old.id]='a';
  state.examHistory=[finishExam({...state.activeExam,id:'historic-finished'},[old],1700000001000)];
  assert.deepEqual(validateState(state,catalog),state);
  assert.deepEqual(parseBackup(makeBackup(state),catalog),state);
  assert.equal(activeQuestionId(catalog,old.id),old.supersededBy);
  assert.ok(!catalog.questions.some(q=>q.id===old.id));
});
test('retirement links reject missing targets, duplicate ids and changed scope',()=>{
  for(const edit of [w=>w.retiredQuestions[0].supersededBy='missing',w=>w.retiredQuestions[0].id=w.questions[0].id,w=>w.retiredQuestions[0].objectiveId=w.objectives[1].id]){
    const w=structuredClone(weeks[0]);edit(w);assert.throws(()=>validateWeek(w));
  }
});
test('historical bookmarks open their replacement and can be removed without leaving an invisible alias',()=>{
  const old='w01-q001',next=activeQuestionId(catalog,old);
  assert.equal(isBookmarked(catalog,[old],next),true);
  assert.deepEqual(toggleBookmark(catalog,[old,next],next),[]);
  assert.deepEqual(toggleBookmark(catalog,[],old),[next]);
});
