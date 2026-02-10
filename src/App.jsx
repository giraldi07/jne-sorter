import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Package, MapPin, Mic, History, Star, Sun, Moon, 
  Trash2, AlertCircle, Loader2, Volume2, X, ScanBarcode, 
  Camera, User, Send, ArrowRight, ClipboardList, Info, Zap
} from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// --- CONFIG API ---
const BINDERBYTE_KEY = '65066a3619137b92eeb5ef539dd6a309d7b7933e7374ceb3fb776e031c2c808a';

const App = () => {
  // --- STATES ---
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiLoading, setApiLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [activeTab, setActiveTab] = useState('search'); 
  
  const [scanDetail, setScanDetail] = useState(null);
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('ss_history') || '[]'));
  const [pinned, setPinned] = useState(() => JSON.parse(localStorage.getItem('ss_pinned') || '[]'));

  // --- LOGIC: TTS (SUARA ROBOT) ---
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // --- LOGIC: DATABASE LOAD ---
  useEffect(() => {
    const loadCSV = async () => {
      try {
        const response = await fetch('/jne_destination_code.csv');
        const text = await response.text();
        const lines = text.split('\n').slice(1);
        const parsed = lines.map(line => {
          const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
          if (cols.length < 3) return null;
          return { 
            id: `${cols[0]}-${cols[1]}`, 
            code: cols[1], 
            name: cols[2], 
            sortCode: cols[1]?.substring(0, 3).toUpperCase() || 'UNK' 
          };
        }).filter(Boolean);
        setData(parsed);
      } catch (err) { console.error("CSV Load Error"); }
      finally { setLoading(false); }
    };
    loadCSV();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('ss_history', JSON.stringify(history));
    localStorage.setItem('ss_pinned', JSON.stringify(pinned));
  }, [darkMode, history, pinned]);

  // --- LOGIC: SMART SEARCH (MODE 1 & 2) ---
  const smartFilteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const keywords = searchTerm.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1);
    
    return data.filter(item => {
      const target = `${item.name} ${item.code}`.toLowerCase();
      return keywords.every(key => target.includes(key));
    }).slice(0, 15);
  }, [searchTerm, data]);

  // --- LOGIC: SCANNER & API ---
  const handleAwbScanned = async (awb) => {
    setIsScanning(false);
    setApiLoading(true);
    setScanDetail(null);

    try {
      const res = await fetch(`https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=jne&awb=${awb}`);
      const result = await res.json();

      if (result.status === 200) {
        const info = result.data;
        const detail = {
          awb: info.summary.awb,
          sender: info.detail.shipper,
          receiver: info.detail.receiver,
          destination: info.detail.destination.toUpperCase()
        };
        setScanDetail(detail);
        
        // Cari kode sortir dari destinasi
        const destKeywords = detail.destination.split(/[\s,]+/).filter(k => k.length > 3);
        let foundMatch = null;
        for (const word of destKeywords) {
          foundMatch = data.find(item => item.name.toUpperCase().includes(word));
          if (foundMatch) break;
        }

        if (foundMatch) {
          setSearchTerm(foundMatch.name);
          speak(`Tujuan ${foundMatch.name}, Kode Sortir ${foundMatch.sortCode}`);
          setHistory(prev => [foundMatch, ...prev.filter(h => h.id !== foundMatch.id)].slice(0, 20));
        } else {
          setSearchTerm(detail.destination);
          speak(`Alamat ditemukan, tapi kode sortir tidak ada.`);
        }
      } else {
        alert("Resi tidak ditemukan!");
      }
    } catch (e) { alert("Error API Binderbyte"); }
    finally { setApiLoading(false); }
  };

  // --- LOGIC: VOICE (MODE 2) ---
  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript;
        setSearchTerm(text);
        speak(`Mencari ${text}`);
    };
    recognition.start();
  };

  const SortCard = ({ item, isPinned }) => (
    <div 
      onClick={() => {
        setHistory(prev => [item, ...prev.filter(h => h.id !== item.id)].slice(0, 20));
        speak(item.sortCode);
      }}
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
          e.stopPropagation();
          setPinned(prev => isPinned ? prev.filter(p => p.id !== item.id) : [...prev, item]);
        }}
        className={`p-2 rounded-lg ${isPinned ? 'text-orange-500 bg-orange-100 dark:bg-orange-500/10' : 'text-slate-300'}`}
      >
        <Star size={20} fill={isPinned ? "currentColor" : "none"} />
      </button>
    </div>
  );

  return (
    <div className={`min-h-screen pb-24 transition-colors font-sans ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* SCANNER MODAL */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-white font-black flex items-center gap-2"><ScanBarcode size={20} /> SCANNER ACTIVE</h2>
                <button onClick={() => setIsScanning(false)} className="bg-white/10 p-2 rounded-full text-white"><X /></button>
            </div>
            <div className="flex-1 rounded-3xl overflow-hidden border-2 border-white/20">
                <ScannerContainer onScanSuccess={handleAwbScanned} />
            </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`sticky top-0 z-50 p-4 border-b backdrop-blur-xl ${darkMode ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                <Zap size={18} fill="currentColor" />
              </div>
              <h1 className="font-black text-lg tracking-tighter">SONIC<span className="text-blue-600">SORT</span></h1>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
              {darkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}
            </button>
          </div>

          <div className={`flex items-center rounded-2xl border transition-all duration-300 focus-within:ring-2 ring-blue-500 ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
            <button onClick={() => setIsScanning(true)} className="p-3.5 text-blue-500"><Camera size={22}/></button>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari Kota, Resi, atau Kode..."
              className="w-full bg-transparent border-none outline-none font-bold text-sm"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="p-2 opacity-40"><X size={16}/></button>}
            <button onClick={startVoiceSearch} className={`p-3 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
              {isListening ? <Volume2 size={22}/> : <Mic size={22}/>}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-xl mx-auto p-4">
        
        {/* API LOADING */}
        {apiLoading && (
            <div className="p-10 flex flex-col items-center gap-3 text-blue-500">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-black tracking-[0.3em]">FETCHING DATA...</p>
            </div>
        )}

        {/* SCAN RESULT PANEL */}
        {scanDetail && !apiLoading && (
          <div className="mb-6 p-5 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl text-white shadow-xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-4">
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">AWB: {scanDetail.awb}</span>
              <button onClick={() => setScanDetail(null)}><X size={16}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-[8px] font-bold opacity-60 uppercase mb-1">Pengirim</p>
                <p className="font-bold text-xs truncate">{scanDetail.sender}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-bold opacity-60 uppercase mb-1">Penerima</p>
                <p className="font-bold text-xs truncate">{scanDetail.receiver}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-white/10">
              <p className="text-[8px] font-bold opacity-60 uppercase mb-1">Alamat Tujuan</p>
              <p className="text-sm font-black italic uppercase leading-tight">{scanDetail.destination}</p>
            </div>
          </div>
        )}

        {/* SEARCH RESULTS */}
        {searchTerm ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowRight size={12}/> Hasil Pencarian Pintar</h3>
            {smartFilteredResults.map(item => <SortCard key={item.id} item={item} isPinned={pinned.some(p => p.id === item.id)} />)}
          </div>
        ) : (
          <div className="space-y-8">
            {/* PINNED AREA */}
            {pinned.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Memory Hub (Pinned)</h3>
                {pinned.map(item => <SortCard key={`p-${item.id}`} item={item} isPinned={true} />)}
              </div>
            )}

            {/* HISTORY AREA */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black opacity-40 uppercase tracking-widest flex items-center gap-2"><History size={12}/> Riwayat Sortir</h3>
                {history.length > 0 && <button onClick={() => setHistory([])} className="text-red-500 font-bold text-[10px]">CLEAR</button>}
              </div>
              {history.length === 0 ? (
                <div className="py-20 text-center opacity-20"><Package size={48} className="mx-auto mb-2" /><p className="font-bold text-xs">Belum ada paket disortir</p></div>
              ) : (
                history.map(item => <SortCard key={`h-${item.id}`} item={item} isPinned={pinned.some(p => p.id === item.id)} />)
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <footer className={`fixed bottom-0 w-full p-4 border-t backdrop-blur-xl flex justify-around items-center transition-colors ${darkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <button onClick={() => { setActiveTab('search'); setSearchTerm(''); }} className={`flex flex-col items-center gap-1 ${activeTab === 'search' ? 'text-blue-500' : 'text-slate-400'}`}>
            <Search size={22} /> <span className="text-[8px] font-black uppercase">Home</span>
        </button>
        <button onClick={() => setIsScanning(true)} className="w-14 h-14 -mt-12 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-500/40 border-4 border-slate-50 dark:border-slate-950 active:scale-90 transition-transform">
            <ScanBarcode size={24} />
        </button>
        <button onClick={() => setActiveTab('pinned')} className={`flex flex-col items-center gap-1 ${activeTab === 'pinned' ? 'text-orange-500' : 'text-slate-400'}`}>
            <ClipboardList size={22} /> <span className="text-[8px] font-black uppercase">List</span>
        </button>
      </footer>
    </div>
  );
};

// --- HELPER COMPONENT: SCANNER ---
const ScannerContainer = ({ onScanSuccess }) => {
    useEffect(() => {
        const scanner = new Html5QrcodeScanner("reader", { 
            fps: 15, qrbox: { width: 280, height: 160 },
            formatsToSupport: [ Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39 ]
        }, false);
        scanner.render(onScanSuccess, (err) => {});
        return () => scanner.clear().catch(() => {});
    }, [onScanSuccess]);
    return <div id="reader" className="w-full bg-black"></div>;
};

export default App;