import test from 'node:test';
import assert from 'node:assert/strict';
import { createChime } from '../src/feedback.js';

// Minimal Web Audio stand-in that records the scheduled tones.
function setup({ state = 'running', failOnCreate = false } = {}) {
  const tones = [];
  let resumes = 0, contexts = 0;
  const param = () => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} });
  class Oscillator {
    constructor() { this.type = ''; this.frequency = param(); this.starts = []; }
    connect() {}
    start(at) { this.starts.push(at); }
    stop() { this.stopped = true; }
  }
  class AudioContextClass {
    constructor() {
      contexts++;
      if (failOnCreate) throw new Error('blocked');
      this.state = state;
      this.currentTime = 10;
      this.destination = {};
    }
    resume() { resumes++; this.state = 'running'; }
    createOscillator() { const osc = new Oscillator(); tones.push(osc); return osc; }
    createGain() { return { gain: param(), connect: () => {} }; }
  }
  return {
    AudioContextClass,
    tones,
    get resumes() { return resumes; },
    get contexts() { return contexts; },
  };
}

test('拼写正确时播放上行三音，音高递升且依次错开', () => {
  const fixture = setup();
  const chime = createChime({ AudioContextClass: fixture.AudioContextClass });
  assert.equal(chime.play(), true);
  assert.equal(fixture.tones.length, 3);
  const [first, second, third] = fixture.tones.map(osc => osc.frequency.value);
  assert.ok(first < second && second < third, '音高应逐个升高');
  const offsets = fixture.tones.map(osc => osc.starts[0]);
  assert.ok(offsets[0] < offsets[1] && offsets[1] < offsets[2], '起始时间应依次错开');
  fixture.tones.forEach(osc => assert.equal(osc.type, 'sine'));
});

test('音频上下文只创建一次，重复播放复用同一实例', () => {
  const fixture = setup();
  const chime = createChime({ AudioContextClass: fixture.AudioContextClass });
  chime.play();
  chime.play();
  assert.equal(fixture.contexts, 1);
  assert.equal(fixture.tones.length, 6);
});

test('挂起状态先恢复再播放', () => {
  const fixture = setup({ state: 'suspended' });
  const chime = createChime({ AudioContextClass: fixture.AudioContextClass });
  chime.play();
  assert.equal(fixture.resumes, 1);
  assert.equal(fixture.tones.length, 3);
});

test('浏览器不支持音频时不报错，返回 false', () => {
  const chime = createChime({ AudioContextClass: null });
  assert.equal(chime.play(), false);
});

test('创建上下文或播放抛错时静默失败，不打断拼写流程', () => {
  const throwing = createChime({ AudioContextClass: setup({ failOnCreate: true }).AudioContextClass });
  assert.equal(throwing.play(), false);
  const broken = createChime({
    audioContext: { state: 'running', currentTime: 0, destination: {}, createOscillator: () => { throw new Error('unavailable'); } },
  });
  assert.equal(broken.play(), false);
});

test('复用外部传入的上下文，不新建实例', () => {
  const ctx = { state: 'running', currentTime: 3, destination: {}, createOscillator: () => ({ frequency: { value: 0 }, connect: () => {}, start: () => {}, stop: () => {} }), createGain: () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }) };
  const chime = createChime({ audioContext: ctx });
  assert.equal(chime.play(), true);
});
