import { SENTENCE_PAGE_SIZE, validateSentences, sentencePage } from './sentences.js';
import { $, icon, escapeHTML as escape } from './ui.js';

export function createSentencePage({ pronunciation }) {
  let sentences = null, currentSentencePage = 1, sentencesLoading = false;

  async function loadSentences() {
    if (sentences !== null || sentencesLoading) return;
    sentencesLoading = true;
    $('#sentence-load-message').hidden = false;
    $('#sentence-load-message').textContent = '正在加载语句…';
    $('#sentence-retry').hidden = true;
    try {
      const response = await fetch(new URL('../public/data/sentences.json', import.meta.url));
      if (!response.ok) throw new Error('语句请求失败');
      sentences = validateSentences(await response.json());
      renderSentences();
    } catch (error) {
      $('#sentence-load-message').textContent = '语句加载失败，请检查本地数据文件后重试。';
      $('#sentence-retry').hidden = false;
      console.error(error);
    } finally { sentencesLoading = false; }
  }

  function renderSentences() {
    const { page, pages, start, items } = sentencePage(sentences, currentSentencePage);
    currentSentencePage = page;
    $('#sentence-count').textContent = `共 ${sentences.length} 句`;
    $('#sentence-load-message').textContent = sentences.length ? '' : '还没有收录语句。喜欢的表达，就从第一句开始。';
    $('#sentence-load-message').hidden = sentences.length > 0;
    $('#sentence-list').innerHTML = items.map((sentence, index) => `
      <article class="sentence-card">
        <span class="sentence-number" aria-label="第 ${start + index + 1} 句">${String(start + index + 1).padStart(2, '0')}</span>
        <div class="sentence-copy">
          <p class="sentence-english"><span lang="en">${escape(sentence.english)}</span> <button type="button" class="sentence-pronounce" data-sentence="${start + index}" aria-label="播放第 ${start + index + 1} 句英文" title="播放英文原句" aria-busy="false">${icon('speaker')}</button></p>
          <p class="sentence-chinese" lang="zh-CN">${escape(sentence.chinese).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')}</p>
        </div>
      </article>`).join('');
    $('#sentence-pagination').hidden = !sentences.length;
    $('#sentence-summary').textContent = `第 ${start + 1}–${start + items.length} 句 · 共 ${sentences.length} 句`;
    $('#sentence-page-indicator').textContent = `${page} / ${pages}`;
    $('#sentence-previous').disabled = page === 1;
    $('#sentence-next').disabled = page === pages;
  }

  function changeSentencePage(page) {
    pronunciation.stop();
    currentSentencePage = page;
    renderSentences();
    $('#sentence-list').scrollIntoView({ block: 'start', behavior: 'instant' });
    $('#sentence-list').focus({ preventScroll: true });
    $('#announcement').textContent = `已切换到语句第 ${currentSentencePage} 页`;
  }

  function setSpeechState(text, message) {
    document.querySelectorAll('.sentence-pronounce').forEach(button => {
      const playing = sentences[Number(button.dataset.sentence)].english === text;
      button.classList.toggle('playing', playing);
      button.setAttribute('aria-busy', String(playing));
    });
    $('#sentence-pronunciation-message').textContent = message;
    $('#sentence-pronunciation-message').hidden = !message;
  }

  $('#sentence-retry').addEventListener('click', loadSentences);
  $('#sentence-previous').addEventListener('click', () => changeSentencePage(currentSentencePage - 1));
  $('#sentence-next').addEventListener('click', () => changeSentencePage(currentSentencePage + 1));
  $('#sentence-list').addEventListener('click', event => {
    const button = event.target.closest('.sentence-pronounce');
    if (button) pronunciation.speak(sentences[Number(button.dataset.sentence)].english);
  });
  $('.sentence-page-size').textContent = `${SENTENCE_PAGE_SIZE} 句 / 页`;
  return { load: loadSentences, setSpeechState };
}
