import { emptyProgress, chapterWords, recordAttempt } from '../src/learning.js';
import { STORAGE_KEY } from '../src/storage.js';

const THEME_KEY = 'shiyu:theme:v1';

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
  const originalTheme = localStorage.getItem(THEME_KEY);
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
    async function load({ chapter = 1, missing = [], width = 1440, mockSpeech = false, setupScript = '', waitFor = () => Boolean($('#word-grid .word-card')) } = {}) {
      // 先卸载上一用例，避免它收到测试数据的 storage 事件。
      frame.removeAttribute('srcdoc');
      frame.src = 'about:blank';
      await until(() => frame.contentDocument?.URL === 'about:blank');
      let progress = emptyProgress();
      progress.chapter = chapter;
      for (const word of chapterWords(words, chapter)) {
        if (!missing.includes(word.name)) progress = recordAttempt(progress, word.name, true);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      frame.width = String(width);
      if (mockSpeech || setupScript) {
        const html = await (await fetch('/')).text();
        const speechScript = mockSpeech ? 'window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };' : '';
        frame.srcdoc = html.replace('<head>', `<head><base href="/"><script>${speechScript}${setupScript}<\/script>`);
      } else frame.src = '/';
      await until(waitFor);
    }
    await test('固定导航、页面和弹窗在 HTML 中直接提供，图标引用完整且无重复 ID', async () => {
      const html = await (await fetch('/')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      for (const selector of ['.sidebar', '.topbar', '#theme-toggle', '#words-view', '#sentences-view', '#chapter-dialog', '#backup-dialog', '#chapter-done-dialog']) {
        assert(doc.querySelector(selector), `HTML 缺少 ${selector}`);
      }
      const ids = [...doc.querySelectorAll('[id]')].map(element => element.id);
      assert(new Set(ids).size === ids.length, 'HTML 包含重复 ID');
      for (const use of doc.querySelectorAll('use')) assert(doc.querySelector(use.getAttribute('href')), '图标引用缺少定义');
      assert(!doc.querySelector('.word-card') && !doc.querySelector('.sentence-card'), '数据卡片仍应按需生成');
    });
    await test('词库请求未完成时即可切换语句和主题，加载完成不会抢回页面', async () => {
      await load({
        setupScript: `const originalFetch = window.fetch.bind(window); window.fetch = (url, options) => {
          if (!String(url).endsWith('/cet4.json')) return originalFetch(url, options);
          document.documentElement.dataset.testDictionaryPending = 'true';
          return new Promise(resolve => document.addEventListener('test-release-dictionary', () => resolve(originalFetch(url, options)), { once: true }));
        };`,
        waitFor: () => frame.contentDocument.documentElement.dataset.testDictionaryPending === 'true',
      });
      const shell = $('.sidebar'), theme = $('#theme-toggle');
      assert(!$('#word-load-message').hidden && $('#backup-open').disabled, '加载中应提示且禁用进度操作');
      $('[data-module="sentences"]').click();
      await until(() => Boolean($('.sentence-card')));
      const previousTheme = frame.contentDocument.documentElement.dataset.theme;
      theme.click();
      assert(frame.contentDocument.documentElement.dataset.theme !== previousTheme, '主题不应依赖词库');
      frame.contentDocument.dispatchEvent(new frame.contentWindow.Event('test-release-dictionary'));
      await until(() => Boolean($('#word-grid .word-card')));
      assert(!$('#sentences-view').hidden && $('#words-view').hidden, '后台词库就绪不能抢回单词页');
      assert($('.sidebar') === shell && $('#theme-toggle') === theme, '不能替换固定页面节点');
    });
    await test('词库失败保留导航和语句，重试恢复且反复切换不重复绑定提交', async () => {
      await load({
        setupScript: `const originalFetch = window.fetch.bind(window); let requests = 0; window.fetch = (url, options) => {
          if (String(url).endsWith('/cet4.json')) {
            document.documentElement.dataset.testDictionaryRequests = String(++requests);
            if (requests === 1) return Promise.resolve(new Response('', { status: 404 }));
          }
          return originalFetch(url, options);
        };`,
        waitFor: () => $('#word-error') && !$('#word-error').hidden,
      });
      const navigation = $('[data-module="sentences"]');
      assert($('#word-content').hidden && $('#save-status').disabled, '失败时不能显示未加载的学习内容或保存成功');
      navigation.click();
      await until(() => Boolean($('.sentence-card')));
      $('[data-module="words"]').click();
      $('#word-retry').click();
      $('#word-retry').click();
      await until(() => Boolean($('#word-grid .word-card')));
      assert(frame.contentDocument.documentElement.dataset.testDictionaryRequests === '2', '加载中应合并重复重试');
      assert($('#word-error').hidden && !$('#save-status').disabled, '重试后应恢复进度操作');
      for (let i = 0; i < 3; i++) { navigation.click(); $('[data-module="words"]').click(); }
      const before = saved().words[words[0].name].attempts;
      activate(0); answer(words[0].name, 'submit');
      assert(saved().words[words[0].name].attempts === before + 1, '一次提交不能触发多次记录');
      assert(navigation === $('[data-module="sentences"]'), '切换后仍应复用导航节点');
    });
    await test('进度导入、导出与跨模块返回仍使用当前单词状态', async () => {
      await load({ missing: [words[0].name] });
      const win = frame.contentWindow;
      const imported = recordAttempt(emptyProgress(), words[0].name, true);
      const files = new win.DataTransfer();
      files.items.add(new win.File([JSON.stringify(imported)], 'progress.json', { type: 'application/json' }));
      $('#save-status').click();
      $('#import-file').files = files.files;
      $('#import-file').dispatchEvent(new win.Event('change', { bubbles: true }));
      await until(() => $('#backup-message').textContent.includes('进度已合并并保存'));
      assert(saved().words[words[0].name].completed, '导入应更新并保存单词进度');
      let exported, downloaded = '';
      const createURL = win.URL.createObjectURL, revokeURL = win.URL.revokeObjectURL, click = win.HTMLAnchorElement.prototype.click;
      try {
        win.URL.createObjectURL = blob => { exported = blob; return 'blob:test-progress'; };
        win.URL.revokeObjectURL = () => {};
        win.HTMLAnchorElement.prototype.click = function() { downloaded = this.download; };
        $('#export-progress').click();
        assert(downloaded.startsWith('shiyu-progress-'), '应发起进度备份下载');
        assert(JSON.parse(await exported.text()).words[words[0].name].completed, '导出应使用导入后的最新状态');
      } finally {
        win.URL.createObjectURL = createURL; win.URL.revokeObjectURL = revokeURL; win.HTMLAnchorElement.prototype.click = click;
      }
      $('#backup-dialog [data-close]').click();
      $('[data-module="sentences"]').click(); $('[data-module="words"]').click();
      assert($('[data-index="0"] .word-status.done'), '返回单词页应保留完成状态');
    });
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
    await test('Esc 与键盘左上的 `~· 键都能查看单词', async () => {
      await load();
      activate(0);
      const press = (target, init) => target.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
      press($('#spelling-input'), { key: '·', code: 'Backquote' });
      assert(!$('#spelling-input'), '按 `~· 键应查看单词');
      activate(1);
      press($('#spelling-input'), { key: 'Escape', code: 'Escape' });
      assert(!$('#spelling-input'), '按 Esc 应查看单词');
    });
    for (const width of [1440, 390]) {
      await test(`${width}px：庆祝后复习首词，输入框避开顶栏且可点击`, async () => {
        await load({ width });
        frame.contentWindow.scrollTo(0, frame.contentDocument.body.scrollHeight);
        activate(19); answer(last);
        $('#chapter-done-review').click();
        // 「再巩固一遍」只定位到首词卡片，不自动进入拼写状态（避免弹窗关闭后滚动位置跳变）。
        assert(!$('#spelling-input'), '复习不应自动进入拼写状态');
        activate(0);
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
    for (const width of [1440, 390]) {
      await test(`${width}px：语句中英展示、句末发音按钮与模块切换`, async () => {
        await load({ width });
        const before = localStorage.getItem(STORAGE_KEY);
        activate(0);
        $('[data-module="sentences"]').click();
        await until(() => Boolean($('.sentence-card')));
        assert($('#words-view').hidden && !$('#sentences-view').hidden, '应显示语句模块');
        assert($('#float-progress').hidden && $('#save-status').hidden, '应隐藏单词进度控件');
        assert(!$('#spelling-input'), '切换模块应退出拼写');
        assert($('.sentence-english [lang="en"]').textContent === "Everything is about people, everything in this life that's worth a damn.", '原句应完整保留');
        assert($('.sentence-chinese').textContent === '世间所有值得珍惜的东西，都与人有关。', '译文应完整保留');
        assert($('.sentence-english').lastElementChild.matches('.sentence-pronounce'), '发音按钮应在英文原句后');
        assert($('#sentence-previous').disabled && $('#sentence-next').disabled, '不足一页时两端禁用');
        const event = new frame.contentWindow.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        frame.contentDocument.dispatchEvent(event);
        assert(!event.defaultPrevented && !$('#spelling-input'), '语句页面应允许自然 Tab 导航');
        assert(frame.contentDocument.documentElement.scrollWidth <= frame.contentWindow.innerWidth, '语句页面出现横向滚动');
        const rect = $('.sentence-pronounce').getBoundingClientRect();
        assert(rect.left >= 0 && rect.right <= width, '发音按钮应位于视口内');
        assert(localStorage.getItem(STORAGE_KEY) === before, '浏览语句不应改变单词进度');
        $('[data-module="words"]').click();
        assert(!$('#words-view').hidden && !$('#float-progress').hidden, '应恢复单词模块');
        activate(0);
        assert($('#spelling-input'), '返回后仍可拼写');
      });
    }
    await test('语句分页与整句发音，重复播放、翻页及切换模块停止播放', async () => {
      await load({ mockSpeech: true });
      const win = frame.contentWindow;
      const fetchOriginal = win.fetch.bind(win);
      const fixture = Array.from({ length: 21 }, (_, index) => ({ english: `Test sentence ${index + 1}.`, chinese: `测试语句 ${index + 1}。` }));
      win.fetch = (url, options) => String(url).endsWith('/sentences.json')
        ? Promise.resolve(new win.Response(JSON.stringify(fixture))) : fetchOriginal(url, options);
      const spoken = [];
      let canceled = 0;
      // 只在测试 iframe 替换语音引擎，核验参数和回调，不依赖设备音色。
      win.speechSynthesis.getVoices = () => [{ lang: 'en-US', localService: true }];
      win.speechSynthesis.speak = utterance => { spoken.push(utterance); utterance.onstart(); };
      win.speechSynthesis.cancel = () => { canceled++; };
      $('[data-module="sentences"]').click();
      await until(() => Boolean($('.sentence-card')));
      assert(frame.contentDocument.querySelectorAll('.sentence-card').length === 10, '第一页应显示 10 句');
      $('.sentence-pronounce').click();
      assert(spoken.at(-1)?.text === fixture[0].english, '应只朗读整句英文');
      $('.sentence-pronounce').click();
      assert(spoken.length === 2 && canceled >= 1, '重复点击应取消上一条');
      $('#sentence-next').click();
      assert(!$('.sentence-pronounce.playing') && canceled >= 2, '翻页应停止播放');
      assert($('.sentence-english span').textContent === fixture[10].english, '第二页应从第 11 句开始');
      $('#sentence-next').click();
      assert(frame.contentDocument.querySelectorAll('.sentence-card').length === 1 && $('#sentence-next').disabled, '尾页仅 1 句，不能继续翻页');
      $('#sentence-previous').click();
      assert($('#sentence-page-indicator').textContent === '2 / 3', '应能返回上一页');
      $('.sentence-pronounce').click();
      spoken.at(-1).onerror({ error: 'network' });
      assert(!$('#sentence-pronunciation-message').hidden, '播放错误应可见');
      $('.sentence-pronounce').click();
      const before = canceled;
      $('[data-module="words"]').click();
      assert(canceled > before, '切换模块应停止播放');
      $('[data-module="sentences"]').click();
      assert($('#sentence-page-indicator').textContent === '2 / 3', '当前会话应保留语句页码');
    });
    await test('语句加载失败可重试，空数据与格式错误明确提示', async () => {
      await load();
      const win = frame.contentWindow;
      const fetchOriginal = win.fetch.bind(win);
      let response = () => new win.Response('', { status: 404 });
      win.fetch = (url, options) => String(url).endsWith('/sentences.json')
        ? Promise.resolve(response()) : fetchOriginal(url, options);
      $('[data-module="sentences"]').click();
      await until(() => !$('#sentence-retry').hidden);
      assert($('#sentence-load-message').textContent.includes('加载失败'), '失败应有明确提示');
      response = () => new win.Response('[{}]');
      $('#sentence-retry').click();
      await until(() => !$('#sentence-retry').hidden);
      assert(!$('.sentence-card'), '格式错误不能渲染不完整卡片');
      response = () => new win.Response('[]');
      $('#sentence-retry').click();
      await until(() => $('#sentence-count').textContent === '共 0 句');
      assert($('#sentence-load-message').textContent.includes('还没有收录') && $('#sentence-pagination').hidden, '空数据应有空状态且无分页');
    });
    for (const width of [1440, 390, 320]) {
      await test(`${width}px：切换主题保留输入与进度，刷新恢复，语句与弹窗共用主题`, async () => {
        localStorage.setItem(THEME_KEY, 'light');
        await load({ width });
        const before = localStorage.getItem(STORAGE_KEY);
        activate(0);
        const input = $('#spelling-input');
        input.value = 'not submitted';
        $('#theme-toggle').click();
        assert(frame.contentDocument.documentElement.dataset.theme === 'dark', '应切换为深色');
        assert($('#theme-toggle').getAttribute('aria-pressed') === 'true', '应告知深色已启用');
        assert($('#spelling-input') === input && input.value === 'not submitted', '不能重绘或清空输入');
        assert(localStorage.getItem(STORAGE_KEY) === before, '主题不应影响单词进度');
        assert(localStorage.getItem(THEME_KEY) === 'dark', '应保存主题偏好');
        $('#theme-toggle').focus();
        const key = new frame.contentWindow.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        $('#theme-toggle').dispatchEvent(key);
        assert(!key.defaultPrevented && input.value === 'not submitted', '主题按钮的 Tab 不应提交单词');
        const rect = $('#theme-toggle').getBoundingClientRect();
        const status = $('#save-status').getBoundingClientRect();
        assert(rect.right <= width && rect.left >= status.right, '主题按钮应在顶栏内且不与保存状态重叠');
        assert(frame.contentDocument.documentElement.scrollWidth <= width, '出现横向滚动');
        $('#chapter-open').click();
        assert(frame.contentWindow.getComputedStyle($('#chapter-dialog')).colorScheme === 'dark', '章节弹窗应使用深色');
        $('#chapter-dialog [data-close]').click();
        $('#save-status').click();
        assert(frame.contentWindow.getComputedStyle($('#backup-dialog')).colorScheme === 'dark', '备份弹窗应使用深色');
        $('#backup-dialog [data-close]').click();
        await load({ width });
        assert(frame.contentDocument.documentElement.dataset.theme === 'dark', '刷新应恢复深色');
        $('[data-module="sentences"]').click();
        await until(() => Boolean($('.sentence-card')));
        assert(frame.contentWindow.getComputedStyle($('.sentence-card')).colorScheme === 'dark', '语句应共用深色');
        $('#theme-toggle').click();
        assert(frame.contentDocument.documentElement.dataset.theme === 'light', '应能从语句页面切回浅色');
        assert(localStorage.getItem(THEME_KEY) === 'light', '应保存浅色偏好');
      });
    }
    await test('主题偏好异常回退浅色，同源页面更新与删除偏好同步生效', async () => {
      localStorage.setItem(THEME_KEY, 'invalid');
      await load();
      assert(frame.contentDocument.documentElement.dataset.theme === 'light', '无效偏好应回退浅色');
      localStorage.setItem(THEME_KEY, 'dark');
      await until(() => $('#theme-toggle').getAttribute('aria-pressed') === 'true');
      localStorage.removeItem(THEME_KEY);
      await until(() => frame.contentDocument.documentElement.dataset.theme === 'light');
      assert($('#theme-toggle').getAttribute('aria-pressed') === 'false', '删除偏好后按钮应同步');
    });
    await test('主题保存失败或存储不可读时仍能切换，并明确提示', async () => {
      for (const setupScript of [
        `const setItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key === '${THEME_KEY}') throw new Error('quota'); return setItem.call(this, key, value); };`,
        `Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });`,
      ]) {
        await load({ setupScript });
        $('#theme-toggle').click();
        assert(frame.contentDocument.documentElement.dataset.theme === 'dark', '存储不可用时应能切换');
        assert(!$('#theme-message').hidden && $('#theme-message').textContent.includes('无法保存'), '应明确提示保存失败');
        $('[data-module="sentences"]').click();
        assert(!$('#theme-message').hidden, '切换模块后提示仍应可见');
      }
    });
  } catch (error) {
    failed++;
    results.append(Object.assign(document.createElement('li'), { textContent: `测试准备失败：${error.message}`, className: 'fail' }));
  } finally {
    frame.removeAttribute('srcdoc');
    frame.src = 'about:blank';
    await until(() => frame.contentDocument?.URL === 'about:blank');
    if (original === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, original);
    if (originalTheme === null) localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, originalTheme);
    summary.textContent = `${passed} 项通过，${failed} 项失败`;
    run.disabled = false;
  }
});
