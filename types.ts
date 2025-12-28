
export interface HanziInfo {
  character: string;
  pinyin: string;
  meaning: string;
  radical: string;
  strokes: number;
  examples: string[];
}

export interface SearchResult {
  char: string;
  pinyin: string;
  brief: string;
}

export interface GeminiSearchResponse {
  results: SearchResult[];
}

// Global declaration for HanziWriter
declare global {
  interface Window {
    HanziWriter: any;
  }
}
