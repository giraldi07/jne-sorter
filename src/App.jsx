import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Package, MapPin, Mic, 
  History, Star, Sun, Moon, Zap, Trash2,
  AlertCircle, Loader2, X, ScanBarcode, Camera 
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// --- CONFIG API ---
const BINDERBYTE_KEY = '65066a3619137b92eeb5ef539dd6a309d7b7933e7374ceb3fb776e031c2c808a';

// --- UTILS ---
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
};

// --- COMPONENT: BARCODE SCANNER ---
const BarcodeScanner = ({ onScanSuccess, onClose }) => {
  useEffect(() => {
    const config = {
      fps: 15,
      qrbox: { width: 280, height: 150 },
      aspectRatio: 1.0,
      formatsToSupport: [ Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39 ]
    };

    const scanner = new Html5QrcodeScanner("reader", config, false);
    scanner.render((decodedText) => {
      scanner.clear().then(() => onScanSuccess(decodedText));
    }, () => {});

    return () => { scanner.clear().catch(() => {}); };
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
            <ScanBarcode size={18} className="text-blue-500" /> Pindai Barcode Resi
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <div id="reader" className="w-full bg-black aspect-video"></div>
        <div className="p-6 text-center">
          <p className="text-sm font-bold text-slate-500 italic">Arahkan kamera ke garis-garis barcode resi JNE</p>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
const App = () => {
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isScanning, setIsScanning] = useState(false);
  
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('jne_history') || '[]'));
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('jne_favorites') || '[]'));

  const debouncedSearch = useDebounce(searchTerm, 300);

  // 1. Load Database CSV (Sama seperti sebelumnya)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/jne_destination_code.csv');
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
        setError("Database CSV gagal dimuat.");
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

  // 2. LOGIKA UTAMA: Ambil Data Resi dari Binderbyte
  const handleAwbScanned = async (awb) => {
    setIsScanning(false);
    setApiLoading(true);
    if (navigator.vibrate) navigator.vibrate([50, 100]);

    try {
      const response = await fetch(`https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=jne&awb=${awb}`);
      const result = await response.json();

      if (result.status === 200) {
        // Ambil data destinasi (biasanya formatnya "KOTA, KECAMATAN")
        const dest = result.data.detail.destination.toUpperCase();
        console.log("Destinasi API:", dest);

        // Cari di database CSV yang paling cocok
        findMatchingSortCode(dest, awb);
      } else {
        alert("Resi tidak ditemukan atau limit API habis: " + result.message);
        setSearchTerm(awb);
      }
    } catch (err) {
      alert("Gagal koneksi ke server Binderbyte.");
    } finally {
      setApiLoading(false);
    }
  };

  const findMatchingSortCode = (destinationStr, originalAwb) => {
    // Strategi pencarian: Pecah kata "KOTA KECAMATAN" dan cari kecocokan di CSV
    const parts = destinationStr.split(/[\s,]+/).filter(p => p.length > 2);
    
    let match = null;
    // Cek kecocokan kata per kata
    for (const part of parts) {
      match = data.find(item => item.name.toUpperCase().includes(part));
      if (match) break;
    }

    if (match) {
      setSearchTerm(match.name);
      // Simpan ke history otomatis
      setHistory(prev => [match, ...prev.filter(h => h.id !== match.id)].slice(0, 20));
      if (navigator.vibrate) navigator.vibrate(200);
    } else {
      setSearchTerm(destinationStr);
      alert("Alamat dapat, tapi kode sortir tidak ditemukan di CSV.");
    }
  };

  const results = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const term = debouncedSearch.toLowerCase();
    return data
      .filter(item => item.name.toLowerCase().includes(term) || item.code.toLowerCase().includes(term))
      .slice(0, 20);
  }, [debouncedSearch, data]);

  const ResultCard = ({ item }) => {
    const isFav = favorites.some(f => f.id === item.id);
    return (
      <div className={`p-4 mb-3 rounded-2xl border flex items-center gap-4 animate-in fade-in slide-in-from-right-4 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="w-16 h-16 rounded-xl bg-blue-600 flex flex-col items-center justify-center text-white shrink-0">
          <span className="text-[8px] font-black opacity-70">SORT</span>
          <span className="text-xl font-black leading-none">{item.sortCode}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm truncate uppercase">{item.name}</h3>
          <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-wider">KODE: {item.code}</p>
        </div>
        <button 
          onClick={() => setFavorites(prev => isFav ? prev.filter(f => f.id !== item.id) : [...prev, item])}
          className={`p-2 rounded-full ${isFav ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-300'}`}
        >
          <Star size={18} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {isScanning && <BarcodeScanner onScanSuccess={handleAwbScanned} onClose={() => setIsScanning(false)} />}

      <header className={`sticky top-0 z-50 backdrop-blur-md border-b p-4 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-xl mx-auto flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="text-blue-500" />
            <span className="font-black tracking-tighter">API-SORT v3</span>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-yellow-400">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="max-w-xl mx-auto flex gap-2">
          <div className="flex-1 flex items-center bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl px-3 shadow-sm focus-within:ring-2 ring-blue-500 transition-all">
            <Search className="text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik alamat atau pindai..." 
              className="w-full py-3 px-3 bg-transparent outline-none font-bold text-sm"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-slate-400" /></button>}
          </div>
          <button 
            onClick={() => setIsScanning(true)}
            className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
          >
            <Camera size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 pb-20">
        {apiLoading && (
          <div className="flex flex-col items-center py-20 text-blue-500 animate-pulse">
            <Loader2 className="animate-spin mb-4" size={40} />
            <p className="font-black text-xs tracking-[0.3em] uppercase">Tracking Binderbyte...</p>
          </div>
        )}

        {!apiLoading && (
          <>
            {searchTerm ? (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Hasil Pencarian</p>
                {results.map(item => <ResultCard key={item.id} item={item} />)}
              </div>
            ) : (
              <div className="space-y-8 mt-4">
                {history.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><History size={14}/> Riwayat Sortir</h3>
                      <button onClick={() => setHistory([])} className="text-[10px] font-bold text-red-500 hover:underline">HAPUS</button>
                    </div>
                    {history.map(item => <ResultCard key={`h-${item.id}`} item={item} />)}
                  </div>
                )}
                {favorites.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4"><Star size={14}/> Favorit</h3>
                    {favorites.map(item => <ResultCard key={`f-${item.id}`} item={item} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="fixed bottom-0 w-full p-4 text-[9px] font-black text-center opacity-30 tracking-[0.3em]">
        POWERED BY BINDERBYTE & JNE CSV
      </footer>
    </div>
  );
};

export default App;