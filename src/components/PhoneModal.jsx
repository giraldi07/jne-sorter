
import React, { useState } from 'react';
import { X, ShieldCheck, Phone } from 'lucide-react';

// Komponen ini mengelola input nomor telepon untuk otentikasi pelacakan.
const PhoneModal = ({ isVisible, onClose, onSubmit, tempAwb, darkMode }) => {
  const [lastFiveDigits, setLastFiveDigits] = useState('');

  if (!isVisible) return null;

  const handleSubmit = () => {
    onSubmit(tempAwb, lastFiveDigits);
    setLastFiveDigits(''); // Reset setelah submit
  };

  const handleSkip = () => {
    onSubmit(tempAwb, ''); // Submit tanpa nomor telepon
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className={`w-full max-w-xs p-6 rounded-3xl shadow-2xl animate-in zoom-in-95 ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-sm tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-blue-500" size={18}/> OPTIMALKAN TRACKING
          </h3>
          <button onClick={onClose}><X size={18}/></button>
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
              onClick={handleSkip}
              className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'}`}>
              Lewati
            </button>
            <button 
              onClick={handleSubmit}
              className="py-3 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/30">
              Cek Detail
            </button>
        </div>
      </div>
    </div>
  );
};

export default PhoneModal;
