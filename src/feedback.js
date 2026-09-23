// Reward chimes. Synthesized with Web Audio so the project stays
// dependency-free and ships no binary assets.
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
  // Shared scheduler: each note is a soft-attack, exponential-release sine tone.
  function schedule(notes) {
    const ctx = ensureContext();
    if (!ctx || typeof ctx.createOscillator !== 'function') return false;
    try {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume();
      const start = ctx.currentTime;
      notes.forEach(([frequency, offset, duration, peak]) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        const begins = start + offset;
        const ends = begins + duration;
        gain.gain.setValueAtTime(0.0001, begins);
        gain.gain.exponentialRampToValueAtTime(peak, begins + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ends);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(begins);
        oscillator.stop(ends + 0.02);
      });
      return true;
    } catch { return false; }
  }
  // Ascending major triad: reads as a small, unmistakable "well done".
  function play() {
    return schedule([[880, 0, 0.26, 0.22], [1108.73, 0.09, 0.26, 0.22], [1318.51, 0.18, 0.26, 0.22]]);
  }
  // Longer fanfare for finishing a whole chapter, so it cannot be mistaken
  // for the per-word chime: a rising arpeggio plus a sustained major chord.
  function playFanfare() {
    return schedule([
      [523.25, 0.00, 0.30, 0.20],
      [659.25, 0.13, 0.30, 0.20],
      [783.99, 0.26, 0.30, 0.20],
      [1046.50, 0.39, 0.55, 0.24],
      [1318.51, 0.52, 0.90, 0.18],
      [783.99, 0.52, 0.90, 0.14],
      [1046.50, 0.52, 0.90, 0.14],
    ]);
  }
  return { play, playFanfare };
}
