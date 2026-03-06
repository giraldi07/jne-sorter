
import React from 'react';
import { 
  Search, Mic, Sun, Moon, Volume2, X, Camera, Zap 
} from 'lucide-react';

// Komponen Header sekarang mengelola UI dan interaksi terkait pencarian dan navigasi atas.
const Header = ({ 
    searchTerm, 
    setSearchTerm, 
    handleManualSearch,
    startVoiceSearch,
    isListening,
    isScanning,
    setIsScanning, 
    darkMode, 
    setDarkMode 
}) => {
  return (
    <header className={`sticky top-0 z-50 p-4 border-b backdrop-blur-xl ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Zap size={18} fill="currentColor" />
            </div>
            <h1 className="font-black text-lg tracking-tighter">SONIC<span className="text-blue-600">SORT</span></h1>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            {darkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}
          </button>
        </div>

        <div className={`flex items-center rounded-2xl border transition-all duration-300 focus-within:ring-2 ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <button onClick={() => setIsScanning(true)} className="p-3.5 text-blue-500 hover:scale-110 transition-transform"><Camera size={22}/></button>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Kota / Nomor Resi..."
            className="w-full bg-transparent border-none outline-none font-bold text-sm"
          />
          {searchTerm && <button onClick={() => setSearchTerm('')} className="p-2 opacity-40 hover:opacity-100"><X size={16}/></button>}
          <button onClick={handleManualSearch} className="p-3 text-blue-600 border-l border-slate-200 dark:border-slate-800"><Search size={22} /></button>
          <button onClick={startVoiceSearch} className={`p-3 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
            {isListening ? <Volume2 size={22}/> : <Mic size={22}/>}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
