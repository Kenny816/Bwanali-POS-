import React,{useRef,useEffect,useState} from 'react';
import {BrowserMultiFormatReader} from '@zxing/library';
import {X,Camera} from 'lucide-react';
import toast from 'react-hot-toast';
import { useHardware } from '../hooks/useHardware';

export default function BarcodeScanner({onScan,onClose}) {
  const videoRef = useRef(null);
  const [manual,setManual] = useState('');
  const { scanner } = useHardware();

  useEffect(() => {
    if (scanner === 'camera') {
      const reader = new BrowserMultiFormatReader();
      reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
        if (result) {
          onScan(result.getText());
          reader.reset();
        }
        if (err && err.message?.includes('NotFound')) {
          toast.error('Camera not found. Try manual entry.');
        }
      });
      return () => reader.reset();
    }
  }, [scanner, onScan]);

  const handleManual = e => {
    e.preventDefault();
    if (manual.trim()) {
      onScan(manual.trim());
      setManual('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full overflow-hidden">
        <div className="p-4 border-b flex justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <Camera size={18}/> Scan Barcode 
            {scanner === 'usb' && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">USB</span>}
          </h3>
          <button onClick={onClose}><X/></button>
        </div>
        {scanner === 'camera' ? (
          <video ref={videoRef} className="w-full h-64 object-cover bg-black"/>
        ) : (
          <div className="p-6 text-center text-gray-600">
            <p>Waiting for USB scanner input...</p>
            <p className="text-xs mt-2">Or enter manually below</p>
          </div>
        )}
        <div className="p-4 border-t bg-gray-50">
          <form onSubmit={handleManual} className="flex gap-2">
            <input
              type="text"
              placeholder="Enter barcode manually"
              value={manual}
              onChange={e=>setManual(e.target.value)}
              className="flex-1 p-2 border rounded"
              autoFocus
            />
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Add</button>
          </form>
        </div>
      </div>
    </div>
  );
}
