import { createWordPage } from './word-page.js';
import { createSentencePage } from './sentence-page.js';
import { createPronunciation } from './pronunciation.js';
import { $ } from './ui.js';

// 入口仅协调页面导航和共用资源，各页面管理自己的数据、渲染与事件。
let activeModule = 'words';
const pronunciation = createPronunciation({
  synthesis: window.speechSynthesis,
  Utterance: window.SpeechSynthesisUtterance,
  onState(text, message) {
    const page = activeModule === 'words' ? wordPage : sentencePage;
    page.setSpeechState(text, message);
  },
});
const wordPage = createWordPage({ pronunciation, isActive: () => activeModule === 'words' });
const sentencePage = createSentencePage({ pronunciation });

function switchModule(module) {
  if (activeModule === module) return;
  pronunciation.stop();
  if (activeModule === 'words') wordPage.leave();
  activeModule = module;
  const showSentences = module === 'sentences';
  $('#words-view').hidden = showSentences;
  $('#sentences-view').hidden = !showSentences;
  $('#float-progress').hidden = showSentences;
  $('#save-status').hidden = showSentences;
  $('#module-title').textContent = showSentences ? '语句学习' : '单词学习';
  $('.skip-link').href = showSentences ? '#sentence-list' : '#word-grid';
  $('.skip-link').textContent = showSentences ? '跳到语句列表' : '跳到单词卡片';
  document.querySelectorAll('[data-module]').forEach(button => {
    const selected = button.dataset.module === module;
    button.classList.toggle('selected', selected);
    const dot = button.querySelector('.nav-dot');
    if (dot) dot.hidden = !selected;
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  document.querySelector(`[data-module="${module}"]`).focus({ preventScroll: true });
  if (showSentences) sentencePage.load();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

document.querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => switchModule(button.dataset.module)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
window.addEventListener('pagehide', () => pronunciation.stop());
document.addEventListener('visibilitychange', () => { if (document.hidden) pronunciation.stop(); });
wordPage.load();
