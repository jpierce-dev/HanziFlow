// 使用 cnchar 和 zdict.js 的汉字数据服务
// cnchar 提供拼音、笔画、部首等核心功能
// zdict.js 提供汉典网站的汉字释义和组词数据

import cnchar from 'cnchar';
import 'cnchar-poly';
import 'cnchar-radical';
import 'cnchar-voice';
import 'cnchar-idiom';
import 'cnchar-words';
import { HanziInfo, SearchResult } from "../types";
import { getFrequencySort } from "./frequency-data";

// zdict.js 数据接口类型: 拼音 -> 释义数组 的映射
// 例如: { "shèng": ["兴旺...", "炽烈..."], "chéng": ["把东西放进去..."] }
type ZdictEntry = Record<string, string[]>;

// 缓存键名
const CACHE_KEY = 'hanzi_meaning_cache';
const ZDICT_CACHE_KEY = 'zdict_data_cache';
const CACHE_VERSION = '3.1';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30天

// zdict.js 数据存储
let ZDICT_DATA: Record<string, ZdictEntry> = {};
let ZDICT_LOADED = false;

// 从localStorage加载缓存的释义和组词数据
const loadCachedMeanings = (): Record<string, { meaning: string; examples: string[] }> => {
  if (typeof window === 'undefined') return {};

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, version, timestamp } = JSON.parse(cached);
      // 检查版本和过期时间
      if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
  } catch (error) {
    console.log('加载缓存失败:', error);
  }
  return {};
};

// 保存到localStorage
const saveCachedMeanings = (meanings: Record<string, { meaning: string; examples: string[] }>) => {
  if (typeof window === 'undefined') return;

  try {
    const cacheData = {
      data: meanings,
      version: CACHE_VERSION,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.log('保存缓存失败:', error);
  }
};

// 缓存的释义和组词数据
let MEANING_CACHE = loadCachedMeanings();

// 清除 zdict 缓存的辅助函数（用于调试）
export const clearZdictCache = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ZDICT_CACHE_KEY);
    console.log('已清除 zdict 缓存');
  }
};

// 加载 zdict.js 数据
// 支持从本地文件或 CDN 加载
const loadZdictData = async (): Promise<void> => {
  if (ZDICT_LOADED) return;

  // 首先尝试从 localStorage 加载缓存的 zdict 数据
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(ZDICT_CACHE_KEY);
      if (cached) {
        const { data, version, timestamp } = JSON.parse(cached);
        if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_EXPIRY) {
          // 验证数据格式：应该是包含多个汉字键的对象
          const keyCount = data && typeof data === 'object' ? Object.keys(data).length : 0;
          if (keyCount > 100) {
            ZDICT_DATA = data;
            ZDICT_LOADED = true;
            console.log(`从缓存加载 zdict 数据成功，共 ${keyCount} 个汉字`);
            return;
          } else {
            console.log(`缓存数据格式不正确（只有 ${keyCount} 个键），将清除缓存并重新加载`);
            // 清除无效缓存
            localStorage.removeItem(ZDICT_CACHE_KEY);
          }
        }
      }
    } catch (error) {
      console.log('从缓存加载 zdict 数据失败:', error);
      // 清除损坏的缓存
      if (typeof window !== 'undefined') {
        localStorage.removeItem(ZDICT_CACHE_KEY);
      }
    }
  }

  // 尝试从多个可能的路径加载 zdict.js 数据
  // 获取项目的 base URL，确保在 GitHub Pages 的子目录下资源引用正确
  const baseUrl = (import.meta as any).env.BASE_URL || '/';

  // 添加时间戳防止浏览器缓存旧文件
  const timestamp = Date.now();
  const possiblePaths = [
    `${baseUrl}zdict-data.json?v=${timestamp}`,
    `./zdict-data.json?v=${timestamp}`,
    `/zdict-data.json?v=${timestamp}`,
  ];

  let lastError: Error | null = null;
  for (const path of possiblePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        const data = await response.json();
        ZDICT_DATA = data;
        ZDICT_LOADED = true;

        // 验证数据格式
        if (data && typeof data === 'object' && Object.keys(data).length > 100) {
          ZDICT_DATA = data;
          ZDICT_LOADED = true;

          // 保存到 localStorage
          if (typeof window !== 'undefined') {
            try {
              const cacheData = {
                data: ZDICT_DATA,
                version: CACHE_VERSION,
                timestamp: Date.now()
              };
              localStorage.setItem(ZDICT_CACHE_KEY, JSON.stringify(cacheData));
              console.log(`✅ 成功加载 zdict 数据，共 ${Object.keys(ZDICT_DATA).length} 个汉字`);
            } catch (e) {
              console.log('保存 zdict 缓存失败:', e);
            }
          }
        } else {
          console.log('⚠️  zdict 数据格式不正确，跳过');
        }
        return;
      }
    } catch (error) {
      lastError = error as Error;
      // 继续尝试下一个路径
      continue;
    }
  }

  // 只在所有路径都失败时显示一次警告
  if (!ZDICT_LOADED) {
    console.log('⚠️  无法加载 zdict 数据，将使用 cnchar 和缓存数据');
    console.log('💡 提示: 运行 npm run download-zdict 可以自动下载 zdict 数据');
  }
};

