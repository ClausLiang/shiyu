import test from 'node:test';
import assert from 'node:assert/strict';
import { createPronunciation } from '../src/pronunciation.js';

function setup(voices = [{ lang: 'en-US', name: 'Microsoft Zira', localService: true }]) {
  const states = [], spoken = [], listeners = new Set();
  let canceled = 0, resumed = 0;
  const synthesis = {
    getVoices: () => voices,
    cancel: () => { canceled++; },
    resume: () => { resumed++; synthesis.paused = false; },
    speak: utterance => spoken.push(utterance),
    addEventListener: (event, listener) => listeners.add(listener),
    removeEventListener: (event, listener) => listeners.delete(listener),
  };
  const player = createPronunciation({
    synthesis,
    Utterance: class { constructor(text) { this.text = text; } },
    onState: (...state) => states.push(state),
  });
  return { player, states, spoken, synthesis, listeners,
    voicesChanged: () => [...listeners].forEach(listener => listener()),
    get canceled() { return canceled; }, get resumed() { return resumed; } };
}

test('首次播放不取消空闲引擎，优先本地美式语音，结束后清除状态', () => {
  const local = { lang: 'en-US', localService: true };
  const fixture = setup([{ lang: 'zh-CN', default: true }, { lang: 'en-GB' }, { lang: 'en-US' }, local]);
  try {
    fixture.player.speak('cancel');
    const utterance = fixture.spoken[0];
    assert.equal(fixture.canceled, 0);
    assert.equal(utterance.text, 'cancel');
    assert.equal(utterance.voice, local);
    assert.equal(utterance.lang, 'en-US');
    assert.deepEqual(fixture.states.at(-1), ['cancel', '']);
    utterance.onend();
    assert.deepEqual(fixture.states.at(-1), [null, '']);
  } finally { fixture.player.stop(); }
});

test('连续播放取消前一条，忽略旧回调；停止后不被迟到错误覆盖', () => {
  const fixture = setup();
  try {
    fixture.player.speak('cancel');
    const first = fixture.spoken[0];
    fixture.player.speak('explosive');
    first.onerror({ error: 'interrupted' });
    first.onend();
    assert.deepEqual(fixture.states.at(-1), ['explosive', '']);
    assert.equal(fixture.canceled, 1);
    fixture.player.stop();
    fixture.spoken[1].onerror({ error: 'network' });
    assert.deepEqual(fixture.states.at(-1), [null, '']);
  } finally { fixture.player.stop(); }
});

test('语音列表为空时等待加载再播放，优先选取美式并规范语言标记', () => {
  const voices = [];
  const fixture = setup(voices);
  try {
    fixture.player.speak('cancel');
    assert.equal(fixture.spoken.length, 0);
    voices.push({ lang: 'en-GB' }, { lang: 'en_US', localService: true });
    fixture.voicesChanged();
    assert.equal(fixture.spoken[0].voice, voices[1]);
    assert.equal(fixture.spoken[0].lang, 'en-US');
    assert.equal(fixture.listeners.size, 0);
    fixture.voicesChanged();
    assert.equal(fixture.spoken.length, 1);
  } finally { fixture.player.stop(); }
});

test('等待语音时切换单词只播放最后一词，停止后不因列表加载而播放', () => {
  const voices = [];
  const fixture = setup(voices);
  try {
    fixture.player.speak('cancel');
    fixture.player.speak('explosive');
    voices.push({ lang: 'en-GB', localService: true });
    fixture.voicesChanged();
    assert.equal(fixture.spoken.length, 1);
    assert.equal(fixture.spoken[0].text, 'explosive');
    voices.length = 0;
    fixture.player.speak('cancel');
    fixture.player.stop();
    voices.push({ lang: 'en-US' });
    fixture.voicesChanged();
    assert.equal(fixture.listeners.size, 0);
    assert.equal(fixture.spoken.length, 1);
  } finally { fixture.player.stop(); }
});

test('语音列表一直为空时给出加载提示；没有事件也会再次检查列表', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const voices = [];
  const fixture = setup(voices);
  try {
    fixture.player.speak('cancel');
    context.mock.timers.tick(3000);
    assert.match(fixture.states.at(-1)[1], /语音列表未能加载/);
    assert.equal(fixture.listeners.size, 0);
    fixture.player.speak('cancel');
    voices.push({ lang: 'en-US' });
    context.mock.timers.tick(3000);
    assert.equal(fixture.spoken.length, 1);
  } finally { fixture.player.stop(); }
});

test('播放前恢复暂停状态，避免语音永久排队', () => {
  const fixture = setup();
  try {
    fixture.synthesis.paused = true;
    fixture.synthesis.speak = utterance => {
      assert.equal(fixture.synthesis.paused, false);
      fixture.spoken.push(utterance);
    };
    fixture.player.speak('cancel');
    assert.equal(fixture.resumed, 1);
    assert.equal(fixture.spoken.length, 1);
  } finally { fixture.player.stop(); }
});

test('不支持 API、缺少英语语音、播放错误和同步异常均给出提示', () => {
  const states = [];
  createPronunciation({ onState: (...state) => states.push(state) }).speak('cancel');
  assert.match(states.at(-1)[1], /不支持/);
  const missing = setup([{ lang: 'zh-CN' }]);
  missing.player.speak('cancel');
  assert.equal(missing.spoken.length, 0);
  assert.match(missing.states.at(-1)[1], /未找到英语/);
  const fixture = setup();
  try {
    fixture.player.speak('cancel');
    fixture.spoken[0].onerror({ error: 'network' });
    assert.match(fixture.states.at(-1)[1], /Microsoft Zira（本机语音）/);
    fixture.synthesis.speak = () => { throw new Error('unavailable'); };
    fixture.player.speak('cancel');
    assert.match(fixture.states.at(-1)[1], /未能播放/);
  } finally { fixture.player.stop(); }
});

test('超时区分在线语音启动无响应和已开始但未结束，允许重试', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const fixture = setup([{ lang: 'en-US', name: 'Google US English', localService: false }]);
  try {
    fixture.player.speak('cancel');
    context.mock.timers.tick(15000);
    assert.match(fixture.states.at(-1)[1], /启动超时.*Google US English（在线语音）/);
    assert.equal(fixture.canceled, 1);
    fixture.player.speak('cancel');
    fixture.spoken[1].onstart();
    context.mock.timers.tick(15000);
    assert.match(fixture.states.at(-1)[1], /未正常结束/);
  } finally { fixture.player.stop(); }
});
