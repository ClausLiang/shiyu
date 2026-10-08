import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateSentences, sentencePage } from '../src/sentences.js';

test('语句按 10 条分页，尾页与首尾越界正确处理，无遗漏或重复', () => {
  const sentences = Array.from({ length: 21 }, (_, index) => ({ english: `Sentence ${index}`, chinese: `语句 ${index}` }));
  const pages = [1, 2, 3].map(page => sentencePage(sentences, page));
  assert.deepEqual(pages.map(page => page.items.length), [10, 10, 1]);
  assert.deepEqual(pages.flatMap(page => page.items), sentences);
  assert.deepEqual(pages.map(page => page.start), [0, 10, 20]);
  assert.equal(sentencePage(sentences, 0).page, 1);
  assert.equal(sentencePage(sentences, 4).page, 3);
  assert.equal(sentencePage(sentences, NaN).page, 1);
  assert.equal(sentencePage(sentences.slice(0, 10), 1).pages, 1);
  assert.equal(sentencePage(sentences.slice(0, 11), 2).items.length, 1);
  assert.deepEqual(sentencePage([], 1), { page: 1, pages: 1, start: 0, items: [] });
});

test('语句校验拒绝无效内容，保留原句标点与译文', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/sentences.json', import.meta.url), 'utf8'));
  assert.equal(validateSentences(data), data);
  assert.equal(data[0].english, "Everything is about people, everything in this life that's worth a damn.");
  assert.equal(data[0].chinese, '世间所有值得珍惜的东西，都与人有关。');
  for (const invalid of [null, {}, [null], [{}], [{ english: 'Hi', chinese: ' ' }], [{ english: 1, chinese: '你好' }]]) {
    assert.throws(() => validateSentences(invalid), /语句数据格式错误/);
  }
  assert.deepEqual(validateSentences([]), []);
});
