
import React, { useState, useEffect, useRef } from 'react';

interface SearchBarProps {
  onSearch: (pinyin: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

  const lastSearchQuery = useRef('');

  useEffect(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery || trimmedQuery === lastSearchQuery.current) return;

    const timer = setTimeout(() => {
      onSearch(trimmedQuery);
      lastSearchQuery.current = trimmedQuery;
    }, 150);

    return () => clearTimeout(timer);
  }, [query, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim().toLowerCase());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-10">
      <form onSubmit={handleSubmit} className="relative group">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入拼音 (例如: ma, shu, han...)"
          className="w-full px-8 py-5 bg-white border-2 border-red-100 rounded-2xl shadow-xl text-xl focus:outline-none focus:border-red-400 transition-all placeholder:text-gray-300"
        />
        <div
          className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-3 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 opacity-20"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          )}
        </div>
      </form>
      <div className="mt-3 flex gap-2 text-sm text-gray-400 px-4">
        <span>热门搜索:</span>
        {['hua', 'long', 'chun', 'fu'].map(p => (
          <button
            key={p}
            onClick={() => { setQuery(p); }}
            className="hover:text-red-600 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchBar;
