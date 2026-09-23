import { emptyProgress, chapterWords, recordAttempt } from '../src/learning.js';
import { STORAGE_KEY } from '../src/storage.js';

const frame = document.querySelector('#app');
const run = document.querySelector('#run');
const summary = document.querySelector('#summary');
const results = document.querySelector('#results');
const $ = selector => frame.contentDocument.querySelector(selector);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const tick = () => new Promise(resolve => setTimeout(resolve, 25));
async function until(check) {
  const deadline = performance.now() + 5000;
  while (!check()) {
    if (performance.now() > deadline) throw new Error('等待页面状态超时');
    await tick();
  }
}
function tab() {
  frame.contentDocument.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
}
function activate(index) { $(`[data-index="${index}"] .card-face`).click(); }
function answer(word, method = 'tab') {
  $('#spelling-input').value = word;
  if (method === 'submit') $('.spelling-form').requestSubmit();
  else if (method === 'button') $('.check-button').click();
  else tab();
}
function isCelebrating() { return $('#chapter-done-dialog').open; }
function saved() { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }

run.addEventListener('click', async () => {
  assert(location.hostname === '127.0.0.1' && location.port === '5174', '仅可在专用测试地址运行');
  run.disabled = true;
  results.replaceChildren();
  summary.textContent = '正在运行…';
  const original = localStorage.getItem(STORAGE_KEY);
  let passed = 0, failed = 0;
  async function test(name, check) {
    const row = document.createElement('li');
    try { await check(); row.className = 'pass'; row.textContent = `通过：${name}`; passed++; }
    catch (error) { row.className = 'fail'; row.textContent = `失败：${name} — ${error.message}`; failed++; }
    results.append(row);
  }
  try {
    const response = await fetch('../public/data/cet4.json');
    const words = await response.json();
    async function load({ chapter = 1, missing = [], width = 1440 } = {}) {
      // 先卸载上一用例，避免它收到测试数据的 storage 事件。
      frame.src = 'about:blank';
      await until(() => frame.contentDocument?.URL === 'about:blank');
      let progress = emptyProgress();
      progress.chapter = chapter;
      for (const word of chapterWords(words, chapter)) {
        if (!missing.includes(word.name)) progress = recordAttempt(progress, word.name, true);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      frame.width = String(width);
      frame.src = '/';
      await until(() => Boolean($('#practice')));
    }
    const last = words[19].name;
    for (const method of ['tab', 'submit', 'button']) {
      await test(`末词提交路径 ${method}：庆祝一次且只记录一次练习`, async () => {
        await load({ missing: [last] });
        activate(19);
        answer(last, method);
        if (method !== 'tab') {
          assert(!isCelebrating(), '检查后应等待 Tab');
          tab();
        }
        assert(isCelebrating(), '完成 20/20 后应弹窗');
        assert(saved().words[last].attempts === 1, '不能重复记录提交');
        $('#chapter-done-close').click();
        tab();
        assert(!isCelebrating() && $('[data-index="0"] #spelling-input'), '关闭后 Tab 应从首词复习');
      });
    }
    await test('首次学习漏词时末词拼对不庆祝', async () => {
      await load({ missing: [words[0].name, last] });
      activate(19); answer(last);
      assert(!isCelebrating(), '19/20 不应庆祝');
    });
    await test('已完成章节的非末词不庆祝，末词可再次庆祝', async () => {
      await load();
      activate(0); answer(words[0].name);
      assert(!isCelebrating() && $('[data-index="1"] #spelling-input'), '复习应正常前进');
      activate(19); answer(last);
      assert(isCelebrating(), '复习末词仍应庆祝');
    });
    await test('空输入、错拼与查看答案均不能触发庆祝', async () => {
      await load(); activate(19);
      tab();
      assert(!isCelebrating() && $('#spelling-input'), '空输入应停留');
      answer('wrong-answer');
      assert(!isCelebrating() && $('#spelling-input').getAttribute('aria-invalid') === 'true', '错拼应停留');
      $('#spelling-input').dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      tab();
      assert(!isCelebrating(), '查看已完成末词也不能庆祝');
    });
    for (const width of [1440, 390]) {
      await test(`${width}px：庆祝后复习首词，输入框避开顶栏且可点击`, async () => {
        await load({ width });
        frame.contentWindow.scrollTo(0, frame.contentDocument.body.scrollHeight);
        activate(19); answer(last);
        $('#chapter-done-review').click();
        const input = $('#spelling-input');
        assert($('[data-index="0"] #spelling-input') === input, '应回到首词');
        // 等待平滑滚动结束，再判断几何关系，避免把过渡中的位置误判为成功。
        let previous = -1, stable = 0;
        await until(() => {
          const y = frame.contentWindow.scrollY;
          stable = y === previous ? stable + 1 : 0;
          previous = y;
          return stable >= 5;
        });
        const rect = input.getBoundingClientRect();
        assert(rect.top >= $('.topbar').getBoundingClientRect().bottom, '输入框被顶栏遮挡');
        assert(rect.bottom <= frame.contentWindow.innerHeight, '输入框超出视口');
        assert(frame.contentDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === input, '输入框被其他元素覆盖');
        assert(frame.contentDocument.documentElement.scrollWidth <= frame.contentWindow.innerWidth, '出现横向滚动');
      });
    }
    await test('下一章跳转清理状态，最后一章完成后可回到第一章', async () => {
      await load(); activate(19); answer(last);
      $('#chapter-done-next').click();
      assert(saved().chapter === 2 && !isCelebrating(), '应进入第二章');
      tab();
      assert($('[data-index="20"] #spelling-input'), '切章后应从新章节首词开始');
      await load({ chapter: 131, missing: [words.at(-1).name] });
      activate(words.length - 1); answer(words.at(-1).name, 'submit'); tab();
      assert(isCelebrating() && $('#chapter-done-next').textContent.includes('回到第一章'), '末章应显示正确去向');
      $('#chapter-done-next').click();
      assert(saved().chapter === 1 && !isCelebrating(), '应返回第一章');
    });
  } catch (error) {
    failed++;
    results.append(Object.assign(document.createElement('li'), { textContent: `测试准备失败：${error.message}`, className: 'fail' }));
  } finally {
    frame.src = 'about:blank';
    await until(() => frame.contentDocument?.URL === 'about:blank');
    if (original === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, original);
    summary.textContent = `${passed} 项通过，${failed} 项失败`;
    run.disabled = false;
  }
});
