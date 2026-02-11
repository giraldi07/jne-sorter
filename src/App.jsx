import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, Package, MapPin, Mic, History, Star, Sun, Moon, 
  Trash2, AlertCircle, Loader2, Volume2, X, ScanBarcode, 
  Camera, User, Send, ArrowRight, ClipboardList, Info, Zap,
  Truck, Box, Calendar, CheckCircle2, Phone, ShieldCheck, Lock
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
  
  // States untuk fitur HP & Tracking
  const [scanDetail, setScanDetail] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [tempAwb, setTempAwb] = useState('');
  const [lastFiveDigits, setLastFiveDigits] = useState('');

  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('ss_history') || '[]'));
  const [pinned, setPinned] = useState(() => JSON.parse(localStorage.getItem('ss_pinned') || '[]'));

  // --- LOGIC: TTS ---
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

  // --- LOGIC: SMART SEARCH ---
  const smartFilteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const keywords = searchTerm.toLowerCase().split(/[\s,]+/).filter(k => k.length > 1);
    
    return data.filter(item => {
      const target = `${item.name} ${item.code}`.toLowerCase();
      return keywords.every(key => target.includes(key));
    }).slice(0, 15);
  }, [searchTerm, data]);

  // --- LOGIC: PROCESS TRACKING (WITH OPTIONAL PHONE) ---
  const processTracking = async (awb, phoneDigits = '') => {
    setApiLoading(true);
    setScanDetail(null);
    setIsScanning(false);
    setShowPhoneModal(false);

    try {
      const phoneParam = phoneDigits ? `&phone=${phoneDigits}` : '';
      const res = await fetch(`https://api.binderbyte.com/v1/track?api_key=${BINDERBYTE_KEY}&courier=jne&awb=${awb}${phoneParam}`);
      const result = await res.json();

      if (result.status === 200) {
        const info = result.data;
        
        // Bersihkan riwayat dari instruksi API jika phone tidak diisi
        const rawHistory = info.history || [];
        const isRestricted = rawHistory.some(h => h.desc.includes("PARAMETER: number"));
        const cleanHistory = isRestricted 
            ? [{ date: info.summary.date, desc: "Detail transit terkunci. Masukkan 5 digit HP untuk membuka.", isLocked: true }]
            : rawHistory;

        const detail = {
          awb: info.summary.awb,
          courier: info.summary.courier,
          status: info.summary.status,
          date: info.summary.date,
          sender: info.detail.shipper,
          receiver: info.detail.receiver,
          origin: info.detail.origin,
          destination: info.detail.destination.toUpperCase(),
          history: cleanHistory,
          isRestricted: isRestricted
        };
        setScanDetail(detail);
        
        // Auto matching sort code
        const destKeywords = detail.destination.split(/[\s,]+/).filter(k => k.length > 3);
        let foundMatch = null;
        for (const word of destKeywords) {
          foundMatch = data.find(item => item.name.toUpperCase().includes(word));
          if (foundMatch) break;
        }

        if (foundMatch) {
          speak(`Paket ditemukan. Kode Sortir ${foundMatch.sortCode}`);
          setHistory(prev => [foundMatch, ...prev.filter(h => h.id !== foundMatch.id)].slice(0, 20));
        }
      } else {
        alert("Resi tidak ditemukan!");
      }
    } catch (e) { 
        alert("Koneksi gagal."); 
    } finally { 
        setApiLoading(false); 
    }
  };

  const handleManualSearch = () => {
    if (!searchTerm) return;
    const isLikelyResi = /^[A-Z0-9]{8,}$/i.test(searchTerm.trim()) && !searchTerm.includes(' ');
    if (isLikelyResi) {
        setTempAwb(searchTerm.trim());
        setShowPhoneModal(true); // Tawarkan opsi masukkan HP
    } else {
        speak("Mencari wilayah " + searchTerm);
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e) => {
        const text = e.results[0][0].transcript.replace(/\s/g, '').toUpperCase();
        setSearchTerm(text);
        if(/^[A-Z0-9]{8,}$/.test(text)) {
            setTempAwb(text);
            setShowPhoneModal(true);
        }
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
      
      {/* PHONE MODAL (OPSIONAL) */}
      {showPhoneModal && (
          <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
                        <ShieldCheck className="text-blue-500" size={18}/> OPTIMALKAN TRACKING
                      </h3>
                      <button onClick={() => setShowPhoneModal(false)}><X size={18}/></button>
                  </div>
                  <p className="text-[11px] opacity-60 mb-4 leading-relaxed">Masukkan 5 digit terakhir HP penerima untuk melihat riwayat transit lengkap. Lewati jika tidak perlu.</p>
                  
                  <div className={`flex items-center gap-2 p-3 rounded-2xl mb-4 border ${darkMode ? 'bg-black/20 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                    <Phone size={16} className="opacity-40" />
                    <input 
                        type="number" 
                        placeholder="Contoh: 12345"
                        maxLength={5}
                        className="bg-transparent border-none outline-none w-full text-sm font-bold"
                        value={lastFiveDigits}
                        onChange={(e) => setLastFiveDigits(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => processTracking(tempAwb, '')}
                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
                        Lewati
                      </button>
                      <button 
                        onClick={() => processTracking(tempAwb, lastFiveDigits)}
                        className="py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30">
                        Cek Detail
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* SCANNER MODAL */}
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-white font-black flex items-center gap-2"><ScanBarcode size={20} /> SCANNER ACTIVE</h2>
                <button onClick={() => setIsScanning(false)} className="bg-white/10 p-2 rounded-full text-white"><X /></button>
            </div>
            <div className="flex-1 rounded-3xl overflow-hidden border-2 border-white/20">
                <ScannerContainer onScanSuccess={(awb) => { setTempAwb(awb); setShowPhoneModal(true); setIsScanning(false); }} />
            </div>
        </div>
      )}

      {/* HEADER */}
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

      {/* CONTENT */}
      <main className="max-w-xl mx-auto p-4">
        {apiLoading && (
            <div className="p-10 flex flex-col items-center gap-3 text-blue-500">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-black tracking-[0.3em] animate-pulse">MEMPROSES DATA...</p>
            </div>
        )}

        {/* --- TRACKING RESULT --- */}
        {scanDetail && !apiLoading && (
          <div className="mb-8 relative overflow-hidden rounded-3xl text-white shadow-2xl animate-in zoom-in-95 duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br ${scanDetail.status === 'DELIVERED' ? 'from-green-600 to-emerald-800' : 'from-blue-600 to-indigo-900'}`}></div>
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]"></div>

            <div className="relative p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border border-white/10">{scanDetail.courier}</span>
                            <span className="text-[10px] font-mono opacity-70">{scanDetail.date}</span>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight">{scanDetail.awb}</h2>
                    </div>
                    <button onClick={() => setScanDetail(null)} className="p-2 bg-black/20 rounded-full hover:bg-black/40"><X size={18}/></button>
                </div>

                <div className="mb-6 bg-black/20 rounded-2xl p-4 border border-white/10 backdrop-blur-sm flex items-center gap-4">
                    {scanDetail.status === 'DELIVERED' ? <CheckCircle2 className="text-green-300" size={32}/> : <Truck className="text-blue-200" size={32}/>}
                    <div>
                        <span className="text-xs font-bold opacity-60 uppercase tracking-wider block">Status Terkini</span>
                        <p className="text-lg font-black uppercase leading-none">{scanDetail.status}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white/10 rounded-full flex items-center justify-center border border-white/20"><ArrowRight size={14} /></div>
                    <div className="bg-white/10 p-3 rounded-2xl border border-white/5">
                        <span className="text-[9px] font-bold uppercase opacity-60 block mb-1">Pengirim</span>
                        <p className="font-bold text-sm truncate">{scanDetail.sender}</p>
                        <p className="text-[10px] truncate opacity-70">{scanDetail.origin}</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl border border-white/5 text-right">
                        <span className="text-[9px] font-bold uppercase opacity-60 block mb-1">Penerima</span>
                        <p className="font-bold text-sm truncate">{scanDetail.receiver}</p>
                        <p className="text-[10px] font-black text-yellow-300 uppercase truncate">{scanDetail.destination}</p>
                    </div>
                </div>

                {/* --- HISTORY SECTION --- */}
                {scanDetail.history && scanDetail.history.length > 0 && (
                     <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex gap-3 items-center">
                            {scanDetail.isRestricted ? <Lock size={16} className="text-yellow-400 shrink-0"/> : <div className="w-2 h-2 rounded-full bg-yellow-400 shrink-0 shadow-[0_0_10px_rgba(250,204,21,0.6)]"></div>}
                            <div className="flex-1">
                                <p className="text-[10px] font-mono opacity-60">{scanDetail.isRestricted ? "HISTORY TERBATAS" : scanDetail.history[0].date}</p>
                                <p className={`text-xs font-semibold leading-relaxed ${scanDetail.isRestricted ? 'italic opacity-70' : 'opacity-90'}`}>
                                    {scanDetail.history[0].desc}
                                </p>
                            </div>
                            {scanDetail.isRestricted && (
                                <button onClick={() => setShowPhoneModal(true)} className="text-[9px] font-black bg-white/20 px-2 py-1 rounded-lg uppercase">Buka</button>
                            )}
                        </div>
                     </div>
                )}
            </div>
          </div>
        )}

        {/* SEARCH RESULTS (LOCAL) */}
        {searchTerm && !scanDetail ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-4 flex items-center gap-2"><ArrowRight size={12}/> Hasil Pencarian</h3>
            {smartFilteredResults.length > 0 ? (
                smartFilteredResults.map(item => <SortCard key={item.id} item={item} isPinned={pinned.some(p => p.id === item.id)} />)
            ) : (
                <div onClick={handleManualSearch} className="p-10 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center cursor-pointer hover:bg-blue-500/5 transition-colors">
                    <Package className="mx-auto mb-3 opacity-20" size={40}/>
                    <p className="text-sm font-bold opacity-60">Tidak ada wilayah ditemukan.</p>
                    <p className="text-[10px] uppercase tracking-widest text-blue-500 mt-2 font-black">Klik untuk Cek Resi</p>
                </div>
            )}
          </div>
        ) : !scanDetail && (
          <div className="space-y-8">
            {pinned.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Pinned Wilayah</h3>
                {pinned.map(item => <SortCard key={`p-${item.id}`} item={item} isPinned={true} />)}
              </div>
            )}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black opacity-40 uppercase tracking-widest flex items-center gap-2"><History size={12}/> Riwayat Sortir</h3>
                {history.length > 0 && <button onClick={() => setHistory([])} className="text-red-500 font-bold text-[10px]">CLEAR</button>}
              </div>
              {history.length === 0 ? (
                <div className="py-20 text-center opacity-20"><Package size={48} className="mx-auto mb-2" /><p className="font-bold text-xs">Belum ada aktivitas</p></div>
              ) : (
                history.map(item => <SortCard key={`h-${item.id}`} item={item} isPinned={pinned.some(p => p.id === item.id)} />)
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER NAV */}
      <footer className={`fixed bottom-0 w-full p-4 border-t backdrop-blur-xl flex justify-around items-center transition-colors ${darkMode ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}`}>
        <button onClick={() => { setActiveTab('search'); setSearchTerm(''); setScanDetail(null); }} className={`flex flex-col items-center gap-1 ${activeTab === 'search' ? 'text-blue-500' : 'text-slate-400'}`}>
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