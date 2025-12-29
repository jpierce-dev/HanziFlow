
import React, { useState } from 'react';

interface SearchBarProps {
  onSearch: (pinyin: string) => void;
  isLoading: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');

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
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-3 top-2.5 bottom-2.5 w-12 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:bg-gray-300 transition-colors flex items-center justify-center"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          )}
        </button>
      </form>
      <div className="mt-3 flex gap-2 text-sm text-gray-400 px-4">
        <span>热门搜索:</span>
        {['hua', 'long', 'chun', 'fu'].map(p => (
          <button
            key={p}
            onClick={() => { setQuery(p); onSearch(p); }}
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
