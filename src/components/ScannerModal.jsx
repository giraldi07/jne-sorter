
import React, { useEffect } from 'react';
import { X, ScanBarcode } from 'lucide-react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Komponen internal untuk merender pembaca QR code.
const ScannerContainer = ({ onScanSuccess }) => {
    useEffect(() => {
        // Inisialisasi scanner ketika komponen dimuat
        const scanner = new Html5QrcodeScanner(
            "reader", // ID elemen div
            { 
                fps: 15,
                qrbox: { width: 280, height: 160 },
                formatsToSupport: [ 
                    Html5QrcodeSupportedFormats.CODE_128, 
                    Html5QrcodeSupportedFormats.CODE_39 
                ]
            },
            false // verbose = false
        );

        // Render scanner dan tentukan callback
        scanner.render(onScanSuccess, (error) => {
            // Error callback bisa diabaikan agar tidak mengganggu
        });

        // Fungsi cleanup: Hentikan scanner saat komponen di-unmount
        return () => {
            // Cek status scanner untuk menghindari error saat membersihkan
            if (scanner && scanner.getState() !== 1) { // 1 = NOT_STARTED
                 scanner.clear().catch(error => console.error("Scanner clear failed", error));
            }
        }
    }, [onScanSuccess]); // Dependensi agar useEffect tidak berjalan ulang tanpa perlu

    return <div id="reader" className="w-full bg-black"></div>;
};


// Komponen utama modal pemindai
const ScannerModal = ({ isVisible, onClose, onScanSuccess }) => {
  if (!isVisible) return null; // Jangan render apapun jika tidak terlihat

  return (
    <div className="fixed inset-0 z-[100] bg-black p-4 flex flex-col animate-in fade-in duration-200">
        <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-white font-black flex items-center gap-2">
                <ScanBarcode size={20} /> SCANNER ACTIVE
            </h2>
            <button onClick={onClose} className="bg-white/10 p-2 rounded-full text-white">
                <X />
            </button>
        </div>
        <div className="flex-1 rounded-3xl overflow-hidden border-2 border-white/20">
            {/* Melewatkan callback onScanSuccess ke container scanner */}
            <ScannerContainer onScanSuccess={onScanSuccess} />
        </div>
    </div>
  );
};

export default ScannerModal;