// 从 zdict.js 获取汉字释义 (聚合所有多音字释义)
const getMeaningFromZdict = (char: string): { meaning: string; examples: string[] } | null => {
  if (!ZDICT_LOADED || !ZDICT_DATA[char]) {
    return null;
  }

  const entry = ZDICT_DATA[char];
  const pinyins = Object.keys(entry);

  if (pinyins.length === 0) return { meaning: "暂无释义", examples: [] };

  // 如果只有一个拼音，直接返回其释义
  if (pinyins.length === 1) {
    const pinyin = pinyins[0];
    const defs = entry[pinyin];
    const meaning = defs && defs.length > 0 ? defs.join('；') : "暂无释义";
    return { meaning, examples: [] };
  }

  // 如果有多个拼音，格式化展示
  const meaning = pinyins.map(pinyin => {
    const defs = entry[pinyin];
    return `[${pinyin}] ${defs.join('；')}`;
  }).join('\n\n');

  return { meaning, examples: [] };
};

// 获取汉字释义和组词（优先使用 zdict.js，其次缓存）
const getCharacterMeaning = async (char: string): Promise<{ meaning: string; examples: string[] }> => {
  // 1. 尝试从 zdict.js 获取
  if (ZDICT_LOADED) {
    const zdictResult = getMeaningFromZdict(char);
    if (zdictResult) {
      // 保存到缓存
      MEANING_CACHE[char] = zdictResult;
      saveCachedMeanings(MEANING_CACHE);
      return zdictResult;
    }
  }

  // 2. 尝试从缓存获取
  if (MEANING_CACHE[char]) {
    return MEANING_CACHE[char];
  }

  // 3. 返回默认值
  return { meaning: "暂无释义", examples: [] };
};

// 移除拼音声调的辅助函数
const removeTone = (pinyin: string): string => {
  return pinyin
    .toLowerCase()
    .replace(/[āáǎà]/g, 'a')
    .replace(/[ēéěè]/g, 'e')
    .replace(/[īíǐì]/g, 'i')
    .replace(/[ōóǒò]/g, 'o')
    .replace(/[ūúǔù]/g, 'u')
    .replace(/[ǖǘǚǜ]/g, 'ü')
    .replace(/[1-5]/g, '');
};

// 从 zdict 数据中搜索拼音（近似搜索）
const searchFromZdict = (pinyinPrefix: string): SearchResult[] => {
  if (!ZDICT_LOADED) {
    console.log('zdict 数据未加载');
    return [];
  }

  const results: SearchResult[] = [];
  const normalizedPrefix = pinyinPrefix.toLowerCase();
  let checkedCount = 0;

  // 遍历所有汉字，查找拼音匹配的
  for (const [char, pinyinMap] of Object.entries(ZDICT_DATA)) {
    checkedCount++;

    // 确保 char 是有效的单个汉字字符
    if (!char || char.length !== 1 || !/[\u4e00-\u9fa5]/.test(char)) {
      continue;
    }

    // pinyinMap 是 { "shèng": ["..."], "chéng": ["..."] }
    // 遍历该字的所有拼音
    for (const [pinyin, definitions] of Object.entries(pinyinMap)) {
      // 移除声调后进行比较
      const entryPinyinNoTone = removeTone(pinyin);

      // 检查拼音是否以输入的前缀开头（精确或前缀匹配）
      if (entryPinyinNoTone.startsWith(normalizedPrefix)) {
        // 构建释义简述
        const firstDef = definitions && definitions.length > 0 ? definitions[0] : "常用汉字";
        const brief = firstDef.split('，')[0]?.split('：')[0] || firstDef;

        results.push({
          char,
          pinyin: pinyin, // 返回具体的带声调拼音
          brief
        });

        // 注意：这里不 break，因为一个字可能有多个拼音都匹配（虽然少见，但逻辑上允许）
      }
    }

    if (results.length >= 500) break;
  }

  console.log(`zdict 搜索完成: 检查了 ${checkedCount} 个字符，找到 ${results.length} 个结果`);
  return results;
};

