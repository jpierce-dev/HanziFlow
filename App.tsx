
import React, { useState, useEffect, useCallback, useRef } from 'react';
import SearchBar from './components/SearchBar';
import TianZiGe from './components/TianZiGe';
import { searchCharactersByPinyin, getCharacterDetails, speakText, getAudioContext, getRandomInitialResults } from './services/hanzi-data';
import { HanziInfo, SearchResult } from './types';

const App: React.FC = () => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedChar, setSelectedChar] = useState<string>('汉');
  const [detail, setDetail] = useState<HanziInfo | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [playingText, setPlayingText] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // 使用 Ref 来保持 handleSelectChar 的稳定引用，避免在 handleSearch 中产生依赖
  const selectCharRef = useRef<((char: string) => Promise<void>) | null>(null);

  const handleSelectChar = useCallback(async (char: string) => {
    setSelectedChar(prev => {
      // 只有在字符真的改变，或者还没有详情时才加载
      if (prev === char && detailRef.current) return prev;

      setLoadingDetail(true);
      getCharacterDetails(char).then(data => {
        setDetail(data);
        detailRef.current = data; // 同步更新 ref
        setLoadingDetail(false);
      }).catch(e => {
        console.error("Detail failed", e);
        setLoadingDetail(false);
      });

      return char;
    });
  }, []); // 真正的稳定引用

  // 保存到 ref 供 handleSearch 使用
  useEffect(() => {
    selectCharRef.current = handleSelectChar;
  }, [handleSelectChar]);

  const detailRef = useRef<HanziInfo | null>(null);

  const handleSearch = useCallback(async (pinyin: string) => {
    setLoading(true);
    try {
      const data = await searchCharactersByPinyin(pinyin);
      setResults(data);
      if (data.length > 0 && selectCharRef.current) {
        selectCharRef.current(data[0].char);
      }
    } catch (e) {
      console.error("Search failed", e);
    }
    setLoading(false);
  }, []);

  const handleSpeak = useCallback(async (text: string) => {
    if (playingText) return;

    setPlayingText(text);
    try {
      await speakText(text, null as any);
      const duration = text.length * 200;
      setTimeout(() => setPlayingText(null), duration);
    } catch (e) {
      console.error("Speak process failed:", e);
      setPlayingText(null);
    }
  }, [playingText]);

  useEffect(() => {
    // 初始化随机汉字（确保有12个）
    const init = async () => {
      setLoading(true);
      const data = await getRandomInitialResults();
      setResults(data);
      if (data.length > 0) handleSelectChar(data[0].char);
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  return (
    <div className="h-screen flex flex-col bg-[#fcfaf2] safe-area-inset overflow-hidden">
      <header className="py-4 px-6 md:px-10 flex items-center justify-between border-b border-red-100 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 rounded-lg flex items-center justify-center shadow-lg transform rotate-3">
            <span className="text-white text-xl md:text-2xl font-bold">习</span>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 brush-font">汉字流</h1>
            <p className="hidden xs:block text-[10px] text-gray-400 tracking-widest uppercase font-semibold">HanziFlow Pro</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(loading || loadingDetail) ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-full border border-amber-100">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div>
              <span className="text-xs font-bold text-amber-700">同步中...</span>
            </div>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-600 rounded-full border border-gray-100 transition-all flex items-center gap-1.5 active:scale-95"
              title="点击刷新页面"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-hover-spin"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" /></svg>
              <span className="text-xs font-bold">刷新</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* 侧边搜索栏 */}
        <aside className="w-full md:w-[260px] lg:w-[280px] border-r border-red-50 bg-[#faf8f0] flex flex-col overflow-hidden">
          <div className="p-4 md:p-6 flex-1 flex flex-col min-h-0">
            <SearchBar onSearch={handleSearch} isLoading={loading} />
            <div className="grid grid-cols-4 md:grid-cols-3 gap-3 overflow-y-auto pr-1 pb-4 custom-scrollbar">
              {results.length > 0 ? (
                results.map((res, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectChar(res.char)}
                    className={`aspect-square bg-white rounded-xl shadow-sm border-2 flex flex-col items-center justify-center transition-all ${selectedChar === res.char ? 'border-red-500 bg-red-50 shadow-md' : 'border-transparent'
                      }`}
                  >
                    <span className="text-2xl md:text-3xl font-bold text-gray-800">{res.char}</span>
                    <span className="text-[10px] text-red-500/60 uppercase">
                      {Array.isArray(res.pinyin) ? res.pinyin.join('/') : res.pinyin}
                    </span>
                  </button>
                ))
              ) : loading ? (
                Array(12).fill(0).map((_, idx) => (
                  <div key={idx} className="aspect-square bg-white rounded-xl border-2 border-transparent animate-pulse flex flex-col items-center justify-center">
                    <div className="w-8 h-8 bg-gray-100 rounded mb-1"></div>
                    <div className="w-10 h-2 bg-gray-50 rounded"></div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-10 text-center text-gray-400 text-xs">
                  未找到匹配汉字
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 内容展示区 */}
        <section className="flex-1 overflow-y-auto p-4 md:p-10 bg-white/30 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6 lg:gap-12 items-start">
            <div className="w-full lg:w-auto flex flex-col items-center lg:sticky lg:top-8">
              <TianZiGe
                character={selectedChar}
                size={
                  windowWidth < 640 ? 260 : (windowWidth < 1280 ? 300 : 380)
                }
              />
            </div>

            <div className="flex-1 w-full space-y-8 pb-10">
              {detail ? (
                <div className="animate-fade-in">
                  <div className="flex items-end justify-between border-b-4 border-red-600 pb-8 mb-10">
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <h2 className="text-6xl sm:text-7xl lg:text-8xl font-black text-gray-900 leading-none cursor-pointer hover:text-red-700 transition-colors" onClick={() => handleSpeak(detail.character)}>
                          {detail.character}
                        </h2>
                        <button
                          className={`px-4 py-2 rounded-full text-lg font-bold ${playingText === detail.character ? 'bg-green-500 scale-105' : 'bg-red-600'} text-white shadow-lg active:scale-95 transition-all`}
                          onClick={() => handleSpeak(detail.character)}
                        >
                          {Array.isArray(detail.pinyin) ? detail.pinyin.join(' / ') : detail.pinyin} {playingText === detail.character ? '🔊' : '🔈'}
                        </button>
                      </div>
                      <p className="text-xl text-gray-400 font-medium tracking-widest">汉字详情</p>
                    </div>
                  </div>

                  <div className="mb-12">
                    <h3 className="text-sm font-bold text-red-800/40 uppercase mb-4 tracking-widest">释义</h3>
                    <p className="text-2xl md:text-3xl text-gray-800 leading-relaxed font-serif whitespace-pre-wrap">{detail.meaning}</p>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-red-800/40 uppercase mb-6 tracking-widest">组词</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {detail.examples.map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => handleSpeak(ex)}
                          className={`group p-6 bg-white rounded-3xl shadow-sm border-2 flex items-center justify-between transition-all ${playingText === ex ? 'border-red-500 bg-red-50 ring-2 ring-red-200' : 'border-transparent hover:border-red-100 hover:shadow-md'
                            }`}
                        >
                          <span className="text-2xl md:text-3xl font-bold text-gray-800">{ex}</span>
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${playingText === ex ? 'bg-red-500 text-white animate-pulse' : 'bg-red-50 text-red-400'}`}>
                            {playingText === ex ? '🔊' : '▶'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-gray-300">
                  <span className="animate-pulse">AI 正在解析汉字...</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
