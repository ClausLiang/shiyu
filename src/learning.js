export const CHAPTER_SIZE = 20;
export const SCHEMA_VERSION = 1;
export const DICTIONARY_ID = 'cet4-qwerty-2607-v1';

export function chapterCount(words) {
  return Math.ceil(words.length / CHAPTER_SIZE);
}

export function chapterWords(words, chapter) {
  const safeChapter = Math.max(1, Math.min(chapterCount(words), Math.trunc(chapter) || 1));
  return words.slice((safeChapter - 1) * CHAPTER_SIZE, safeChapter * CHAPTER_SIZE);
}

export function isCorrect(answer, word) {
  return answer.trim().toLowerCase() === word.trim().toLowerCase();
}

export function emptyProgress() {
  return { version: SCHEMA_VERSION, dictionary: DICTIONARY_ID, chapter: 1, words: {} };
}

export function validateDictionary(words) {
  if (!Array.isArray(words) || words.length !== 2607 ||
    words.some(w => !w || typeof w.name !== 'string' || !w.name.trim() || !Array.isArray(w.trans) || !w.trans.length || w.trans.some(t => typeof t !== 'string') || typeof w.usphone !== 'string' || typeof w.ukphone !== 'string') ||
    new Set(words.map(w => w.name)).size !== words.length) {
    throw new Error('词库不完整，请重新加载页面。');
  }
  return words;
}

export function validateProgress(data, dictionary) {
  if (!data || data.version !== SCHEMA_VERSION || data.dictionary !== DICTIONARY_ID ||
    !Number.isInteger(data.chapter) || data.chapter < 1 || data.chapter > chapterCount(dictionary) ||
    !data.words || typeof data.words !== 'object' || Array.isArray(data.words)) {
    throw new Error('进度文件格式或词库版本不匹配。');
  }
  const validNames = new Set(dictionary.map(w => w.name));
  const clean = emptyProgress();
  clean.chapter = data.chapter;
  for (const [name, record] of Object.entries(data.words)) {
    if (!validNames.has(name) || !record || typeof record.completed !== 'boolean' ||
      !Number.isSafeInteger(record.attempts) || record.attempts < 1 ||
      !Number.isSafeInteger(record.correct) || record.correct < 0 || record.correct > record.attempts ||
      record.completed !== (record.correct > 0) ||
      typeof record.lastPracticedAt !== 'string' || !Number.isFinite(Date.parse(record.lastPracticedAt))) {
      throw new Error('进度文件包含无效的单词记录。');
    }
    clean.words[name] = { completed: record.completed, attempts: record.attempts, correct: record.correct, lastPracticedAt: record.lastPracticedAt };
  }
  return clean;
}

export function recordAttempt(progress, name, correct, now = new Date().toISOString()) {
  const previous = progress.words[name] ?? { attempts: 0, correct: 0, completed: false };
  return { ...progress, words: { ...progress.words, [name]: {
    attempts: previous.attempts + 1,
    correct: previous.correct + Number(correct),
    completed: previous.completed || correct,
    lastPracticedAt: now,
  } } };
}

export function completedCount(progress, words) {
  return words.filter(w => progress.words[w.name]?.completed).length;
}

// Merge by maximum counters: importing the same backup twice must be idempotent.
// A future cloud implementation will need per-attempt IDs for exact event merging.
export function mergeProgress(current, incoming) {
  const merged = { ...current, words: { ...current.words } };
  for (const [name, record] of Object.entries(incoming.words)) {
    const existing = merged.words[name];
    merged.words[name] = existing ? {
      completed: existing.completed || record.completed,
      attempts: Math.max(existing.attempts, record.attempts),
      correct: Math.max(existing.correct, record.correct),
      lastPracticedAt: Date.parse(existing.lastPracticedAt) >= Date.parse(record.lastPracticedAt) ? existing.lastPracticedAt : record.lastPracticedAt,
    } : { ...record };
  }
  return merged;
}
