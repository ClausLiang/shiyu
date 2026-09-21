import { emptyProgress, validateProgress } from './learning.js';

export const STORAGE_KEY = 'shiyu:learning:v1';

export function loadProgress(storage, dictionary) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { progress: raw ? validateProgress(JSON.parse(raw), dictionary) : emptyProgress(), error: null };
  } catch {
    return { progress: emptyProgress(), error: '本地进度无法读取。原记录未改动；本次可继续练习并导出备份。' };
  }
}

export function saveProgress(storage, progress) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return { error: null };
  } catch {
    return { error: '进度暂时无法保存到浏览器，请导出备份，避免关闭页面后丢失。' };
  }
}
