import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Package, MapPin, Mic, MicOff, 
  History, Star, Sun, Moon, Zap, ArrowRight, Trash2,
  Info, AlertCircle, Loader2, Volume2
} from 'lucide-react';

const App = () => {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('jne_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('jne_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  const searchInputRef = useRef(null);

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/jne_destination_code.csv');
        if (!response.ok) throw new Error('File database tidak ditemukan.');
        const text = await response.text();
        const parsedData = parseCSV(text);
        setData(parsedData);
      } catch (err) {
        setError("Gagal memuat database. Pastikan jne_destination_code.csv ada di folder public.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('jne_history', JSON.stringify(history));
    localStorage.setItem('jne_favorites', JSON.stringify(favorites));
  }, [history, favorites]);

  const parseCSV = (text) => {
    const lines = text.split('\n');
    const result = [];
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const columns = line.split(regex).map(col => col.replace(/^"|"$/g, '').trim());
      
      if (columns.length >= 3) {
        result.push({
          id: columns[0],
          code: columns[1],
          sortCode: columns[1]?.substring(0, 3).toUpperCase() || '???',
          name: columns[2],
        });
      }
    }
    return result;
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = data.filter(item => 
      item.name.toLowerCase().includes(lowerTerm) || 
      item.code.toLowerCase().includes(lowerTerm)
    ).slice(0, 20);
    setResults(filtered);
  }, [searchTerm, data]);

  // FIX: Voice Recognition Logic
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Browser Anda tidak mendukung fitur suara. Silakan gunakan Google Chrome.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchTerm(transcript.replace(/[.?!]/g, ''));
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech Error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Izin mikrofon ditolak. Silakan aktifkan mikrofon di pengaturan browser Anda.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  const ResultCard = ({ item, isHistory = false }) => {
    const isFav = favorites.some(f => f.id === item.id);
    const parts = item.name.split(',').map(p => p.trim());
    const mainLoc = parts[0];
    const subLoc = parts.slice(1).join(', ');

    return (
      <div 
        onClick={() => {
          if(!isHistory) {
            setSearchTerm(''); // Clear search on select if needed
            addToHistory(item);
          }
        }}
        className={`flex items-stretch rounded-2xl transition-all duration-200 shadow-sm hover:shadow-md border ${
          darkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
        } overflow-hidden cursor-pointer active:scale-95 mb-4`}
      >
        <div className="w-24 bg-blue-600 flex flex-col items-center justify-center p-2 shrink-0">
          <span className="text-[10px] font-bold text-blue-100 opacity-70">SORTIR</span>
          <h2 className="text-3xl font-black text-white">{item.sortCode}</h2>
        </div>
        <div className="flex-1 p-4 flex flex-col justify-center">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg leading-tight uppercase">{mainLoc}</h3>
              {subLoc && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                  <MapPin size={12} />
                  <p className="text-xs font-medium uppercase">{subLoc}</p>
                </div>
              )}
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item, e);
              }}
              className={`p-2 rounded-full ${isFav ? 'text-yellow-500 bg-yellow-400/10' : 'text-slate-300'}`}
            >
              <Star size={20} fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="text-[10px] mt-2 font-mono opacity-40 uppercase tracking-tighter">KODE JNE: {item.code}</p>
        </div>
      </div>
    );
  };

  const addToHistory = (item) => {
    setHistory(prev => [item, ...prev.filter(h => h.id !== item.id)].slice(0, 10));
  };

  const toggleFavorite = (item) => {
    const isFav = favorites.some(f => f.id === item.id);
    if (isFav) {
      setFavorites(favorites.filter(f => f.id !== item.id));
    } else {
      setFavorites([item, ...favorites]);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-slate-900' : 'bg-slate-50'} font-sans transition-colors duration-300`}>
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 text-white p-1.5 rounded-lg shadow-lg">
              <Package size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className={`font-black text-sm leading-none ${darkMode ? 'text-white' : 'text-slate-900'}`}>JNE SMART SORTER</h1>
              <span className={`text-[10px] font-bold opacity-50 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>v1.1 by Giraldi P.Y.</span>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>

        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className={`relative flex items-center rounded-2xl shadow-inner border-2 transition-all ${
            isListening ? 'border-red-500 ring-4 ring-red-500/20 bg-red-50/50' : darkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
          }`}>
            <Search className="ml-4 text-slate-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={isListening ? "Mendengarkan..." : loading ? "Memuat data..." : "Cari Kecamatan / Kota..."}
              className={`w-full py-4 px-3 bg-transparent outline-none font-bold text-lg ${isListening ? 'placeholder-red-400' : ''}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
            <button 
              onClick={toggleListening}
              className={`mr-2 p-3 rounded-xl transition-all ${isListening ? 'bg-red-600 text-white scale-110 shadow-lg' : 'text-blue-600 hover:bg-blue-100'}`}
              title="Cari dengan suara"
            >
              {isListening ? <Volume2 size={24} className="animate-pulse" /> : <Mic size={24} />}
            </button>
          </div>
          {isListening && (
            <p className="text-[10px] text-red-500 font-bold text-center mt-2 animate-pulse uppercase tracking-widest">Sebutkan nama daerah sekarang...</p>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-40">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p className="font-bold">MENGHUBUNGKAN DATABASE...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-6 rounded-3xl text-red-600 text-center border-2 border-red-100">
            <AlertCircle className="mx-auto mb-2" size={32} />
            <p className="font-bold">{error}</p>
          </div>
        ) : !searchTerm ? (
          <div className="space-y-8">
            {favorites.length > 0 && (
              <section className="animate-in fade-in slide-in-from-bottom-2">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-1 flex items-center gap-2">
                  <Star size={14} className="text-yellow-500 fill-yellow-500" /> Lokasi Favorit
                </h3>
                {favorites.map(item => <ResultCard key={`fav-${item.id}`} item={item} isHistory={true} />)}
              </section>
            )}
            
            <section className="animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-1 flex items-center gap-2">
                <History size={14} /> Terakhir Dicari
              </h3>
              {history.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-3xl opacity-30">
                  <Zap size={32} className="mx-auto mb-2" />
                  <p className="text-sm font-bold uppercase tracking-tighter">Belum ada paket yang disortir</p>
                </div>
              ) : (
                history.map(item => <ResultCard key={`hist-${item.id}`} item={item} isHistory={true} />)
              )}
            </section>
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4 px-1">
                <p className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">DITEMUKAN {results.length} LOKASI</p>
                <button onClick={() => setSearchTerm('')} className="text-[10px] font-bold text-red-500 uppercase">Hapus</button>
            </div>
            {results.map(item => <ResultCard key={item.id} item={item} />)}
            {results.length === 0 && (
              <div className="text-center py-20 opacity-20">
                <Package size={64} className="mx-auto mb-4" />
                <p className="font-black text-xl uppercase">Lokasi Tidak Terdaftar</p>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className={`fixed bottom-0 left-0 right-0 p-3 text-center text-[10px] font-bold tracking-tighter transition-colors ${darkMode ? 'bg-slate-950 text-slate-600' : 'bg-white text-slate-400 border-t'}`}>
        JNE SMART SORTER • SISTEM BANTU OUTBOUND
      </footer>
    </div>
  );
};

export default App;

