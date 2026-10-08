export const SENTENCE_PAGE_SIZE = 10;

export function validateSentences(data) {
  if (!Array.isArray(data) || data.some(sentence =>
    !sentence || typeof sentence.english !== 'string' || !sentence.english.trim()
    || typeof sentence.chinese !== 'string' || !sentence.chinese.trim())) {
    throw new Error('语句数据格式错误，每条语句都需要英文原句和中文翻译。');
  }
  return data;
}

export function sentencePage(sentences, requestedPage) {
  const pages = Math.max(1, Math.ceil(sentences.length / SENTENCE_PAGE_SIZE));
  const page = Math.max(1, Math.min(pages, Number.isInteger(requestedPage) ? requestedPage : 1));
  const start = (page - 1) * SENTENCE_PAGE_SIZE;
  return { page, pages, start, items: sentences.slice(start, start + SENTENCE_PAGE_SIZE) };
}