// 根据拼音或汉字搜索汉字（使用 cnchar + zdict 近似搜索）
export const searchCharactersByPinyin = async (keyword: string): Promise<SearchResult[]> => {
  if (!keyword || keyword.trim().length === 0) {
    return [];
  }

  const results: SearchResult[] = [];
  const foundKeys = new Set<string>(); // 用于去重 (char + pinyin)
  const foundChars = new Set<string>(); // 用于标记已找到的汉字 (防止 cnchar 重复添加)

  // 辅助函数：添加结果
  const addResult = (result: SearchResult) => {
    // 构造唯一键：字符+拼音
    // 注意：ZDICT返回的拼音带声调，cnchar拼接的也带。
    const key = `${result.char}_${result.pinyin}`;

    if (foundKeys.has(key)) return;

    foundKeys.add(key);
    foundChars.add(result.char);
    results.push(result);
  };

  // 检查是否包含汉字
  const hasHanzi = /[\u4e00-\u9fa5]/.test(keyword);
  if (hasHanzi) {
    // 提取搜索词中的所有汉字
    const chars = keyword.match(/[\u4e00-\u9fa5]/g) || [];
    for (const char of chars) {
      if (foundChars.has(char)) continue; // 这里还是按字去重，因为直接查汉字不需要多音字分开展示

      const pinyinResult = cnchar.spell(char, 'poly', 'tone', 'low');
      const pinyinStr = Array.isArray(pinyinResult) ? pinyinResult.join('/') : (pinyinResult || "");

      const cached = MEANING_CACHE[char];
      const zdictResult = ZDICT_LOADED ? getMeaningFromZdict(char) : null;
      const meaning = zdictResult?.meaning || cached?.meaning || "常用汉字";
      const brief = meaning.split('，')[0]?.split(',')[0] || meaning || "常用汉字";
      // 截取 brief 如果太长 (针对聚合的解释)
      const displayBrief = brief.includes('\n') ? brief.split('\n')[0] + '...' : brief;

      addResult({
        char,
        pinyin: pinyinStr,
        brief: displayBrief
      });
    }

    // 如果直接输入的是汉字，优先返回匹配的汉字
    if (results.length > 0) return results;
  }

  // 移除音调，转换为小写用于拼音搜索
  const normalizedPinyin = keyword.toLowerCase().replace(/[1-5]/g, '');

  // 方法1: 使用 zdict 近似搜索（数据最完整，包含多音字）
  if (ZDICT_LOADED) {
    console.log(`使用 zdict 搜索: "${normalizedPinyin}"`);
    const zdictResults = searchFromZdict(normalizedPinyin);

    for (const result of zdictResults) {
      if (results.length >= 1000) break;
      addResult(result);
    }
  }

  // 方法2: 尝试使用 cnchar 搜索补充（如果有 zdict 没覆盖到的字）
  if (results.length < 1000) {
    try {
      const spellResult = cnchar.spellToWord(normalizedPinyin);
      const characters: string[] = Array.isArray(spellResult)
        ? spellResult
        : (typeof spellResult === 'string' ? [spellResult] : []);

      for (const char of characters) {
        if (foundChars.has(char)) continue; // 如果 zdict 已经有了该字（任意读音），cnchar 就不加了
        if (results.length >= 1000) break;

        const pinyinResult = cnchar.spell(char, 'poly', 'tone', 'low');
        const pinyinStr = Array.isArray(pinyinResult) ? pinyinResult.join('/') : (pinyinResult || "");

        const cached = MEANING_CACHE[char];
        const zdictResult = ZDICT_LOADED ? getMeaningFromZdict(char) : null;
        const meaning = zdictResult?.meaning || cached?.meaning || "常用汉字";
        const brief = meaning.split('，')[0]?.split(',')[0] || meaning || "常用汉字";
        const displayBrief = brief.includes('\n') ? brief.split('\n')[0] + '...' : brief;

        addResult({
          char,
          pinyin: pinyinStr,
          brief: displayBrief
        });
      }
    } catch (error) {
      console.log('cnchar 搜索失败:', error);
    }
  }

  // 方法3: 如果还是不足，尝试更短的前缀搜索（模糊匹配）
  if (results.length < 10 && normalizedPinyin.length > 1) {
    const shorterPrefix = normalizedPinyin.slice(0, -1);

    // 模糊匹配也优先使用 zdict
    if (ZDICT_LOADED) {
      const zdictResults = searchFromZdict(shorterPrefix);
      for (const result of zdictResults) {
        if (results.length >= 1000) break;
        // 注意：这里我们允许添加新的多音字结果，但要避免完全重复 (由 addResult 处理)
        // 另外，如果有更高优先级的精确搜索已经找到了该字的至少一个读音，
        // 我们是否还要显示模糊匹配的其他读音？
        // 逻辑上：如果搜 "she", 出了 "shèng". 模糊搜 "sh", 也会出 "shèng" (去重跳过).
        // 也会出 "chéng"? "ch" 不匹配 "sh". 
        // 所以模糊搜索只会补充 匹配 shorterPrefix 的结果.

        // 唯一的问题：如果 Method 1 找到了 char A (pinyin 1).
        // Method 3 找到了 char A (pinyin 2). 
        // 它们是不同的 search result. 显示出来没问题。

        addResult(result);
      }
    }

    // 补充 cnchar 模糊匹配
    if (results.length < 1000) {
      try {
        const partialResult = cnchar.spellToWord(shorterPrefix);
        const partialChars: string[] = Array.isArray(partialResult)
          ? partialResult
          : (typeof partialResult === 'string' ? [partialResult] : []);

        for (const char of partialChars) {
          if (!char || char.length !== 1 || !/[\u4e00-\u9fa5]/.test(char)) continue;
          if (foundChars.has(char)) continue; // 同样防止重复
          if (results.length >= 1000) break;

          const pinyinResult = cnchar.spell(char, 'poly', 'tone', 'low');
          const pinyinStr = Array.isArray(pinyinResult) ? pinyinResult.join('/') : (pinyinResult || shorterPrefix);
          const cached = MEANING_CACHE[char];
          const zdictResult = ZDICT_LOADED ? getMeaningFromZdict(char) : null;
          const meaning = zdictResult?.meaning || cached?.meaning || "常用汉字";
          const brief = meaning.split('，')[0]?.split(',')[0] || meaning || "常用汉字";
          const displayBrief = brief.includes('\n') ? brief.split('\n')[0] + '...' : brief;

          addResult({
            char,
            pinyin: pinyinStr,
            brief: displayBrief
          });
        }
      } catch (e) { }
    }
  }

  // 过滤掉无效的结果（确保 char 是有效的汉字）
  const validResults = results.filter(result =>
    result.char &&
    result.char.length === 1 &&
    /[\u4e00-\u9fa5]/.test(result.char)
  );

  // 按匹配程度 + 频率排序
  const sortedResults = [...validResults].sort((a, b) => {
    // 获取无声调拼音
    const getNormPinyin = (p: string | string[]) => {
      const pStr = Array.isArray(p) ? p[0] : p;
      return removeTone(pStr || "");
    };

    const aNorm = getNormPinyin(a.pinyin);
    const bNorm = getNormPinyin(b.pinyin);

    // 1. 优先完全匹配 (如果 normalizedPinyin 和搜索词一样)
    // 虽然字母排序通常能处理，但显式处理更安全
    // 比如搜索 "an"，"an" < "ang"。

    // 字母顺序排序 (实现了 wan 在 wang 前面，也实现了 grouping)
    if (aNorm !== bNorm) {
      // 那个跟搜索词长度越接近（越短）的通常越靠前（字母序 naturally handles prefixes: a < ab）
      return aNorm.localeCompare(bNorm);
    }

    // 2. 同拼音，按字频排序
    return getFrequencySort(a.char) - getFrequencySort(b.char);
  });

  return sortedResults;
};

