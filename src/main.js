import { chapterCount, chapterWords, isCorrect, recordAttempt, completedCount, validateDictionary, validateProgress, mergeProgress } from './learning.js';
import { STORAGE_KEY, loadProgress, saveProgress } from './storage.js';
import { createPronunciation } from './pronunciation.js';
import { createChime } from './feedback.js';

const icons = {
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z"/><path d="M13 7a3 3 0 0 1 3-3h4v14h-3a4 4 0 0 0-4 3"/>',
  layers: '<rect x="7" y="3" width="13" height="15" rx="3"/><path d="M4 7v12a2 2 0 0 0 2 2h10M11 8h5m-5 4h3"/>',
  sentence: '<path d="M4 5h16v12H8l-4 4zM8 9h8m-8 4h5"/>',
  article: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  save: '<path d="M5 4h12l3 3v13H4V4zM8 4v6h8V4M8 20v-6h8v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  speaker: '<path d="M11 4 6 8H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const $ = selector => document.querySelector(selector);
let words, progress, storage, storageWarning = '', storageBlocked = false;
let activeWord = null;
let cursorWord = null;
let latestCorrect = null;
let speakingWord = null;
const pronunciation = createPronunciation({
  synthesis: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  onState(word, message) {
    speakingWord = word;
    document.querySelectorAll('.pronounce').forEach(button => {
      const playing = words[Number(button.closest('.word-card').dataset.index)].name === word;
      button.classList.toggle('playing', playing);
      button.setAttribute('aria-busy', String(playing));
    });
    const notice = $('#pronunciation-message');
    if (notice) { notice.textContent = message; notice.hidden = !message; }
  },
});
const chime = createChime();

async function init() {
  try {
    const response = await fetch(new URL('../public/data/cet4.json', import.meta.url));
    if (!response.ok) throw new Error('词库请求失败');
    words = validateDictionary(await response.json());
    try { storage = window.localStorage; } catch { storage = null; }
    const loaded = loadProgress(storage, words);
    progress = loaded.progress;
    storageWarning = loaded.error || '';
    storageBlocked = Boolean(loaded.error);
    renderShell();
    renderChapter();
    bindEvents();
  } catch (error) {
    $('#app').innerHTML = `<div class="error-page">${icon('book')}<h1>单词卡片还没有准备好</h1><p>词库加载失败，请检查本地服务后重试。</p><button class="primary" id="reload">重新加载</button></div>`;
    $('#reload').addEventListener('click', () => location.reload());
    console.error(error);
  }
}

function renderShell() {
  const brandIconUrl = document.querySelector('link[rel="icon"]').href;
  $('#app').innerHTML = `
    <a class="skip-link" href="#word-grid">跳到单词卡片</a>
    <aside class="sidebar">
      <a class="brand" href="./" aria-label="拾语首页"><img class="brand-icon" src="${escape(brandIconUrl)}" width="44" height="44" alt=""><span>拾语<small>LITTLE BY LITTLE</small></span></a>
      <div class="nav-caption">我的学习空间</div>
      <nav aria-label="学习模块">
        <button class="nav-item selected" aria-current="page">${icon('layers')}<span>单词学习</span><span class="nav-dot"></span></button>
        <button class="nav-item" disabled>${icon('sentence')}<span>语句学习</span><small>即将上线</small></button>
        <button class="nav-item" disabled>${icon('article')}<span>文章学习</span><small>即将上线</small></button>
      </nav>
      <div class="sidebar-bottom">
        <div class="small-note"><span class="note-spark">${icon('spark')}</span><p>每一个单词，<br>都是通往世界的一小步。</p><small>A little progress, every day.</small></div>
        <button class="backup-link" id="backup-open">${icon('save')}进度与备份</button>
        <div class="local-caption"><span class="green-dot"></span>个人学习 · 本地模式</div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar"><div>学习空间 <span class="slash">/</span> <strong>单词学习</strong></div><button class="save-status" id="save-status" aria-label="进度与备份设置">${icon('check')}进度保存在此浏览器</button></header>
      <main>
        <section class="page-heading"><div><div class="eyebrow">A LITTLE EVERY DAY</div><h1>把单词，一点点变成你的。</h1><p>从一个单词开始，让每一次练习都有收获。</p></div><span class="edition">CET-4 学习计划</span></section>
        <section class="course-banner" aria-label="四级词汇学习概览">
          <div class="course-copy"><span class="course-tag">大学英语 · 必备词汇</span><h2>英语四级核心词汇 <span>CET-4</span></h2><p>每天一章，先认识，再亲手拼出来。</p><div class="course-meta"><span>${icon('book')}2,607 个单词</span><i></i><span>131 个章节</span><i></i><span>20 词 / 章</span></div></div>
          <div class="book-art" aria-hidden="true"><span class="art-star">✧</span><div class="book-shadow"></div><div class="art-book"><span>WORDS<br>OPEN<br>WORLDS.</span><small>A–Z &nbsp; / &nbsp; VOL. 01</small></div><span class="art-pill">每一天，近一点 ${icon('spark')}</span><span class="art-orbit"></span></div>
        </section>
        <section class="stats" aria-label="学习进度"><div class="stat"><span class="stat-icon purple">${icon('layers')}</span><div><span class="stat-label">累计已练习</span><div class="stat-value"><strong id="total-completed">0</strong><small>/ 2,607 词</small></div></div></div><div class="stat"><span class="stat-icon mint">${icon('check')}</span><div><span class="stat-label">本章已完成</span><div class="stat-value"><strong id="chapter-completed">0</strong><small id="chapter-size">/ 20 词</small></div></div></div><div class="stat progress-stat"><div class="progress-label"><span>词库学习进度</span><strong id="total-percent">0%</strong></div><progress id="total-progress" max="2607" value="0" aria-label="词库学习进度"></progress><small id="progress-caption">慢慢来，每一个词都算数。</small></div></section>
        <div id="storage-warning" class="warning" role="alert" hidden></div>
        <section class="chapter-section" aria-labelledby="chapter-heading">
          <div class="chapter-toolbar"><div class="chapter-title"><h2 id="chapter-heading"></h2><span id="word-range"></span></div><div class="chapter-actions"><button class="secondary" id="chapter-open">${icon('grid')}章节目录</button><button class="primary" id="practice">开始本章练习 ${icon('arrow')}</button></div></div>
          <div class="instructions">${icon('info')}<span>点击卡片，试着拼出单词。<span class="desktop-tip"> 输入后按 <kbd>Enter</kbd> 检查，按 <kbd>Esc</kbd> 查看单词。</span></span><span class="legend"><span class="green-dot"></span>已练习</span></div>
          <div id="pronunciation-message" class="warning" role="status" hidden></div>
          <div class="word-grid" id="word-grid" tabindex="-1"></div>
          <div class="chapter-finish" id="chapter-finish" hidden>${icon('check')}这一章的单词都练习过了。继续下一章，或再巩固一遍！</div>
          <div class="pagination"><span id="page-summary"></span><div><button class="secondary" id="previous">${icon('chevron', 'reverse')}上一章</button><span id="page-indicator"></span><button class="secondary" id="next">下一章 ${icon('chevron')}</button></div></div>
        </section>
        <footer><span>拾语 · 让学习成为日常</span><span>词库来源 <a href="https://qwertylearner.cn/" target="_blank" rel="noreferrer">Qwerty Learner ↗</a></span></footer>
      </main>
    </div>
    <dialog id="chapter-dialog" aria-labelledby="chapter-dialog-title"><div class="dialog-heading"><div><div class="eyebrow">YOUR LEARNING JOURNEY</div><h2 id="chapter-dialog-title">选择章节</h2></div><button class="icon-button" data-close aria-label="关闭章节目录">${icon('close')}</button></div><p class="dialog-subtitle">每次一小章，慢慢积累。最后一章含 7 个单词。</p><div class="chapter-picker" id="chapter-picker"></div></dialog>
    <dialog id="backup-dialog" aria-labelledby="backup-title"><div class="dialog-heading"><h2 id="backup-title">进度与备份</h2><button class="icon-button" data-close aria-label="关闭进度与备份">${icon('close')}</button></div><p class="dialog-subtitle">学习进度自动保存在当前浏览器，刷新或关闭页面后仍会保留。请使用同一浏览器和访问地址：localhost 与 127.0.0.1 的进度相互独立。清除浏览器数据或更换设备前，可以先导出一份备份。</p><div class="backup-options"><div><h3>带走你的学习进度</h3><p>保存为 JSON 文件，方便日后恢复。</p><button class="primary" id="export-progress">导出进度 ${icon('arrow')}</button></div><div><h3>从备份继续学习</h3><p>合并已有进度，保留已完成记录和当前章节。</p><button class="secondary" id="import-progress">导入进度</button><input type="file" id="import-file" accept=".json,application/json" hidden></div></div><p id="backup-message" role="status"></p></dialog>
    <div class="sr-only" role="status" id="announcement" aria-live="polite"></div>`;
}

function persist() {
  if (!storageBlocked) storageWarning = saveProgress(storage, progress).error || '';
  renderStorageStatus();
}
function renderStorageStatus() {
  $('#storage-warning').hidden = !storageWarning;
  $('#storage-warning').textContent = storageWarning;
  $('#save-status').innerHTML = `${icon(storageWarning ? 'info' : 'check')}${storageWarning ? '当前进度仅在页面中，请备份' : '进度保存在此浏览器'}`;
}
function updateStats() {
  const current = chapterWords(words, progress.chapter);
  const completed = completedCount(progress, current);
  const total = completedCount(progress, words);
  $('#total-completed').textContent = total.toLocaleString();
  $('#chapter-completed').textContent = completed;
  $('#chapter-size').textContent = `/ ${current.length} 词`;
  $('#total-percent').textContent = `${(total / words.length * 100).toFixed(1)}%`;
  $('#total-progress').value = total;
  $('#progress-caption').textContent = total ? `已经积累 ${total} 个单词，继续保持。` : '慢慢来，每一个词都算数。';
  $('#chapter-finish').hidden = completed !== current.length;
  $('#practice').innerHTML = `${completed === current.length ? '再练习一遍' : completed ? '继续本章练习' : '开始本章练习'} ${icon('arrow')}`;
  renderStorageStatus();
}
function renderChapter() {
  const current = chapterWords(words, progress.chapter);
  const start = (progress.chapter - 1) * 20 + 1;
  $('#chapter-heading').textContent = `第 ${String(progress.chapter).padStart(2, '0')} 章`;
  $('#word-range').textContent = `单词 ${start}–${start + current.length - 1}`;
  $('#page-summary').textContent = `本章 ${current.length} 个单词 · 共 ${chapterCount(words)} 章`;
  $('#page-indicator').textContent = `${progress.chapter} / ${chapterCount(words)}`;
  $('#previous').disabled = progress.chapter === 1;
  $('#next').disabled = progress.chapter === chapterCount(words);
  $('#word-grid').innerHTML = current.map((word, index) => `<article class="word-card" data-index="${start + index - 1}">${cardContent(word, start + index)}</article>`).join('');
  updateStats();
}
function cardContent(word, number) {
  const complete = Boolean(progress.words[word.name]?.completed);
  const active = activeWord === word.name;
  const status = complete ? `<span class="word-status done">${icon('check')}已练习</span>` : '<span class="word-status">待练习</span>';
  const header = `<div class="card-top card-header"><span class="word-number">${String(number).padStart(3, '0')}</span><div class="card-tools">${active ? '<span class="writing-label">拼写中</span>' : status}</div></div>`;
  const pronounce = `<button type="button" class="pronounce ${speakingWord === word.name ? 'playing' : ''}" aria-label="${active ? '播放当前单词发音' : `播放 ${escape(word.name)} 的发音`}" title="播放发音" aria-busy="${speakingWord === word.name}">${icon('speaker')}</button>`;
  if (active) {
    return `<div class="card-body">${header}<div class="active-card"><div class="word-name blurred" aria-hidden="true" title="点击返回查看单词">${escape(word.name)}</div><div class="translation" title="点击返回查看单词">${word.trans.map(escape).join('；')}</div><form class="spelling-form"><label class="sr-only" for="spelling-input">输入单词拼写</label><div class="input-row"><input id="spelling-input" name="spelling" placeholder="在这里拼写…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="spell-feedback"><button type="submit" class="check-button" aria-label="检查拼写">${icon('arrow')}</button></div><div class="spell-bottom"><span id="spell-feedback" role="status">Enter 检查拼写</span></div></form></div></div>${pronounce}`;
  }
  return `<div class="card-body">${header}<button class="card-face ${complete ? 'is-complete' : ''}" aria-label="练习 ${escape(word.name)}"><span class="word-name">${escape(word.name)}</span><span class="phonetic">/${escape(word.usphone || word.ukphone)}/</span><span class="translation">${word.trans.map(escape).join('；')}</span><span class="card-bottom ${latestCorrect === word.name ? 'correct-message' : ''}">${latestCorrect === word.name ? `${icon('check')}拼写正确，记得很棒！` : `点击卡片，练习拼写 <span>↗</span>`}</span></button></div>${pronounce}`;
}
function refreshCard(name) {
  const index = words.findIndex(w => w.name === name);
  const card = document.querySelector(`[data-index="${index}"]`);
  if (card) {
    card.innerHTML = cardContent(words[index], index + 1);
    card.classList.toggle('active', activeWord === name);
  }
}
function activate(index) {
  const previous = activeWord;
  activeWord = words[index].name;
  cursorWord = activeWord;
  latestCorrect = null;
  if (previous && previous !== activeWord) refreshCard(previous);
  refreshCard(activeWord);
  $('#spelling-input').focus({ preventScroll: true });
  pronunciation.speak(activeWord);
  $('#spelling-input').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function reveal() {
  const previous = activeWord;
  activeWord = null;
  refreshCard(previous);
  document.querySelector(`[data-index="${words.findIndex(w => w.name === previous)}"] .card-face`)?.focus({ preventScroll: true });
}
function advanceToNext() {
  const current = chapterWords(words, progress.chapter);
  const from = cursorWord && current.some(word => word.name === cursorWord) ? cursorWord : activeWord;
  const currentIndex = from ? current.findIndex(word => word.name === from) : -1;
  const nextIndex = currentIndex + 1;
  if (nextIndex >= current.length) {
    if (currentIndex === current.length - 1) cursorWord = current[currentIndex].name;
    $('#announcement').textContent = '已经是本章最后一个单词';
    return;
  }
  activate(words.indexOf(current[nextIndex]));
}
function changeChapter(chapter) {
  pronunciation.stop();
  progress.chapter = Math.max(1, Math.min(chapterCount(words), chapter));
  activeWord = null;
  cursorWord = null;
  latestCorrect = null;
  persist();
  renderChapter();
  $('#announcement').textContent = `已切换到第 ${progress.chapter} 章`;
}
function showChapters() {
  $('#chapter-picker').innerHTML = Array.from({ length: chapterCount(words) }, (_, i) => {
    const chapter = i + 1;
    const list = chapterWords(words, chapter);
    const complete = completedCount(progress, list);
    return `<button class="chapter-choice ${chapter === progress.chapter ? 'current' : ''} ${complete === list.length ? 'finished' : ''}" data-chapter="${chapter}" ${chapter === progress.chapter ? 'aria-current="true"' : ''}><strong>第 ${String(chapter).padStart(2, '0')} 章</strong><span>${complete === list.length ? '✓ ' : ''}${complete} / ${list.length}</span></button>`;
  }).join('');
  $('#chapter-dialog').showModal();
  $('.chapter-choice.current').focus();
}
function bindEvents() {
  $('#word-grid').addEventListener('click', event => {
    const card = event.target.closest('.word-card');
    if (event.target.closest('.pronounce')) {
      pronunciation.speak(words[Number(card.dataset.index)].name);
      return;
    }
    if (event.target.closest('.word-name.blurred, .active-card .translation')) { reveal(); return; }
    if (event.target.closest('.card-face') || (event.target.closest('.card-header') && !card.classList.contains('active'))) activate(Number(card.dataset.index));
  });
  $('#word-grid').addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeWord) { event.preventDefault(); reveal(); }
  });  $('#word-grid').addEventListener('submit', event => {
    event.preventDefault();
    if (event.isComposing || !activeWord) return;
    const input = $('#spelling-input');
    if (!input.value.trim()) { $('#spell-feedback').textContent = '先输入单词，再检查哦'; input.focus(); return; }
    const correct = isCorrect(input.value, activeWord);
    progress = recordAttempt(progress, activeWord, correct);
    persist();
    if (correct) {
      latestCorrect = activeWord;
      $('#announcement').textContent = `${activeWord} 拼写正确`;
      chime.play();
      reveal();
      updateStats();
    } else {
      input.setAttribute('aria-invalid', 'true');
      input.classList.add('invalid');
      $('#spell-feedback').textContent = '拼写错误，再试一次';
      $('#spell-feedback').classList.add('incorrect');
      input.focus();
      input.select();
    }
  });
  $('#word-grid').addEventListener('input', () => {
    $('#spelling-input')?.removeAttribute('aria-invalid');
    $('#spelling-input')?.classList.remove('invalid');
    $('#spell-feedback')?.classList.remove('incorrect');
    if ($('#spell-feedback')) $('#spell-feedback').textContent = 'Enter 检查拼写';
  });
  $('#previous').addEventListener('click', () => changeChapter(progress.chapter - 1));
  $('#next').addEventListener('click', () => changeChapter(progress.chapter + 1));
  $('#practice').addEventListener('click', () => {
    const current = chapterWords(words, progress.chapter);
    const word = current.find(w => !progress.words[w.name]?.completed) || current[0];
    activate(words.indexOf(word));
  });
  $('#chapter-open').addEventListener('click', showChapters);
  $('#chapter-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-chapter]');
    if (button) { changeChapter(Number(button.dataset.chapter)); $('#chapter-dialog').close(); }
  });
  $('#save-status').addEventListener('click', () => { $('#backup-message').textContent = ''; $('#backup-dialog').showModal(); });
  $('#backup-open').addEventListener('click', () => { $('#backup-message').textContent = ''; $('#backup-dialog').showModal(); });
  document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('#export-progress').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shiyu-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#backup-message').textContent = '已发起备份下载，请在浏览器下载列表中确认文件已保存。';
  });
  $('#import-progress').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('文件过大，请选择小于 5 MB 的进度备份。');
      const incoming = validateProgress(JSON.parse(await file.text()), words);
      progress = mergeProgress(progress, incoming);
      activeWord = null;
      cursorWord = null;
      persist();
      renderChapter();
      $('#backup-message').textContent = storageWarning ? '进度已合并到当前页面，但尚未保存到浏览器，请导出备份。' : '进度已合并并保存，可以继续学习了。';
    } catch (error) {
      $('#backup-message').textContent = error instanceof SyntaxError ? '无法读取此文件，请选择有效的 JSON 进度备份。' : error.message;
    } finally { event.target.value = ''; }
  });
  window.addEventListener('storage', event => {
    if (event.storageArea !== storage || event.key !== STORAGE_KEY) return;
    const loaded = loadProgress(storage, words);
    if (loaded.error) { storageWarning = loaded.error; storageBlocked = true; renderStorageStatus(); return; }
    progress = mergeProgress(progress, loaded.progress);
    // Keep an in-progress answer intact while reflecting progress from another tab.
    if (!activeWord) renderChapter(); else updateStats();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.isComposing) return;
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault();
    advanceToNext();
  });
  window.addEventListener('pagehide', () => pronunciation.stop());
  document.addEventListener('visibilitychange', () => { if (document.hidden) pronunciation.stop(); });
}

init();
