
import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface CameraProps {
  onCapture: (base64: string) => void;
  buttonLabel?: string;
  isProcessing?: boolean;
  isMirrorMode?: boolean;
  showButton?: boolean;
}

export interface CameraHandle {
  takePhoto: () => void;
}

const Camera = forwardRef<CameraHandle, CameraProps>(({ 
  onCapture, 
  buttonLabel = "Capture", 
  isProcessing = false,
  isMirrorMode = false,
  showButton = true
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  useImperativeHandle(ref, () => ({
    takePhoto: () => {
      triggerCapture();
    }
  }));

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'user', 
            width: { ideal: 1024 }, 
            height: { ideal: 1024 } 
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError("Please enable camera access to use the Everyday Mirror.");
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const triggerCapture = () => {
    if (videoRef.current && canvasRef.current && !isProcessing) {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);

      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      const DIM = 1024; // High resolution for makeup detail
      canvas.width = DIM;
      canvas.height = DIM;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const sourceSize = Math.min(video.videoWidth, video.videoHeight);
        const sourceX = (video.videoWidth - sourceSize) / 2;
        const sourceY = (video.videoHeight - sourceSize) / 2;

        ctx.save();
        ctx.translate(DIM, 0);
        ctx.scale(-1, 1);
        
        ctx.drawImage(
          video, 
          sourceX, sourceY, sourceSize, sourceSize,
          0, 0, DIM, DIM
        );
        ctx.restore();
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(dataUrl);
      }
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-amber-200 p-8 text-center z-[100]">
        <p className="serif text-3xl italic mb-6">{error}</p>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 z-0 overflow-hidden ${isMirrorMode ? '' : 'bg-black'}`}>
      <div className="w-full h-full relative vanity-frame">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Vanity Bulbs Aesthetic Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 opacity-40">
           <div className="flex justify-around w-full">
             {[...Array(6)].map((_, i) => <div key={i} className="vanity-bulb"></div>)}
           </div>
           <div className="flex justify-around w-full">
             {[...Array(6)].map((_, i) => <div key={i} className="vanity-bulb"></div>)}
           </div>
        </div>

        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] pointer-events-none"></div>

        {flash && (
          <div className="absolute inset-0 bg-white/80 z-[300] animate-pulse"></div>
        )}

        <div className={`absolute bottom-12 left-0 right-0 flex justify-center z-[200] pointer-events-none transition-all duration-700 ${showButton ? 'opacity-100 scale-100' : 'opacity-0 scale-90 translate-y-20'}`}>
          <div className="flex flex-col items-center space-y-4">
            <button 
              onClick={(e) => { e.stopPropagation(); triggerCapture(); }}
              disabled={isProcessing || !showButton}
              className={`pointer-events-auto group relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${isProcessing ? 'cursor-not-allowed' : 'hover:scale-110 active:scale-90'}`}
            >
              <div className={`absolute inset-0 rounded-full border-4 border-white transition-all ${isProcessing ? 'border-amber-500/40' : 'group-hover:border-amber-500 opacity-60'}`}></div>
              <div className={`w-14 h-14 rounded-full transition-all ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-white/90 group-hover:bg-amber-500'}`}>
                 {isProcessing && (
                   <div className="w-full h-full flex items-center justify-center">
                     <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 )}
              </div>
            </button>
            <span className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-500">
              {buttonLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Camera;
