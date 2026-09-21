// Keep only the latest request; canceled speech events may arrive after a new click.
export function createPronunciation({ synthesis, Utterance, onState }) {
  let current = null;
  function cleanup(request) {
    clearTimeout(request.timer);
    if (request.voicesChanged) synthesis.removeEventListener('voiceschanged', request.voicesChanged);
  }
  function stop() {
    const previous = current;
    current = null;
    if (previous) cleanup(previous);
    // Do not cancel an idle engine immediately before its first utterance.
    if (previous?.utterance || synthesis?.speaking || synthesis?.pending) synthesis.cancel();
    onState(null, '');
  }
  function speak(word) {
    stop();
    if (!synthesis || !Utterance) {
      onState(null, '此浏览器不支持发音，请使用新版 Chrome、Edge 或 Safari。');
      return;
    }
    const request = { utterance: null, timer: null, voicesChanged: null };
    current = request;
    const finish = message => {
      if (current !== request) return;
      current = null;
      cleanup(request);
      onState(null, message);
    };
    const fail = () => {
      if (current !== request) return;
      stop();
      onState(null, '发音未能播放，请重启浏览器后重试。');
    };
    function play(voices) {
      if (current !== request || request.utterance) return;
      cleanup(request);
      request.voicesChanged = null;
      const english = voices.filter(voice => /^en(?:[-_]|$)/i.test(voice.lang));
      if (!english.length) {
        finish(voices.length
          ? '浏览器未找到英语语音。Windows 用户请在“设置 → 时间和语言 → 语音 → 添加语音”中添加英语（美国），然后完全退出并重新打开浏览器。'
          : '浏览器语音列表未能加载，请完全退出并重新打开浏览器后重试。');
        return;
      }
      const american = english.filter(voice => /^en[-_]US$/i.test(voice.lang));
      const voice = american.find(voice => voice.localService) || american[0]
        || english.find(voice => voice.localService) || english.find(voice => voice.default) || english[0];
      const utterance = new Utterance(word);
      utterance.lang = voice.lang.replace('_', '-');
      utterance.voice = voice;
      utterance.rate = 0.85;
      request.utterance = utterance;
      const source = `${voice.name || voice.lang}（${voice.localService ? '本机语音' : '在线语音'}）`;
      let started = false;
      utterance.onstart = () => { if (current === request) started = true; };
      utterance.onend = () => finish('');
      utterance.onerror = event => finish(
        ['canceled', 'interrupted'].includes(event.error) ? ''
          : `发音未能播放：${source}。${voice.localService ? '请重启浏览器，或在 Windows 语音设置中检查英语语音。' : '此语音需要联网，请检查网络，或安装 Windows 英语语音后重启浏览器。'}`
      );
      onState(word, '');
      request.timer = setTimeout(() => {
        if (current !== request) return;
        finish(started
          ? `发音未正常结束：${source}。请重启浏览器后重试。`
          : `发音启动超时：${source}。${voice.localService ? '请完全退出并重新打开浏览器；若仍无声，请在 Windows 语音设置中试听英语语音。' : '在线语音服务未响应，请检查网络，或在 Windows 语音设置中添加英语（美国），重启浏览器后重试。'}`);
        synthesis.cancel();
      }, 15000);
      // cancel() does not reset a paused SpeechSynthesis instance.
      if (synthesis.paused) synthesis.resume();
      synthesis.speak(utterance);
    }
    try {
      const voices = synthesis.getVoices();
      if (voices.length) { play(voices); return; }
      // Chrome loads its voice list asynchronously. Never let an empty list
      // silently delegate the English word to the system's default voice.
      onState(word, '');
      request.voicesChanged = () => {
        try {
          const loaded = synthesis.getVoices();
          if (loaded.length) play(loaded);
        } catch { fail(); }
      };
      synthesis.addEventListener('voiceschanged', request.voicesChanged);
      request.timer = setTimeout(() => {
        try { play(synthesis.getVoices()); } catch { fail(); }
      }, 3000);
      request.voicesChanged();
    } catch { fail(); }
  }
  // Warm up voice discovery without playing sound or requesting permissions.
  try { synthesis?.getVoices(); } catch { /* A click will report the error. */ }
  return { speak, stop };
}