// 获取汉字详情（使用 cnchar + zdict.js）
export const getCharacterDetails = async (char: string): Promise<HanziInfo | null> => {
  if (char.length !== 1) {
    return null;
  }

  try {
    // 使用 cnchar 获取基础信息
    const pinyinResult = cnchar.spell(char, 'poly', 'tone', 'low');
    const pinyin = Array.isArray(pinyinResult) ? (pinyinResult.length > 1 ? pinyinResult : pinyinResult[0]) : (pinyinResult || "");

    // cnchar.stroke 可能返回数字或数组，确保是数字
    const strokeResult = cnchar.stroke(char);
    const strokes = typeof strokeResult === 'number'
      ? strokeResult
      : (Array.isArray(strokeResult) ? strokeResult[0] : 0);

    // 使用 cnchar-radical 获取偏旁部首
    let radical = "";
    try {
      const radicalInfo = cnchar.radical(char);
      if (radicalInfo) {
        if (Array.isArray(radicalInfo) && radicalInfo.length > 0) {
          // IRadicalResult 类型，尝试访问可能的属性
          const first = radicalInfo[0] as any;
          radical = first?.radical || first?.name || first?.char || "";
        } else if (typeof radicalInfo === 'object') {
          const info = radicalInfo as any;
          radical = info.radical || info.name || info.char || "";
        } else if (typeof radicalInfo === 'string') {
          radical = radicalInfo;
        }
      }
    } catch (e) {
      // 如果 radical 插件未正确加载，忽略错误
    }

    // 获取释义和组词（优先使用 zdict.js）
    const { meaning, examples } = await getCharacterMeaning(char);

    return {
      character: char,
      pinyin,
      meaning,
      radical,
      strokes,
      examples: (examples.length > 0 ? examples : getCncharExamples(char)).slice(0, 10) // 优先使用 zdict，降级使用 cnchar
    };
  } catch (error) {
    console.error('获取汉字详情失败:', error);
    // 返回一个默认结构
    return {
      character: char,
      pinyin: "",
      meaning: "暂无释义",
      radical: "",
      strokes: 0,
      examples: []
    };
  }
};

