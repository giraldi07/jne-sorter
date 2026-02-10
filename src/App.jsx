import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Package, MapPin, Mic, MicOff, 
  History, Star, Sun, Moon, Zap, Trash2,
  AlertCircle, Loader2, Volume2, X, ScanBarcode, Camera, FlipHorizontal
} from 'lucide-react';
import Tesseract from 'tesseract.js';

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

// --- COMPONENT: SMART OCR SCANNER ---
// Menggunakan Tesseract.js untuk membaca teks alamat dari gambar kamera
const SmartScanner = ({ onScanSuccess, onClose, darkMode }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('Posisikan alamat di dalam kotak');

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setStatus("Gagal akses kamera. Periksa izin browser.");
      }
    }
    setupCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setStatus("Sedang membaca teks resi...");

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Ambil frame dari video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      // Proses OCR (Bahasa Indonesia)
      const result = await Tesseract.recognize(
        canvas.toDataURL('image/jpeg', 0.8),
        'ind',
        { logger: m => console.log(m.status + ": " + Math.round(m.progress * 100) + "%") }
      );

      const rawText = result.data.text;
      onScanSuccess(rawText);
    } catch (err) {
      console.error(err);
      setStatus("Gagal memproses gambar.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Overlay Bingkai Fokus */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-64 h-40 border-2 border-blue-400 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
          <div className="mt-4 px-4 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-full uppercase tracking-widest">
            Area Alamat / Kode
          </div>
        </div>

        {/* Status Loading */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white p-6 text-center">
            <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
            <p className="font-bold animate-pulse">{status}</p>
          </div>
        )}

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="mt-8 flex flex-col items-center gap-4 w-full max-w-md">
        <p className="text-white/70 text-sm font-medium">{status}</p>
        <button 
          onClick={handleCapture}
          disabled={isProcessing}
          className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          AMBIL FOTO & SCAN
        </button>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

const App = () => {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); 

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('jne_history') || '[]'));
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('jne_favorites') || '[]'));

  const searchInputRef = useRef(null);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const vibrate = (pattern = 10) => {
    if (navigator.vibrate) navigator.vibrate(pattern);
  };

  // 1. Load Database CSV
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

  // 2. Logic Scanner Success
  const handleScanSuccess = (rawText) => {
    vibrate([50, 100]);
    setIsScanning(false);

    // LOGIKA PENCARIAN PINTAR:
    // Kita pecah teks hasil OCR menjadi kata-kata, lalu cari kata yang ada di database
    const words = rawText.toUpperCase().split(/[\s,.\n]+/).filter(w => w.length > 3);
    
    let bestMatch = "";
    for (const word of words) {
      const match = data.find(item => 
        item.name.toUpperCase().includes(word) || 
        item.code.toUpperCase() === word
      );
      if (match) {
        bestMatch = word;
        break;
      }
    }

    if (bestMatch) {
      setSearchTerm(bestMatch);
    } else {
      // Jika tidak ada yang cocok, ambil baris terakhir (biasanya lokasi di resi ada di bawah)
      const lines = rawText.split('\n').filter(l => l.trim().length > 0);
      setSearchTerm(lines[lines.length - 1] || "");
      alert("Alamat terdeteksi, silakan sesuaikan jika kurang tepat.");
    }
  };

  // 3. Smart Filtering
  const results = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const term = debouncedSearch.toLowerCase();
    
    return data
      .map(item => {
        let score = 0;
        const nameLower = item.name.toLowerCase();
        const codeLower = item.code.toLowerCase();

        if (codeLower === term) score += 100;
        else if (nameLower.includes(term)) score += 50; 
        else if (codeLower.includes(term)) score += 20; 

        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30); 
  }, [debouncedSearch, data]);

  const toggleListening = () => {
    vibrate(50);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Browser tidak support.");
    if (isListening) return setIsListening(false);

    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      setSearchTerm(event.results[0][0].transcript.replace(/[.?!]/g, ''));
    };
    recognition.start();
  };

  const handleSelect = (item) => {
    vibrate(20);
    setHistory(prev => [item, ...prev.filter(h => h.id !== item.id)].slice(0, 20));
  };

  const ResultCard = ({ item, isHistory }) => {
    const isFav = favorites.some(f => f.id === item.id);
    const [city, ...districts] = item.name.split(',');

    return (
      <div 
        onClick={() => handleSelect(item)}
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 mb-3 cursor-pointer
          ${darkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}
        `}
      >
        <div className="flex h-full">
          <div className={`w-20 flex flex-col items-center justify-center p-2 text-center shrink-0 
            ${darkMode ? 'bg-slate-700 text-blue-400' : 'bg-blue-600 text-white'}
          `}>
            <span className="text-[9px] font-bold uppercase tracking-tighter opacity-80">SORT</span>
            <span className="text-2xl font-black">{item.sortCode}</span>
          </div>
          <div className="flex-1 p-4 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="truncate">
                <h3 className="font-bold text-base leading-tight truncate">
                  <HighlightText text={city} highlight={debouncedSearch} />
                </h3>
                <p className="text-xs opacity-60 truncate mt-1 flex items-center gap-1">
                  <MapPin size={10} /> {districts.join(', ') || 'Area Utama'}
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setFavorites(prev => prev.find(f => f.id === item.id) ? prev.filter(f => f.id !== item.id) : [...prev, item]);
                }}
                className={`p-2 rounded-full ${isFav ? 'text-yellow-400' : 'text-slate-300'}`}
              >
                <Star size={18} fill={isFav ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {isScanning && <SmartScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} darkMode={darkMode} />}

      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-500/20 text-white">
                <Package size={20} />
              </div>
              <h1 className="font-black text-lg tracking-tighter">SCANNER<span className="text-red-600">SORT</span></h1>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-800">
              {darkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}
            </button>
          </div>

          <div className="relative flex items-center gap-2">
            <div className={`flex-1 flex items-center rounded-2xl border ${darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} p-1`}>
              <button onClick={() => setIsScanning(true)} className="p-3 text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                <Camera size={24} />
              </button>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Scan resi atau ketik alamat..."
                className="w-full py-3 px-2 bg-transparent outline-none font-bold text-base"
              />
              {searchTerm && <button onClick={() => setSearchTerm('')} className="p-2 opacity-40"><X size={18}/></button>}
              <button onClick={toggleListening} className={`p-3 rounded-xl ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                {isListening ? <Volume2 size={22}/> : <Mic size={22}/>}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center py-20 opacity-40"><Loader2 className="animate-spin mb-2" /> <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p></div>
        ) : (
          <>
            {searchTerm ? (
              <div className="animate-in fade-in slide-in-from-bottom-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hasil Pencarian ({results.length})</p>
                {results.map(item => <ResultCard key={item.id} item={item} />)}
                {results.length === 0 && <div className="text-center py-20 opacity-30"><Search size={48} className="mx-auto mb-2" /><p className="font-bold">Tidak ditemukan</p></div>}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setActiveTab('history')} className={`p-4 rounded-2xl border flex flex-col items-center gap-1 font-bold text-xs uppercase ${activeTab === 'history' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-900'}`}><History size={18}/> Riwayat</button>
                  <button onClick={() => setActiveTab('favorites')} className={`p-4 rounded-2xl border flex flex-col items-center gap-1 font-bold text-xs uppercase ${activeTab === 'favorites' ? 'bg-yellow-500 border-yellow-500 text-white' : 'bg-white dark:bg-slate-900'}`}><Star size={18}/> Favorit</button>
                </div>
                <div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{activeTab === 'history' ? 'Terakhir Dilihat' : 'Disimpan'}</h3>
                  {(activeTab === 'history' ? history : favorites).map(item => <ResultCard key={item.id} item={item} isHistory={activeTab === 'history'} />)}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className={`fixed bottom-0 w-full p-4 text-center text-[10px] font-black tracking-[0.2em] border-t backdrop-blur-md ${darkMode ? 'bg-slate-950/80 border-slate-800 text-slate-500' : 'bg-white/80 text-slate-400'}`}>
        INTERNAL SORTING SYSTEM V2.5
      </footer>
    </div>
  );
};

export default App;