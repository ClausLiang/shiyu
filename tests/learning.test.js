import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chapterCount, chapterWords, isCorrect, emptyProgress, validateDictionary, validateProgress, recordAttempt, completedCount, mergeProgress } from '../src/learning.js';
import { STORAGE_KEY, loadProgress, saveProgress } from '../src/storage.js';
const dictionary = JSON.parse(readFileSync(new URL('../public/data/cet4.json', import.meta.url), 'utf8'));
const now = '2026-09-21T04:00:00.000Z';
const record = (state, word, correct) => recordAttempt(state, word, correct, now);

test('词库完整且所有词条恰好分入一个章节', () => {
  validateDictionary(dictionary);
  assert.equal(chapterCount(dictionary), 131);
  const chapters = Array.from({ length: 131 }, (_, i) => chapterWords(dictionary, i + 1));
  assert.ok(chapters.slice(0, 130).every(chapter => chapter.length === 20));
  assert.equal(chapters[130].length, 7);
  assert.deepEqual(chapters.flat(), dictionary);
  assert.deepEqual(chapterWords(dictionary, 0), chapters[0]);
  assert.deepEqual(chapterWords(dictionary, 132), chapters[130]);
});
test('词库重复、缺失和非法词条不能静默使用', () => {
  assert.throws(() => validateDictionary(dictionary.slice(1)));
  assert.throws(() => validateDictionary([dictionary[1], ...dictionary.slice(1)]));
  assert.throws(() => validateDictionary([{ ...dictionary[0], trans: [] }, ...dictionary.slice(1)]));
});
test('拼写忽略大小写与首尾空白，内部差异仍判错', () => {
  assert.equal(isCorrect(' CANCEL ', 'cancel'), true);
  for (const value of ['cancle', 'can cel', '', 'cancel!']) assert.equal(isCorrect(value, 'cancel'), false);
});
test('错误不完成，正确后复练不虚增完成数', () => {
  const initial = emptyProgress();
  const wrong = record(initial, 'cancel', false);
  assert.equal(completedCount(wrong, dictionary), 0);
  const correct = record(wrong, 'cancel', true);
  const repeat = record(record(correct, 'cancel', true), 'cancel', false);
  assert.equal(completedCount(repeat, dictionary), 1);
  assert.deepEqual(repeat.words.cancel, { attempts: 4, correct: 2, completed: true, lastPracticedAt: now });
  assert.deepEqual(initial.words, {});
});
test('保存后恢复章节与练习记录', () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const progress = { ...record(emptyProgress(), 'cancel', true), chapter: 131 };
  assert.equal(saveProgress(storage, progress).error, null);
  assert.deepEqual(loadProgress(storage, dictionary), { progress, error: null });
});
test('损坏的本地数据不会在读取时覆盖原始记录', () => {
  let writes = 0;
  const storage = { getItem: () => '{broken', setItem: () => writes++ };
  const loaded = loadProgress(storage, dictionary);
  assert.ok(loaded.error);
  assert.deepEqual(loaded.progress, emptyProgress());
  assert.equal(writes, 0);
});
test('存储不可用与配额不足返回可理解的错误', () => {
  assert.ok(loadProgress(null, dictionary).error);
  assert.ok(saveProgress({ setItem() { throw new Error('QuotaExceededError'); } }, emptyProgress()).error);
});
test('导入拒绝不兼容版本、词库和章节', () => {
  for (const patch of [{ version: 2 }, { dictionary: 'other' }, { chapter: 132 }, { chapter: 0 }, { chapter: 1.5 }, { words: [] }]) {
    assert.throws(() => validateProgress({ ...emptyProgress(), ...patch }, dictionary));
  }
});
test('导入拒绝非法计数、时间戳与伪造的完成标记', () => {
  const valid = record(emptyProgress(), 'cancel', true);
  for (const patch of [{ attempts: -1 }, { attempts: 0 }, { correct: 9 }, { correct: 0 }, { completed: 'true' }, { lastPracticedAt: 'bad' }]) {
    assert.throws(() => validateProgress({ ...valid, words: { cancel: { ...valid.words.cancel, ...patch } } }, dictionary));
  }
  assert.throws(() => validateProgress({ ...valid, words: { unknown: valid.words.cancel } }, dictionary));
  assert.deepEqual(validateProgress(valid, dictionary), valid);
});
test('合并备份保留当前章节，保留双方完成记录，重复导入幂等', () => {
  const current = { ...record(emptyProgress(), 'cancel', true), chapter: 2 };
  const incoming = record(record(emptyProgress(), 'cancel', false), 'explosive', true);
  const merged = mergeProgress(current, incoming);
  assert.equal(merged.chapter, 2);
  assert.equal(completedCount(merged, dictionary), 2);
  assert.deepEqual(mergeProgress(merged, incoming), merged);
  validateProgress(merged, dictionary);
});
test('较旧备份不会回退较新的正确次数或练习时间', () => {
  const older = record(emptyProgress(), 'cancel', true);
  const newer = recordAttempt(older, 'cancel', true, '2026-09-22T00:00:00.000Z');
  assert.deepEqual(mergeProgress(newer, older), newer);
});
test('存储使用独立命名空间', () => { assert.equal(STORAGE_KEY, 'shiyu:learning:v1'); });