// 使用 cnchar-voice 进行语音合成
export const speakText = async (text: string, ctx: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // 使用 cnchar 的语音功能
      if (cnchar.voice && cnchar.voice.speak) {
        cnchar.voice.speak(text);
        // 估算语音时长
        const duration = text.length * 300; // 每个字符约300ms
        setTimeout(() => resolve(), duration);
      } else {
        // 如果 cnchar-voice 未正确加载，回退到浏览器 TTS
        if (!('speechSynthesis' in window)) {
          reject(new Error('浏览器不支持语音合成'));
          return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const chineseVoice = voices.find(voice =>
          voice.lang.includes('zh') || voice.lang.includes('CN') || voice.name.includes('Chinese')
        );
        if (chineseVoice) {
          utterance.voice = chineseVoice;
        }

        utterance.onend = () => resolve();
        utterance.onerror = (error) => reject(error);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      reject(error);
    }
  });
};

// 获取音频上下文（保持兼容性）
export const getAudioContext = () => {
  return null as any;
};

// 批量扩充释义缓存（从 zdict.js 获取多个汉字的释义和组词）
export const expandMeaningCache = async (characters: string[]): Promise<number> => {
  let successCount = 0;

  // 确保 zdict 数据已加载
  if (!ZDICT_LOADED) {
    await loadZdictData();
  }

  for (const char of characters) {
    if (!MEANING_CACHE[char]) {
      const result = await getCharacterMeaning(char);
      if (result && result.meaning !== "暂无释义") {
        MEANING_CACHE[char] = result;
        successCount++;
      }
    }
  }

  // 保存缓存
  if (successCount > 0) {
    saveCachedMeanings(MEANING_CACHE);
  }

  return successCount;
};

