
import React from 'react';
import { Star } from 'lucide-react';

// Komponen ini bertanggung jawab untuk menampilkan satu kartu hasil pencarian atau riwayat.
const SortCard = ({ item, isPinned, onPin, onSelect, darkMode }) => {
  return (
    <div 
      onClick={onSelect} // Memanggil fungsi onSelect saat kartu diklik
      className={`p-4 mb-3 rounded-2xl border flex items-center gap-4 transition-all active:scale-95 cursor-pointer
      ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
    >
      <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white font-black shrink-0
        ${isPinned ? 'bg-orange-500' : 'bg-blue-600'}`}>
        <span className="text-[7px] opacity-70">SORT</span>
        <span className="text-xl">{item.sortCode}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm uppercase truncate">{item.name}</h3>
        <p className="text-[10px] opacity-50 font-mono tracking-tighter uppercase">{item.code}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation(); // Mencegah event klik pada kartu
          onPin(); // Memanggil fungsi onPin saat tombol bintang diklik
        }}
        className={`p-2 rounded-lg ${isPinned ? 'text-orange-500 bg-orange-100 dark:bg-orange-500/10' : 'text-slate-300'}`}
      >
        <Star size={20} fill={isPinned ? "currentColor" : "none"} />
      </button>
    </div>
  );
};

export default SortCard;
