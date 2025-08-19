import { AnnotationResponse } from './types';

const CACHE_NAME = 'annotation-cache';
const CACHE_VERSION = '1.0';

export interface CacheEntry {
  response: AnnotationResponse;
  timestamp: number;
  textHash: string;
}

// 生成文本哈希
function generateTextHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// 生成缓存键
function generateCacheKey(text: string): string {
  const textHash = generateTextHash(text);
  return `${CACHE_VERSION}:${textHash}`;
}

// 从IndexedDB缓存中获取注释
export async function getFromCache(text: string): Promise<AnnotationResponse | null> {
  try {
    const cacheKey = generateCacheKey(text);
    
    // 尝试从sessionStorage获取（更快）
    const sessionData = sessionStorage.getItem(`${CACHE_NAME}:${cacheKey}`);
    if (sessionData) {
      const entry: CacheEntry = JSON.parse(sessionData);
      // 检查是否过期（1小时）
      if (Date.now() - entry.timestamp < 60 * 60 * 1000) {
        return entry.response;
      }
    }

    // 尝试从IndexedDB获取
    if ('indexedDB' in window) {
      const db = await openCacheDB();
      const transaction = db.transaction([CACHE_NAME], 'readonly');
      const store = transaction.objectStore(CACHE_NAME);
      const result = await new Promise<CacheEntry | undefined>((resolve) => {
        const request = store.get(cacheKey);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });

      if (result && Date.now() - result.timestamp < 24 * 60 * 60 * 1000) { // 24小时
        // 同时缓存到sessionStorage
        sessionStorage.setItem(`${CACHE_NAME}:${cacheKey}`, JSON.stringify(result));
        return result.response;
      }
    }

    return null;
  } catch (error) {
    console.warn('Cache retrieval failed:', error);
    return null;
  }
}

// 存储注释到缓存
export async function storeInCache(text: string, response: AnnotationResponse): Promise<void> {
  try {
    const cacheKey = generateCacheKey(text);
    const entry: CacheEntry = {
      response,
      timestamp: Date.now(),
      textHash: generateTextHash(text)
    };

    // 存储到sessionStorage
    sessionStorage.setItem(`${CACHE_NAME}:${cacheKey}`, JSON.stringify(entry));

    // 存储到IndexedDB
    if ('indexedDB' in window) {
      const db = await openCacheDB();
      const transaction = db.transaction([CACHE_NAME], 'readwrite');
      const store = transaction.objectStore(CACHE_NAME);
      store.put(entry, cacheKey);
    }
  } catch (error) {
    console.warn('Cache storage failed:', error);
  }
}

// 打开IndexedDB数据库
function openCacheDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_NAME, 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(CACHE_NAME)) {
        db.createObjectStore(CACHE_NAME);
      }
    };
  });
}

// 清理过期缓存
export async function cleanExpiredCache(): Promise<void> {
  try {
    // 清理sessionStorage
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`${CACHE_NAME}:`)) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || '');
          if (Date.now() - data.timestamp > 60 * 60 * 1000) { // 1小时
            sessionStorage.removeItem(key);
          }
        } catch {
          sessionStorage.removeItem(key);
        }
      }
    }

    // 清理IndexedDB
    if ('indexedDB' in window) {
      const db = await openCacheDB();
      const transaction = db.transaction([CACHE_NAME], 'readwrite');
      const store = transaction.objectStore(CACHE_NAME);
      const cursorRequest = store.openCursor();
      
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry: CacheEntry = cursor.value;
          if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) { // 24小时
            cursor.delete();
          }
          cursor.continue();
        }
      };
    }
  } catch (error) {
    console.warn('Cache cleanup failed:', error);
  }
}
