import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X, Check, RotateCcw, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FaceCaptureProps {
  onCapture: (imageUrl: string, source: 'camera' | 'gallery') => void;
  onCancel: () => void;
}

export const FaceCapture: React.FC<FaceCaptureProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [faceDetected, setFaceDetected] = useState(false);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setStream(mediaStream);
      setMode('camera');
      
      // Simulate face detection (in production, use face-api.js or similar)
      setTimeout(() => setFaceDetected(true), 1500);
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const flipCamera = async () => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(startCamera, 100);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Flip horizontally for selfie camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageUrl);
    stopCamera();
    setMode('preview');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setCapturedImage(imageUrl);
      setMode('preview');
    };
    reader.readAsDataURL(file);
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage, mode === 'camera' ? 'camera' : 'gallery');
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setMode('select');
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-5 h-5" />
        </Button>
        <h2 className="text-lg font-semibold">Capture Your Face</h2>
        <div className="w-10" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {mode === 'select' && (
          <div className="flex flex-col gap-6 items-center">
            <div className="w-48 h-48 rounded-full bg-muted flex items-center justify-center">
              <Camera className="w-20 h-20 text-muted-foreground" />
            </div>
            
            <p className="text-center text-muted-foreground max-w-xs">
              Take a photo or choose one from your gallery to create your personalized iMojis
            </p>
            
            <div className="flex gap-4">
              <Button onClick={startCamera} size="lg" className="gap-2">
                <Camera className="w-5 h-5" />
                Take Photo
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-5 h-5" />
                Upload
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {mode === 'camera' && (
          <div className="relative w-full max-w-md aspect-[3/4]">
            <video
              ref={videoRef}
              className={cn(
                "w-full h-full object-cover rounded-2xl",
                facingMode === 'user' && "scale-x-[-1]"
              )}
              playsInline
              muted
            />
            
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div 
                className={cn(
                  "w-64 h-80 rounded-[50%] border-4 transition-colors duration-300",
                  faceDetected ? "border-green-500" : "border-white/50"
                )}
              />
            </div>
            
            {/* Face detection indicator */}
            <div className={cn(
              "absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              faceDetected 
                ? "bg-green-500/20 text-green-400" 
                : "bg-yellow-500/20 text-yellow-400"
            )}>
              {faceDetected ? '✓ Face detected' : 'Position your face in the oval'}
            </div>
            
            {/* Camera controls */}
            <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-4">
              <Button variant="outline" size="icon" onClick={flipCamera}>
                <RotateCcw className="w-5 h-5" />
              </Button>
              
              <button
                onClick={capturePhoto}
                disabled={!faceDetected}
                className={cn(
                  "w-16 h-16 rounded-full border-4 transition-all",
                  faceDetected 
                    ? "border-white bg-white/20 hover:bg-white/30" 
                    : "border-white/30 bg-white/10 cursor-not-allowed"
                )}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-white" />
              </button>
              
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => { stopCamera(); setMode('select'); }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {mode === 'preview' && capturedImage && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative w-64 h-80 rounded-2xl overflow-hidden">
              <img
                src={capturedImage}
                alt="Captured face"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-4 border-green-500/50 rounded-2xl" />
            </div>
            
            <p className="text-center text-muted-foreground">
              Looking good! This will be used to generate your iMojis.
            </p>
            
            <div className="flex gap-4">
              <Button variant="outline" onClick={retake} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Retake
              </Button>
              <Button onClick={confirmCapture} className="gap-2">
                <Check className="w-4 h-4" />
                Use This Photo
              </Button>
            </div>
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
