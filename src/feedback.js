// Reward chime for a correct spelling. Synthesized with Web Audio so the
// project stays dependency-free and ships no binary assets.
export function createChime({ audioContext, AudioContextClass } = {}) {
  let context = audioContext || null;
  // Restore the browser's autoplay policy by resuming a suspended context.
  function ensureContext() {
    if (context) return context;
    const Ctor = AudioContextClass || (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext));
    if (!Ctor) return null;
    try { context = new Ctor(); } catch { context = null; }
    return context;
  }
  // Ascending major triad: reads as a small, unmistakable "well done".
  function play() {
    const ctx = ensureContext();
    if (!ctx || typeof ctx.createOscillator !== 'function') return false;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
      const start = ctx.currentTime;
      [[880, 0], [1108.73, 0.09], [1318.51, 0.18]].forEach(([frequency, offset]) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const begins = start + offset;
        const ends = begins + 0.26;
        // Soft attack and exponential release avoid the click of a hard stop.
        gain.gain.setValueAtTime(0.0001, begins);
        gain.gain.exponentialRampToValueAtTime(0.22, begins + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ends);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(begins);
        oscillator.stop(ends + 0.02);
      });
      return true;
    } catch { return false; }
  }
  return { play };
}
