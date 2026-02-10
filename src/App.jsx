import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Package, MapPin, Mic, MicOff, 
  History, Star, Sun, Moon, Zap, Trash2,
  AlertCircle, Loader2, Volume2, X, ScanBarcode, Camera 
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// --- UTILS & HOOKS ---

const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

const HighlightText = ({ text, highlight }) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? <span key={i} className="bg-yellow-300 text-slate-900 px-0.5 rounded-sm">{part}</span> : part
      )}
    </span>
  );
};

// --- COMPONENT: SCANNER MODAL ---
const BarcodeScanner = ({ onScanSuccess, onClose }) => {
  useEffect(() => {
    // Config Scanner agar support Barcode 1D (Resi) dan QR
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 150 }, // Kotak scan persegi panjang (cocok utk resi)
      aspectRatio: 1.0,
      formatsToSupport: [ 
        Html5QrcodeSupportedFormats.CODE_128, // Format umum resi JNE/Logistik
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE 
      ]
    };

    const scanner = new Html5QrcodeScanner("reader", config, false);

    scanner.render((decodedText) => {
      // Bersihkan scanner setelah sukses
      scanner.clear().then(() => {
        onScanSuccess(decodedText);
      }).catch(error => {
        console.error("Failed to clear scanner", error);
      });
    }, (error) => {
      // Handle error scanning (biasanya diabaikan karena scanning terjadi terus menerus)
    });

    // Cleanup saat component unmount (tutup modal)
    return () => {
      scanner.clear().catch(error => console.error("Failed to clear scanner on unmount", error));
    };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden relative">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2">
            <ScanBarcode /> PINDAI RESI / KODE
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        {/* Area Kamera */}
        <div id="reader" className="w-full bg-black min-h-[300px]"></div>

        <div className="p-4 text-center bg-slate-50 text-slate-600 text-xs font-bold">
          Arahkan kamera ke Barcode Paket
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const App = () => {
  // State
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false); // State untuk modal scanner
  const [activeTab, setActiveTab] = useState('search'); 

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('jne_history') || '[]'));
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('jne_favorites') || '[]'));

  const searchInputRef = useRef(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const vibrate = (pattern = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  // 1. Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/jne_destination_code.csv');
        if (!response.ok) throw new Error('Database offline.');
        const text = await response.text();
        
        const lines = text.split('\n');
        const parsed = [];
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(regex).map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length >= 3) {
            parsed.push({
              id: `${cols[0]}-${cols[1]}`, 
              code: cols[1],
              sortCode: cols[1]?.substring(0, 3).toUpperCase() || 'UNK',
              name: cols[2],
            });
          }
        }
        setData(parsed);
      } catch (err) {
        setError("Gagal memuat database sorting.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('jne_history', JSON.stringify(history));
    localStorage.setItem('jne_favorites', JSON.stringify(favorites));
  }, [history, favorites]);

  // 2. Logic Scanner
  const handleScanSuccess = (decodedText) => {
    vibrate([50, 50, 100]); // Getar 2x tanda sukses
    setIsScanning(false); // Tutup modal
    setSearchTerm(decodedText); // Masukkan hasil scan ke search
    
    // Auto Select logic (Opsional: jika hasil scan COCOK PERSIS dengan Kode, langsung simpan ke history)
    // Tapi lebih aman biarkan user melihat hasilnya dulu di list.
  };

  // 3. Smart Filtering
  const results = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    
    const term = debouncedSearch.toLowerCase().replace(/[^a-z0-9 ]/g, ""); // Bersihkan simbol aneh dari barcode
    
    return data
      .map(item => {
        let score = 0;
        const nameLower = item.name.toLowerCase();
        const codeLower = item.code.toLowerCase();

        if (codeLower === term) score += 100;
        else if (codeLower.startsWith(term)) score += 80; 
        else if (nameLower === term) score += 60;
        else if (nameLower.startsWith(term)) score += 50; 
        else if (nameLower.includes(term)) score += 20; 
        else if (codeLower.includes(term)) score += 10; 

        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); 
  }, [debouncedSearch, data]);

  // 4. Voice Logic
  const toggleListening = () => {
    vibrate(50);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser tidak support fitur suara.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript.replace(/[.?!]/g, '');
      setSearchTerm(text);
      vibrate([50, 50, 50]);
    };

    recognition.start();
  };

  const handleSelect = (item) => {
    vibrate(20);
    setHistory(prev => [item, ...prev.filter(h => h.id !== item.id)].slice(0, 20));
    // setSearchTerm(''); // Keep search term active to show result
  };

  const toggleFavorite = (item, e) => {
    e.stopPropagation();
    vibrate(10);
    const exists = favorites.find(f => f.id === item.id);
    if (exists) setFavorites(prev => prev.filter(f => f.id !== item.id));
    else setFavorites(prev => [item, ...prev]);
  };

  const clearHistory = () => {
    if(window.confirm('Hapus semua riwayat?')) setHistory([]);
  };

  const ResultCard = ({ item, isHistory }) => {
    const isFav = favorites.some(f => f.id === item.id);
    const [city, ...districts] = item.name.split(',');

    return (
      <div 
        onClick={() => handleSelect(item)}
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 mb-3 cursor-pointer
          ${darkMode 
            ? 'bg-slate-800/50 border-slate-700 hover:bg-slate-800' 
            : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-lg'
          }
        `}
      >
        <div className="flex h-full">
          <div className={`w-24 flex flex-col items-center justify-center p-3 text-center shrink-0 transition-colors
            ${darkMode ? 'bg-slate-700' : 'bg-slate-100 group-hover:bg-blue-600 group-hover:text-white'}
          `}>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sortir</span>
            <span className="text-3xl font-black tracking-tighter">{item.sortCode}</span>
          </div>

          <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="truncate">
                <h3 className={`font-bold text-lg leading-tight truncate ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  <HighlightText text={city} highlight={debouncedSearch} />
                </h3>
                {districts.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs font-medium opacity-70 truncate">
                    <MapPin size={12} />
                    <HighlightText text={districts.join(', ')} highlight={debouncedSearch} />
                  </div>
                )}
              </div>
              <button 
                onClick={(e) => toggleFavorite(item, e)}
                className={`p-2 rounded-full transition-all active:scale-90 
                  ${isFav ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
              >
                <Star size={18} fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-900 dark:text-slate-400 px-2 py-0.5 rounded text-slate-600 font-bold">
                KODE: {item.code}
              </span>
              {isHistory && <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1">TERAKHIR DILIHAT <History size={10}/></span>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300
      ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}
    `}>
      
      {/* SCANNER MODAL */}
      {isScanning && (
        <BarcodeScanner 
          onScanSuccess={handleScanSuccess} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      {/* HEADER */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors
        ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}
      `}>
        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-tr from-red-600 to-orange-600 p-2 rounded-xl shadow-lg shadow-red-500/20">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="font-black text-sm tracking-tight leading-none">SMART SORTER</h1>
                <p className="text-[10px] font-bold opacity-50 mt-0.5">SCAN & SORT v2.1</p>
              </div>
            </div>
            <button 
              onClick={() => { vibrate(); setDarkMode(!darkMode); }} 
              className={`p-2.5 rounded-full transition-transform active:scale-90
                ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}
              `}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div className={`relative group transition-all duration-300 ${isListening ? 'scale-105' : ''}`}>
            <div className={`absolute -inset-0.5 rounded-2xl blur opacity-30 transition duration-500
              ${isListening ? 'bg-red-500 opacity-70 animate-pulse' : 'bg-blue-500'}
            `}></div>
            <div className={`relative flex items-center rounded-2xl shadow-sm border overflow-hidden
              ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}
            `}>
              {/* Tombol Scan Camera */}
              <button 
                onClick={() => setIsScanning(true)}
                className="pl-3 pr-2 py-4 text-slate-400 hover:text-blue-500 transition-colors border-r border-slate-100 dark:border-slate-800"
              >
                <Camera size={24} />
              </button>

              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isListening ? "Katakan sesuatu..." : "Scan Resi / Ketik..."}
                className={`w-full py-3.5 px-3 bg-transparent outline-none font-bold text-lg placeholder:font-medium placeholder:text-slate-400
                  ${darkMode ? 'text-white' : 'text-slate-900'}
                `}
                disabled={loading}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <button 
                onClick={toggleListening}
                className={`p-3 mr-1 rounded-xl transition-all active:scale-95
                  ${isListening ? 'bg-red-50 text-red-600' : 'text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800'}
                `}
              >
                {isListening ? <Volume2 size={22} className="animate-bounce" /> : <Mic size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-xl mx-auto px-4 py-6 pb-24">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 opacity-50 space-y-4 animate-pulse">
            <Loader2 className="animate-spin text-blue-500" size={40} />
            <p className="text-xs font-bold tracking-widest uppercase">Sinkronisasi Database...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-2xl text-center">
            <AlertCircle className="mx-auto mb-3 text-red-500" size={32} />
            <p className="font-bold text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {searchTerm ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-between items-end mb-4 px-1">
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Hasil Pencarian ({results.length})
                  </span>
                </div>
                
                {results.length > 0 ? (
                  results.map(item => <ResultCard key={item.id} item={item} />)
                ) : (
                  <div className="text-center py-16 opacity-40">
                    <ScanBarcode size={64} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <p className="font-black text-lg">TIDAK DITEMUKAN</p>
                    <p className="text-sm px-10">
                      Jika hasil scan adalah nomor Resi (angka), pastikan database memiliki data resi, atau scan Barcode Kode Tujuan.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button 
                    onClick={() => setActiveTab('history')}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all
                      ${activeTab === 'history' 
                        ? 'bg-blue-500 border-blue-600 text-white shadow-lg shadow-blue-500/30' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                    `}
                  >
                    <History size={20} />
                    <span className="text-xs font-bold uppercase">Riwayat</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('favorites')}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all
                      ${activeTab === 'favorites' 
                        ? 'bg-yellow-500 border-yellow-600 text-white shadow-lg shadow-yellow-500/30' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}
                    `}
                  >
                    <Star size={20} fill="currentColor" />
                    <span className="text-xs font-bold uppercase">Favorit</span>
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      {activeTab === 'history' ? <History size={14}/> : <Star size={14}/>}
                      {activeTab === 'history' ? 'Terakhir Dilihat' : 'Disimpan'}
                    </h3>
                    {activeTab === 'history' && history.length > 0 && (
                      <button onClick={clearHistory} className="text-[10px] font-bold text-red-500 flex items-center gap-1 hover:underline">
                        <Trash2 size={10} /> BERSIHKAN
                      </button>
                    )}
                  </div>

                  {activeTab === 'history' ? (
                    history.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl opacity-40">
                        <Zap size={32} className="mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase">Belum ada aktivitas</p>
                      </div>
                    ) : (
                      history.map(item => <ResultCard key={`hist-${item.id}`} item={item} isHistory />)
                    )
                  ) : (
                    favorites.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl opacity-40">
                        <Star size={32} className="mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase">Belum ada favorit</p>
                      </div>
                    ) : (
                      favorites.map(item => <ResultCard key={`fav-${item.id}`} item={item} />)
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className={`fixed bottom-0 w-full border-t backdrop-blur-md p-4 flex justify-between items-center text-[10px] font-bold tracking-widest transition-colors z-40
        ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-500' : 'bg-white/80 border-slate-200 text-slate-400'}
      `}>
         <span>SMART SORTER SYSTEM</span>
         <span className="opacity-50">SCANNER ENABLED</span>
      </footer>
    </div>
  );
};

export default App;