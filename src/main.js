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

// 弹窗打开时，左右箭头在弹窗内的按钮之间循环移动焦点，不必逐个 Tab。
function dialogButtons(dialog) {
  return [...dialog.querySelectorAll('button')].filter(button => !button.disabled && button.getClientRects().length);
}
document.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const dialog = document.querySelector('dialog[open]');
  if (!dialog) return;
  const buttons = dialogButtons(dialog);
  if (buttons.length < 2) return;
  const step = event.key === 'ArrowRight' ? 1 : -1;
  const from = buttons.indexOf(document.activeElement);
  // 焦点不在按钮上时，右箭头从头开始，左箭头从末尾开始。
  const target = from < 0 ? (step > 0 ? 0 : buttons.length - 1) : (from + step + buttons.length) % buttons.length;
  event.preventDefault();
  buttons[target].focus();
});

document.querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => switchModule(button.dataset.module)));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
window.addEventListener('pagehide', () => pronunciation.stop());
document.addEventListener('visibilitychange', () => { if (document.hidden) pronunciation.stop(); });
wordPage.load();
