import { CHAPTER_SIZE, chapterCount, chapterWords, isCorrect, recordAttempt, completedCount, validateDictionary, validateProgress, mergeProgress } from './learning.js';
import { STORAGE_KEY, loadProgress, saveProgress } from './storage.js';
import { createChime } from './feedback.js';
import { $, icon, escapeHTML as escape } from './ui.js';

// 单词页面独占练习与进度状态；共用发音由入口传入。
export function createWordPage({ pronunciation, isActive }) {
  // Esc 正下方同一位置是 ` ~ · 键，按 Esc 时容易误触；按物理键位 Backquote 监听，
  // 让它和 Esc 一样查看当前单词（不区分 ` / ~ / ·，也不受输入法状态影响）。
  const isRevealKey = event => event.key === 'Escape' || event.code === 'Backquote';
  let words, progress, storage, storageWarning = '', storageBlocked = false;
  let activeWord = null;
  let cursorWord = null;
  let latestCorrect = null;
  let speakingWord = null;
  let ready = false, loading = false;
  const chime = createChime();

  async function load() {
    if (ready || loading) return;
    loading = true;
    $('#word-load-message').hidden = false;
    $('#word-error').hidden = true;
    $('#save-status').textContent = '正在读取进度…';
    try {
      const response = await fetch(new URL('../public/data/cet4.json', import.meta.url));
      if (!response.ok) throw new Error('词库请求失败');
      words = validateDictionary(await response.json());
      try { storage = window.localStorage; } catch { storage = null; }
      const loaded = loadProgress(storage, words);
      progress = loaded.progress;
      storageWarning = loaded.error || '';
      storageBlocked = Boolean(loaded.error);
      renderChapter();
      ready = true;
      $('#word-content').hidden = false;
      for (const selector of ['#float-progress', '#save-status', '#backup-open']) $(selector).disabled = false;
    } catch (error) {
      $('#word-error').hidden = false;
      $('#save-status').textContent = '进度暂不可用';
      console.error(error);
    } finally {
      loading = false;
      $('#word-load-message').hidden = true;
    }
  }

  function setSpeechState(word, message) {
    speakingWord = word;
    document.querySelectorAll('.pronounce').forEach(button => {
      const playing = words[Number(button.closest('.word-card').dataset.index)].name === word;
      button.classList.toggle('playing', playing);
      button.setAttribute('aria-busy', String(playing));
    });
    $('#pronunciation-message').textContent = message;
    $('#pronunciation-message').hidden = !message;
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
    renderFloatProgress(current, completed, total);
    renderStorageStatus();
  }
  function renderFloatProgress(current, completed, total) {
    const percent = Math.round(total / words.length * 100);
    const done = completed === current.length;
    $('#float-chapter').textContent = `第 ${String(progress.chapter).padStart(2, '0')} 章`;
    $('#float-detail').textContent = done ? `已完成 · 全书 ${percent}%` : `${completed} / ${current.length} 词 · 全书 ${percent}%`;
    $('#float-progress').classList.toggle('is-done', done);
    $('#float-progress').setAttribute('aria-label', `第 ${progress.chapter} 章，本章 ${completed} / ${current.length} 词，全书进度 ${percent}%。打开章节目录`);
  }
  function renderChapter() {
    const current = chapterWords(words, progress.chapter);
    const start = (progress.chapter - 1) * CHAPTER_SIZE + 1;
    $('#chapter-heading').textContent = `第 ${String(progress.chapter).padStart(2, '0')} 章`;
    $('#word-range').textContent = `单词 ${start}–${start + current.length - 1}`;
    $('#page-summary').textContent = `本章 ${current.length} 个单词 · 共 ${chapterCount(words)} 章`;
    $('#page-indicator').textContent = `${progress.chapter} / ${chapterCount(words)}`;
    $('#previous').disabled = progress.chapter === 1;
    $('#next').disabled = progress.chapter === chapterCount(words);
    $('#word-grid').innerHTML = current.map((word, index) => `<article class="word-card" data-index="${start + index - 1}">${cardContent(word, start + index, index + 1, current.length)}</article>`).join('');
    updateStats();
  }
  function cardContent(word, number, chapterNumber, chapterSize) {
    const complete = Boolean(progress.words[word.name]?.completed);
    const active = activeWord === word.name;
    const status = complete ? `<span class="word-status done">${icon('check')}已练习</span>` : '<span class="word-status">待练习</span>';
    const header = `<div class="card-top card-header">
      <span class="word-number">${String(number).padStart(3, '0')}<span class="chapter-number">${chapterNumber}/${chapterSize}</span></span>
      <div class="card-tools">${active ? '<span class="writing-label">拼写中</span>' : status}</div>
    </div>`;
    const pronounce = `<button type="button" class="pronounce ${speakingWord === word.name ? 'playing' : ''}" aria-label="${active ? '播放当前单词发音' : `播放 ${escape(word.name)} 的发音`}" title="播放发音" aria-busy="${speakingWord === word.name}">${icon('speaker')}</button>`;
    if (active) {
      return `<div class="card-body">
        ${header}
        <div class="active-card">
          <div class="word-name blurred" aria-hidden="true" title="点击返回查看单词">${escape(word.name)}</div>
          <div class="translation" title="点击返回查看单词">${word.trans.map(escape).join('；')}</div>
          <form class="spelling-form">
            <label class="sr-only" for="spelling-input">输入单词拼写</label>
            <div class="input-row">
              <input id="spelling-input" name="spelling" placeholder="在这里拼写…" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="spell-feedback">
              <button type="submit" class="check-button" aria-label="检查拼写">${icon('arrow')}</button>
            </div>
            <div class="spell-bottom"><span id="spell-feedback" role="status">Enter 检查拼写</span><span class="spell-tip">拼对后按 Tab 继续</span></div>
          </form>
        </div>
      </div>${pronounce}`;
    }
    return `<div class="card-body">
      ${header}
      <button class="card-face ${complete ? 'is-complete' : ''}" aria-label="练习 ${escape(word.name)}">
        <span class="word-name">${escape(word.name)}</span>
        <span class="phonetic">/${escape(word.usphone || word.ukphone)}/</span>
        <span class="translation">${word.trans.map(escape).join('；')}</span>
        <span class="card-bottom ${latestCorrect === word.name ? 'correct-message' : ''}">${latestCorrect === word.name ? `${icon('check')}拼写正确，记得很棒！` : `点击卡片，练习拼写 <span>↗</span>`}</span>
      </button>
    </div>${pronounce}`;
  }
  function refreshCard(name) {
    const index = words.findIndex(w => w.name === name);
    const card = document.querySelector(`[data-index="${index}"]`);
    if (card) {
      const chapterSize = chapterWords(words, Math.floor(index / CHAPTER_SIZE) + 1).length;
      card.innerHTML = cardContent(words[index], index + 1, index % CHAPTER_SIZE + 1, chapterSize);
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
    keepActiveCardVisible();
  }
  function reveal() {
    const previous = activeWord;
    activeWord = null;
    refreshCard(previous);
    document.querySelector(`[data-index="${words.findIndex(w => w.name === previous)}"] .card-face`)?.focus({ preventScroll: true });
  }
  function checkSpelling() {
    const input = $('#spelling-input');
    if (!activeWord || !input) return 'idle';
    const typed = input.value.trim();
    if (!typed) {
      $('#spell-feedback').textContent = '先输入单词，再检查哦';
      input.focus();
      return 'empty';
    }
    const correct = isCorrect(typed, activeWord);
    progress = recordAttempt(progress, activeWord, correct);
    persist();
    if (correct) {
      latestCorrect = activeWord;
      $('#announcement').textContent = `${activeWord} 拼写正确`;
      chime.play();
      reveal();
      updateStats();
      return 'correct';
    }
    input.setAttribute('aria-invalid', 'true');
    input.classList.add('invalid');
    $('#spell-feedback').textContent = '拼写错误，再试一次';
    $('#spell-feedback').classList.add('incorrect');
    input.focus();
    input.select();
    return 'incorrect';
  }
  function advanceToNext() {
    // 拼写状态下按 Tab 先检查拼写，只有拼对才切到下一个单词。
    if (activeWord && $('#spelling-input')) {
      if (checkSpelling() !== 'correct') return;
    }
    const current = chapterWords(words, progress.chapter);
    // 共用最近一次拼对结果，兼容直接 Tab、Enter 或按钮检查后再 Tab。
    // 还需游标停在末词；庆祝后清空游标，避免关闭弹窗后重复触发。
    if (cursorWord === current.at(-1).name && latestCorrect === cursorWord && completedCount(progress, current) === current.length) {
      celebrateChapter();
      return;
    }
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
  function celebrateChapter() {
    const current = chapterWords(words, progress.chapter);
    const last = progress.chapter === chapterCount(words);
    const completed = completedCount(progress, current);
    const chapterLabel = `第 ${String(progress.chapter).padStart(2, '0')} 章`;
    // 清空游标：整章完成是本轮流程的终点，之后重新进入即为从头复习。
    cursorWord = null;
    $('#chapter-done-title').textContent = '恭喜，您已经学完了本章的所有单词！';
    $('#chapter-done-copy').textContent = `${chapterLabel}的 ${current.length} 个单词都亲手拼对过了，这就是每天的积累。`;
    $('#chapter-done-next').innerHTML = last ? `回到第一章 ${icon('arrow')}` : `进入下一章 ${icon('arrow')}`;
    $('#chapter-done-next').dataset.target = String(last ? 1 : progress.chapter + 1);
    $('#chapter-done-dialog').showModal();
    $('#chapter-done-next').focus();
    chime.playFanfare();
    $('#announcement').textContent = `恭喜，本章 ${completed} 个单词已全部练习完成`;
  }
  function changeChapter(chapter) {
    pronunciation.stop();
    progress.chapter = Math.max(1, Math.min(chapterCount(words), chapter));
    activeWord = null;
    cursorWord = null;
    latestCorrect = null;
    persist();
    renderChapter();
    focusChapterStart();
    $('#announcement').textContent = `已切换到第 ${progress.chapter} 章`;
  }
  function focusChapterStart() {
    const card = document.querySelector('#word-grid .word-card');
    if (!card) return;
    card.scrollIntoView({ block: 'center', behavior: 'auto' });
    card.querySelector('.card-face')?.focus({ preventScroll: true });
  }
  // iOS Safari 键盘弹起不缩小布局视口，页面只滚动到聚焦的输入框，
  // 卡片上方的单词会被键盘遮挡。监听 visualViewport 的 resize（键盘
  // 就位、收起及工具栏变化时触发），把整张激活卡片滚到键盘上方；
  // 卡片高度超出可视区时优先露出输入框。
  function keepActiveCardVisible() {
    const viewport = window.visualViewport;
    if (!activeWord || !viewport) return;
    const card = document.querySelector('.word-card.active');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const visibleTop = viewport.offsetTop;
    const visibleBottom = viewport.offsetTop + viewport.height;
    const margin = 8;
    if (rect.bottom > visibleBottom) {
      window.scrollBy({ top: rect.bottom - visibleBottom + margin, behavior: 'auto' });
    } else if (rect.top < visibleTop) {
      window.scrollBy({ top: rect.top - visibleTop - margin, behavior: 'auto' });
    }
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
      if (isRevealKey(event) && activeWord) { event.preventDefault(); reveal(); }
    });
    $('#word-grid').addEventListener('submit', event => {
      event.preventDefault();
      if (event.isComposing) return;
      checkSpelling();
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
    $('#float-progress').addEventListener('click', showChapters);
    $('#chapter-picker').addEventListener('click', event => {
      const button = event.target.closest('[data-chapter]');
      if (button) { $('#chapter-dialog').close(); changeChapter(Number(button.dataset.chapter)); }
    });
    $('#chapter-done-next').addEventListener('click', event => {
      const target = Number(event.currentTarget.dataset.target) || 1;
      $('#chapter-done-dialog').close();
      changeChapter(target);
    });
    $('#chapter-done-review').addEventListener('click', () => {
      $('#chapter-done-dialog').close();
      focusChapterStart();
    });
    $('#chapter-done-close').addEventListener('click', () => {
      $('#chapter-done-dialog').close();
      document.querySelector('#word-grid .word-card .card-face')?.focus({ preventScroll: true });
    });
    $('#save-status').addEventListener('click', () => { $('#backup-message').textContent = ''; $('#backup-dialog').showModal(); });
    $('#backup-open').addEventListener('click', () => { $('#backup-message').textContent = ''; $('#backup-dialog').showModal(); });
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
        latestCorrect = null;
        persist();
        renderChapter();
        $('#backup-message').textContent = storageWarning ? '进度已合并到当前页面，但尚未保存到浏览器，请导出备份。' : '进度已合并并保存，可以继续学习了。';
      } catch (error) {
        $('#backup-message').textContent = error instanceof SyntaxError ? '无法读取此文件，请选择有效的 JSON 进度备份。' : error.message;
      } finally { event.target.value = ''; }
    });
    window.addEventListener('storage', event => {
      if (!ready || event.storageArea !== storage || event.key !== STORAGE_KEY) return;
      const loaded = loadProgress(storage, words);
      if (loaded.error) { storageWarning = loaded.error; storageBlocked = true; renderStorageStatus(); return; }
      progress = mergeProgress(progress, loaded.progress);
      // Keep an in-progress answer intact while reflecting progress from another tab.
      if (!activeWord) renderChapter(); else updateStats();
    });
    document.addEventListener('keydown', event => {
      if (event.target.closest?.('#theme-toggle')) return;
      if (!ready || !isActive()) return;
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.isComposing) return;
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault();
      advanceToNext();
    });
    window.visualViewport?.addEventListener('resize', keepActiveCardVisible);
  }

  bindEvents();
  $('#word-retry').addEventListener('click', load);
  return { load, setSpeechState, leave() { if (activeWord) reveal(); } };
}