// 初始化：加载 zdict.js 数据并在后台扩充常用汉字的释义缓存
export const initializeDatabaseExpansion = async (): Promise<void> => {
  try {
    // 立即加载 zdict 数据
    await loadZdictData();

    // 在后台异步扩充常用汉字的释义缓存
    setTimeout(async () => {
      try {
        // 检查缓存大小
        const currentSize = Object.keys(MEANING_CACHE).length;

        // 如果缓存太小（少于100个字符），尝试扩充
        if (currentSize < 100) {
          // 常用汉字列表
          const commonChars = [
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
            "学", "习", "汉", "字", "中", "国", "人", "大", "小", "好",
            "爱", "家", "马", "你", "我", "他", "是", "的", "了", "在",
            "有", "这", "个", "来", "去", "说", "看", "听", "做", "想",
            "天", "地", "水", "火", "木", "金", "土", "日", "月", "年"
          ];

          // 过滤出未缓存的汉字
          const toExpand = commonChars.filter(char => !MEANING_CACHE[char]);

          if (toExpand.length > 0) {
            const count = await expandMeaningCache(toExpand);
            if (count > 0) {
              console.log(`✅ 成功扩充 ${count} 个常用汉字的释义`);
            }
          }
        }
      } catch (e) {
        console.log('扩充缓存失败:', e);
      }
    }, 1000);
  } catch (error) {
    console.log('初始化加载失败:', error);
  }
};

// 获取 cnchar 的组词/成语作为后备
const getCncharExamples = (char: string): string[] => {
  try {
    const words = (cnchar as any).words(char);
    const idioms = (cnchar as any).idiom(char);

    let result: string[] = [];
    if (Array.isArray(words)) result = result.concat(words);
    if (Array.isArray(idioms)) result = result.concat(idioms);

    return Array.from(new Set(result));
  } catch (e) {
    return [];
  }
};

// 获取随机拼音（常用）
const COMMON_PINYINS = [
  'a', 'ai', 'an', 'ang', 'ao', 'ba', 'bai', 'ban', 'bang', 'bao', 'bei', 'ben', 'beng', 'bi', 'bian', 'biao', 'bie', 'bin', 'bing', 'bo', 'bu',
  'ca', 'cai', 'can', 'cang', 'cao', 'ce', 'cen', 'ceng', 'cha', 'chai', 'chan', 'chang', 'chao', 'che', 'chen', 'cheng', 'chi', 'chong', 'chou', 'chu', 'chua', 'chuai', 'chuan', 'chuang', 'chui', 'chun', 'chuo', 'ci', 'cong', 'cou', 'cu', 'cuan', 'cui', 'cun', 'cuo',
  'da', 'dai', 'dan', 'dang', 'dao', 'de', 'dei', 'deng', 'di', 'dian', 'diao', 'die', 'ding', 'diu', 'dong', 'dou', 'du', 'duan', 'dui', 'dun', 'duo',
  'e', 'ei', 'en', 'eng', 'er',
  'fa', 'fan', 'fang', 'fei', 'fen', 'feng', 'fo', 'fou', 'fu',
  'ga', 'gai', 'gan', 'gang', 'gao', 'ge', 'gei', 'gen', 'geng', 'gong', 'gou', 'gu', 'gua', 'guai', 'guan', 'guang', 'gui', 'gun', 'guo',
  'ha', 'hai', 'han', 'hang', 'hao', 'he', 'hei', 'hen', 'heng', 'hong', 'hou', 'hu', 'hua', 'huai', 'huan', 'huang', 'hui', 'hun', 'huo',
  'ji', 'jia', 'jian', 'jiang', 'jiao', 'jie', 'jin', 'jing', 'jiong', 'jiu', 'ju', 'juan', 'jue', 'jun',
  'ka', 'kai', 'kan', 'kang', 'kao', 'ke', 'ken', 'keng', 'kong', 'kou', 'ku', 'kua', 'kuai', 'kuan', 'kuang', 'kui', 'kun', 'kuo',
  'la', 'lai', 'lan', 'lang', 'lao', 'le', 'lei', 'leng', 'li', 'lia', 'lian', 'liang', 'liao', 'lie', 'lin', 'ling', 'liu', 'long', 'lou', 'lu', 'lv', 'luan', 'lue', 'lun', 'luo',
  'ma', 'mai', 'man', 'mang', 'mao', 'me', 'mei', 'men', 'meng', 'mi', 'mian', 'miao', 'mie', 'min', 'ming', 'miu', 'mo', 'mou', 'mu',
  'na', 'nai', 'nan', 'nang', 'nao', 'ne', 'nei', 'nen', 'neng', 'ni', 'nian', 'niang', 'niao', 'nie', 'nin', 'ning', 'niu', 'nong', 'nou', 'nu', 'nv', 'nuan', 'nue', 'nuo',
  'o', 'ou',
  'pa', 'pai', 'pan', 'pang', 'pao', 'pei', 'pen', 'peng', 'pi', 'pian', 'piao', 'pie', 'pin', 'ping', 'po', 'pou', 'pu',
  'qi', 'qia', 'qian', 'qiang', 'qiao', 'qie', 'qin', 'qing', 'qiong', 'qiu', 'qu', 'quan', 'que', 'qun',
  'ran', 'rang', 'rao', 're', 'ren', 'reng', 'ri', 'rong', 'rou', 'ru', 'ruan', 'rui', 'run', 'ruo',
  'sa', 'sai', 'san', 'sang', 'sao', 'se', 'sen', 'seng', 'sha', 'shai', 'shan', 'shang', 'shao', 'she', 'shei', 'shen', 'sheng', 'shi', 'shou', 'shu', 'shua', 'shuai', 'shuan', 'shuang', 'shui', 'shun', 'shuo', 'si', 'song', 'sou', 'su', 'suan', 'sui', 'sun', 'suo',
  'ta', 'tai', 'tan', 'tang', 'tao', 'te', 'teng', 'ti', 'tian', 'tiao', 'tie', 'ting', 'tong', 'tou', 'tu', 'tuan', 'tui', 'tun', 'tuo',
  'wa', 'wai', 'wan', 'wang', 'wei', 'wen', 'weng', 'wo', 'wu',
  'xi', 'xia', 'xian', 'xiang', 'xiao', 'xie', 'xin', 'xing', 'xiong', 'xiu', 'xu', 'xuan', 'xue', 'xun',
  'ya', 'yan', 'yang', 'yao', 'ye', 'yi', 'yin', 'ying', 'yo', 'yong', 'you', 'yu', 'yuan', 'yue', 'yun',
  'za', 'zai', 'zan', 'zang', 'zao', 'ze', 'zei', 'zen', 'zeng', 'zha', 'zhai', 'zhan', 'zhang', 'zhao', 'zhe', 'zhei', 'zhen', 'zheng', 'zhi', 'zhong', 'zhou', 'zhu', 'zhua', 'zhuai', 'zhuan', 'zhuang', 'zhui', 'zhun', 'zhuo', 'zi', 'zong', 'zou', 'zu', 'zuan', 'zui', 'zun', 'zuo'
];

