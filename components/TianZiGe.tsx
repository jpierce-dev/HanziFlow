
import React, { useEffect, useRef, useState } from 'react';

interface TianZiGeProps {
  character: string;
  size?: number;
}

const TianZiGe: React.FC<TianZiGeProps> = ({ character, size = 400 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !character) return;

    // 1. 切换汉字时立即重置状态并停止任何正在进行的动画
    setIsPlaying(false);
    
    const cleanupWriter = () => {
      if (writerRef.current) {
        try {
          // 增加极其严格的检查防止 TypeError
          if (typeof writerRef.current.cancelAnimation === 'function') {
            writerRef.current.cancelAnimation();
          }
        } catch (e) {
          console.warn("HanziWriter cleanup suppressed:", e);
        }
        writerRef.current = null;
      }
    };

    cleanupWriter();

    // 2. 清空旧容器内容
    containerRef.current.innerHTML = '';

    // 3. 初始化新实例
    try {
      writerRef.current = window.HanziWriter.create(containerRef.current, character, {
        width: size,
        height: size,
        padding: 25,
        strokeColor: '#b91c1c',     // 更有质感的朱砂红
        outlineColor: '#f3f4f6',
        showOutline: true,
        showCharacter: true,
        strokeAnimationSpeed: 0.8,   // 放慢速度，让用户看清起笔收笔
        delayBetweenStrokes: 400,    // 笔画间隔加长，更有节奏感
        onComplete: () => {
          setIsPlaying(false);
        }
      });

      // 绘制精美的田字格背景
      const svg = containerRef.current.querySelector('svg');
      if (svg) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('stroke', '#f87171');
        g.setAttribute('stroke-width', '1');
        g.setAttribute('stroke-dasharray', '4,4');
        g.setAttribute('opacity', '0.4');

        const lines = [
          { x1: 0, y1: size / 2, x2: size, y2: size / 2 },
          { x1: size / 2, y1: 0, x2: size / 2, y2: size },
          { x1: 0, y1: 0, x2: size, y2: size },
          { x1: size, y1: 0, x2: 0, y2: size }
        ];

        lines.forEach(l => {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', l.x1.toString());
          line.setAttribute('y1', l.y1.toString());
          line.setAttribute('x2', l.x2.toString());
          line.setAttribute('y2', l.y2.toString());
          g.appendChild(line);
        });

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0'); rect.setAttribute('y', '0');
        rect.setAttribute('width', size.toString()); rect.setAttribute('height', size.toString());
        rect.setAttribute('fill', 'none'); rect.setAttribute('stroke', '#f87171');
        rect.setAttribute('stroke-width', '2'); rect.setAttribute('opacity', '0.6');
        g.appendChild(rect);

        svg.insertBefore(g, svg.firstChild);
      }
    } catch (err) {
      console.error("HanziWriter initialization failed:", err);
    }

    return () => cleanupWriter();
  }, [character, size]);

  const handleAnimate = () => {
    if (writerRef.current && !isPlaying) {
      setIsPlaying(true);
      // 再次确认 animateCharacter 存在
      if (typeof writerRef.current.animateCharacter === 'function') {
        writerRef.current.animateCharacter({
          onComplete: () => setIsPlaying(false)
        });
      } else {
        setIsPlaying(false);
      }
    }
  };

  const handleQuiz = () => {
    if (writerRef.current) {
      setIsPlaying(false);
      if (typeof writerRef.current.cancelAnimation === 'function') {
        writerRef.current.cancelAnimation();
      }
      if (typeof writerRef.current.quiz === 'function') {
        writerRef.current.quiz();
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      <div 
        ref={containerRef} 
        className="bg-white rounded-xl shadow-[0_20px_50px_rgba(185,28,28,0.1)] border-4 border-red-50 p-2 cursor-pointer transition-all active:scale-[0.98] select-none"
        onClick={handleAnimate}
      />
      
      <div className="flex flex-wrap justify-center gap-5">
        <button 
          onClick={handleAnimate}
          disabled={isPlaying}
          className={`px-10 py-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-3 min-w-[180px] justify-center ${
            isPlaying 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
            : 'bg-red-600 text-white hover:bg-red-700 hover:shadow-red-200/50 active:bg-red-800'
          }`}
        >
          {isPlaying ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-lg">演示中...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span className="text-lg">演示笔顺</span>
            </>
          )}
        </button>
        
        <button 
          onClick={handleQuiz}
          className="px-10 py-4 bg-white text-amber-700 border-2 border-amber-500 rounded-2xl font-bold shadow-md hover:bg-amber-50 transition-all active:scale-95 flex items-center gap-3 min-w-[180px] justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          <span className="text-lg">书写练习</span>
        </button>
      </div>
      <p className="text-gray-400 text-sm text-center px-4 font-medium italic opacity-80">点击演示慢慢观察笔顺，或进入书写练习挑战</p>
    </div>
  );
};

export default TianZiGe;
