
import React, { useState, useEffect } from 'react';
import { searchDestinations } from './api';
import SortCard from './components/SortCard';
import Header from './components/Header';
import ScannerModal from './components/ScannerModal';
import PhoneModal from './components/PhoneModal'; // Impor komponen baru
import { 
  Package, History, Star, Loader2, X, ScanBarcode, 
  ArrowRight, ClipboardList, Truck, CheckCircle2, Lock
} from 'lucide-react';

const BINDERBYTE_KEY = '65066a3619137b92eeb5ef539dd6a309d7b7933e7374ceb3fb776e031c2c808a';

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [apiLoading, setApiLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [activeTab, setActiveTab] = useState('search');
  const [scanDetail, setScanDetail] = useState(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [tempAwb, setTempAwb] = useState('');
  // State `lastFiveDigits` dihapus dari sini
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('ss_history') || '[]'));
  const [pinned, setPinned] = useState(() => JSON.parse(localStorage.getItem('ss_pinned') || '[]'));

  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const searchTimeout = setTimeout(async () => {
      try {
        const results = await searchDestinations(searchTerm);
        setSearchResults(results);
      } catch (err) {
        console.error('Search API Error', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(searchTimeout);
  }, [searchTerm]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('ss_history', JSON.stringify(history));
    localStorage.setItem('ss_pinned', JSON.stringify(pinned));
  }, [darkMode, history, pinned]);

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
        if (detail.destination) {
            const destinationMatches = await searchDestinations(detail.destination);
            const foundMatch = destinationMatches.length > 0 ? destinationMatches[0] : null;
            if (foundMatch) {
                speak(`Paket ditemukan. Kode Sortir ${foundMatch.sortCode}`);
                const historyItem = { id: foundMatch.id, code: foundMatch.code, name: foundMatch.name, sortCode: foundMatch.sortCode };
                setHistory(prev => [historyItem, ...prev.filter(h => h.id !== historyItem.id)].slice(0, 20));
            }
        }
      } else {
        alert("Resi tidak ditemukan!");
      }
    } catch (e) { 
        console.error(e);
        alert("Koneksi gagal atau terjadi error."); 
    } finally { 
        setApiLoading(false); 
    }
  };

  const handleManualSearch = () => {
    if (!searchTerm) return;
    const isLikelyResi = /^[A-Z0-9]{8,}$/i.test(searchTerm.trim()) && !searchTerm.includes(' ');
    if (isLikelyResi) {
        setTempAwb(searchTerm.trim());
        setShowPhoneModal(true);
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

  const handleSelectCard = (item) => {
    setHistory(prev => [item, ...prev.filter(h => h.id !== item.id)].slice(0, 20));
    speak(item.sortCode);
  };

  const handlePinCard = (item, isPinned) => {
    setPinned(prev => isPinned ? prev.filter(p => p.id !== item.id) : [...prev, item]);
  };

  const handleScanSuccess = (awb) => {
    setTempAwb(awb);
    setShowPhoneModal(true); 
    setIsScanning(false);
  };

  return (
    <div className={`min-h-screen pb-24 transition-colors font-sans ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* --- PENGGUNAAN KOMPONEN PHONE MODAL BARU --- */}
      <PhoneModal 
        isVisible={showPhoneModal}
        onClose={() => setShowPhoneModal(false)}
        onSubmit={processTracking} // `processTracking` akan menerima awb dan phone
        tempAwb={tempAwb}
        darkMode={darkMode}
      />

      <ScannerModal 
        isVisible={isScanning}
        onClose={() => setIsScanning(false)}
        onScanSuccess={handleScanSuccess}
      />

      <Header 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        handleManualSearch={handleManualSearch}
        startVoiceSearch={startVoiceSearch}
        isListening={isListening}
        isScanning={isScanning}
        setIsScanning={setIsScanning}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      <main className="max-w-xl mx-auto p-4">
        {apiLoading && (
            <div className="p-10 flex flex-col items-center gap-3 text-blue-500">
                <Loader2 className="animate-spin" size={32} />
                <p className="text-[10px] font-black tracking-[0.3em] animate-pulse">MEMPROSES DATA...</p>
            </div>
        )}

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

        {searchTerm && !scanDetail ? (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black opacity-40 uppercase tracking-widest flex items-center gap-2"><ArrowRight size={12}/> Hasil Pencarian</h3>
              {isSearching && <Loader2 className="animate-spin text-blue-500" size={16} />}
            </div>
            {!isSearching && searchResults.length === 0 ? (
                <div onClick={handleManualSearch} className="p-10 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center cursor-pointer hover:bg-blue-500/5 transition-colors">
                    <Package className="mx-auto mb-3 opacity-20" size={40}/>
                    <p className="text-sm font-bold opacity-60">Tidak ada wilayah ditemukan.</p>
                    <p className="text-[10px] uppercase tracking-widest text-blue-500 mt-2 font-black">Klik untuk Cek Resi</p>
                </div>
            ) : (
                searchResults.map(item => {
                    const isPinned = pinned.some(p => p.id === item.id);
                    return (
                        <SortCard 
                            key={item.id} 
                            item={item} 
                            isPinned={isPinned}
                            onSelect={() => handleSelectCard(item)}
                            onPin={() => handlePinCard(item, isPinned)}
                            darkMode={darkMode}
                        />
                    )
                })
            )}
          </div>
        ) : !scanDetail && (
          <div className="space-y-8">
            {pinned.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Star size={12} fill="currentColor"/> Pinned Wilayah</h3>
                {pinned.map(item => {
                    const isPinned = true;
                    return (
                        <SortCard 
                            key={`p-${item.id}`} 
                            item={item} 
                            isPinned={isPinned}
                            onSelect={() => handleSelectCard(item)}
                            onPin={() => handlePinCard(item, isPinned)}
                            darkMode={darkMode}
                        />
                    )
                })}
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
                history.map(item => {
                    const isPinned = pinned.some(p => p.id === item.id);
                    return (
                        <SortCard 
                            key={`h-${item.id}`} 
                            item={item} 
                            isPinned={isPinned}
                            onSelect={() => handleSelectCard(item)}
                            onPin={() => handlePinCard(item, isPinned)}
                            darkMode={darkMode}
                        />
                    )
                })
              )}
            </div>
          </div>
        )}
      </main>

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

export default App;