export const getRandomPinyin = (): string => {
  const index = Math.floor(Math.random() * COMMON_PINYINS.length);
  return COMMON_PINYINS[index];
};

// 获取初始化的随机汉字列表（确保有12个）
export const getRandomInitialResults = async (): Promise<SearchResult[]> => {
  // 1. 尝试使用随机拼音搜索
  const pinyin = getRandomPinyin();
  let results = await searchCharactersByPinyin(pinyin);

  // 2. 如果结果不足12架，填充常用汉字
  if (results.length < 12) {
    const commonChars = [
      "学", "习", "汉", "字", "春", "夏", "秋", "冬", "山", "水", "云", "雨",
      "天", "地", "东", "西", "南", "北", "金", "木", "水", "火", "土", "日",
      "月", "星", "花", "鸟", "鱼", "虫", "风", "雷", "电", "雨", "雪", "霜"
    ];

    // 随机打乱并挑选
    const shuffled = [...commonChars].sort(() => 0.5 - Math.random());
    const seenChars = new Set(results.map(r => r.char));

    for (const char of shuffled) {
      if (results.length >= 12) break;
      if (seenChars.has(char)) continue;

      const py = cnchar.spell(char, 'poly', 'tone', 'low');
      results.push({
        char,
        pinyin: Array.isArray(py) ? py.join('/') : (py || ""),
        brief: "常用汉字"
      });
      seenChars.add(char);
    }
  }

  return results;
};

if (typeof window !== 'undefined') {
  // 延迟初始化，避免影响页面加载速度
  if (document.readyState === 'complete') {
    initializeDatabaseExpansion();
  } else {
    window.addEventListener('load', () => {
      initializeDatabaseExpansion();
    });
  }
}
