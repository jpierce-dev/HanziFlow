
import React from 'react';
import { SearchResult } from '../types';

interface CharacterCardProps {
  result: SearchResult;
  onSelect: (char: string) => void;
  isActive: boolean;
}

const CharacterCard: React.FC<CharacterCardProps> = ({ result, onSelect, isActive }) => {
  return (
    <button
      onClick={() => onSelect(result.char)}
      className={`relative p-4 bg-white rounded-xl shadow-md border-2 transition-all hover:shadow-lg active:scale-95 flex flex-col items-center justify-center space-y-1 ${
        isActive ? 'border-red-500 bg-red-50' : 'border-transparent hover:border-red-200'
      }`}
    >
      <span className="text-4xl font-bold text-gray-800">{result.char}</span>
      <span className="text-xs text-red-600 font-medium">{result.pinyin}</span>
      <span className="text-[10px] text-gray-400 line-clamp-1 text-center w-full">{result.brief}</span>
    </button>
  );
};

export default CharacterCard;
