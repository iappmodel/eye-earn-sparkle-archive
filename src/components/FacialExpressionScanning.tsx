import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Camera, Check, X, Smile, Heart, Frown, AlertCircle, PartyPopper } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface FacialExpressionResult {
  expressions: {
    type: string;
    captured: boolean;
    timestamp: number;
  }[];
  completedAt: string;
}

interface FacialExpressionScanningProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: FacialExpressionResult) => void;
  onSkip?: () => void;
}

interface Expression {
  id: string;
  name: string;
  instruction: string;
  icon: React.ReactNode;
  description: string;
}

const EXPRESSIONS: Expression[] = [
  {
    id: 'kiss',
    name: 'Kiss Face',
    instruction: 'Pucker your lips like you\'re sending a kiss',
    icon: <Heart className="w-8 h-8" />,
    description: 'Used for reactions and emoji creation'
  },
  {
    id: 'happy',
    name: 'Happy',
    instruction: 'Show a big, genuine happy expression',
    icon: <Smile className="w-8 h-8" />,
    description: 'Express joy and excitement'
  },
  {
    id: 'sad',
    name: 'Sad',
    instruction: 'Show a sad, downcast expression',
    icon: <Frown className="w-8 h-8" />,
    description: 'Express empathy and emotion'
  },
  {
    id: 'surprised',
    name: 'Surprised',
    instruction: 'Open your eyes wide and show surprise',
    icon: <AlertCircle className="w-8 h-8" />,
    description: 'React to unexpected moments'
  },
  {
    id: 'smiling',
    name: 'Smiling',
    instruction: 'Give a warm, natural smile',
    icon: <PartyPopper className="w-8 h-8" />,
    description: 'Your everyday friendly expression'
  }
];

const HOLD_DURATION = 3000; // 3 seconds

type ScanStep = 'intro' | 'scanning' | 'complete';

export const FacialExpressionScanning: React.FC<FacialExpressionScanningProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState<ScanStep>('intro');
  const [currentExpressionIndex, setCurrentExpressionIndex] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [capturedExpressions, setCapturedExpressions] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { medium, success, error } = useHapticFeedback();

  const currentExpression = EXPRESSIONS[currentExpressionIndex];

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        
        // Start face detection
        detectionIntervalRef.current = setInterval(() => {
          detectFace();
        }, 200);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      error();
    }
  }, [error]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    setCameraActive(false);
  }, []);

  const detectFace = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || video.readyState !== 4) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Simple skin tone detection for face presence
    let skinPixels = 0;
    const totalPixels = data.length / 4;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.3;
    
    for (let y = 0; y < canvas.height; y += 4) {
      for (let x = 0; x < canvas.width; x += 4) {
        const dx = x - centerX;
        const dy = y - centerY;
        if (dx * dx + dy * dy > radius * radius) continue;
        
        const i = (y * canvas.width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        if (r > 95 && g > 40 && b > 20 &&
            r > g && r > b &&
            Math.abs(r - g) > 15 &&
            r - g > 15 && r - b > 15) {
          skinPixels++;
        }
      }
    }
    
    const skinRatio = skinPixels / (totalPixels / 16);
    setFaceDetected(skinRatio > 0.15);
  }, []);

  const startHoldTimer = useCallback(() => {
    if (!faceDetected) return;
    
    setIsHolding(true);
    setHoldProgress(0);
    medium();
    
    const startTime = Date.now();
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
      
      if (progress >= 100) {
        completeExpression();
      }
    }, 50);
    
    holdTimerRef.current = setTimeout(() => {
      completeExpression();
    }, HOLD_DURATION);
  }, [faceDetected, medium]);

  const cancelHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsHolding(false);
    setHoldProgress(0);
  }, []);

  const completeExpression = useCallback(() => {
    cancelHoldTimer();
    success();
    
    // Play success sound
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialDecayTo?.(0.01, audioContext.currentTime + 0.3) ||
        gainNode.gain.setValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Audio not available');
    }
    
    setCapturedExpressions(prev => [...prev, currentExpression.id]);
    setShowValidation(true);
    
    setTimeout(() => {
      setShowValidation(false);
      
      if (currentExpressionIndex < EXPRESSIONS.length - 1) {
        setCurrentExpressionIndex(prev => prev + 1);
      } else {
        setStep('complete');
      }
    }, 1000);
  }, [cancelHoldTimer, success, currentExpression, currentExpressionIndex]);

  const handleComplete = useCallback(() => {
    stopCamera();
    
    const result: FacialExpressionResult = {
      expressions: EXPRESSIONS.map(exp => ({
        type: exp.id,
        captured: capturedExpressions.includes(exp.id),
        timestamp: Date.now()
      })),
      completedAt: new Date().toISOString()
    };
    
    onComplete(result);
  }, [stopCamera, capturedExpressions, onComplete]);

  useEffect(() => {
    if (step === 'scanning' && !cameraActive) {
      startCamera();
    }
    
    return () => {
      cancelHoldTimer();
      stopCamera();
    };
  }, [step, cameraActive, startCamera, stopCamera, cancelHoldTimer]);

  // Auto-start hold when face is detected during scanning
  useEffect(() => {
    if (step === 'scanning' && faceDetected && !isHolding && !showValidation) {
      const timer = setTimeout(() => {
        startHoldTimer();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!faceDetected && isHolding) {
      cancelHoldTimer();
    }
  }, [step, faceDetected, isHolding, showValidation, startHoldTimer, cancelHoldTimer]);

  if (!isOpen) return null;

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <Smile className="w-10 h-10 text-primary" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Facial Expression Scanning
            </h2>
            <p className="text-muted-foreground">
              We'll scan your facial expressions to create personalized emojis and reactions
            </p>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
            <h3 className="font-semibold text-foreground">Expressions to capture:</h3>
            <div className="grid grid-cols-2 gap-2">
              {EXPRESSIONS.map((exp) => (
                <div key={exp.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  {exp.icon}
                  <span>{exp.name}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>Hold each expression for <span className="text-primary font-semibold">3 seconds</span></p>
            <p>A green dot will appear when captured</p>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onSkip || onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={() => setStep('scanning')} className="flex-1">
              <Camera className="w-4 h-4 mr-2" />
              Start Scanning
            </Button>
          </div>
        </div>
        </Card>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Scanning Complete!
              </h2>
              <p className="text-muted-foreground">
                All {EXPRESSIONS.length} expressions have been captured
              </p>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {EXPRESSIONS.map((exp) => (
                <div 
                  key={exp.id}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg bg-green-500/10"
                >
                  <div className="text-green-500">{exp.icon}</div>
                  <span className="text-xs text-muted-foreground">{exp.name}</span>
                  <Check className="w-3 h-3 text-green-500" />
                </div>
              ))}
            </div>
            
            <Button onClick={handleComplete} className="w-full">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="p-4 w-full max-w-md border-primary/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentExpression.icon}
            <span className="font-semibold text-foreground">{currentExpression.name}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {currentExpressionIndex + 1} / {EXPRESSIONS.length}
          </span>
        </div>
        
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {EXPRESSIONS.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index < currentExpressionIndex
                  ? 'bg-green-500'
                  : index === currentExpressionIndex
                  ? 'bg-primary'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
        
        {/* Camera view */}
        <div className="relative aspect-[3/4] bg-black rounded-xl overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover mirror"
            style={{ transform: 'scaleX(-1)' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Face frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className={`w-48 h-64 border-4 rounded-[40%] transition-colors duration-300 ${
                faceDetected 
                  ? isHolding 
                    ? 'border-primary animate-pulse' 
                    : 'border-green-500'
                  : 'border-muted-foreground/50'
              }`}
            />
          </div>
          
          {/* Validation dot */}
          {showValidation && (
            <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center animate-scale-in">
              <Check className="w-5 h-5 text-white" />
            </div>
          )}
          
          {/* Hold progress ring */}
          {isHolding && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-56 h-72 -rotate-90">
                <ellipse
                  cx="112"
                  cy="144"
                  rx="96"
                  ry="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-primary/30"
                />
                <ellipse
                  cx="112"
                  cy="144"
                  rx="96"
                  ry="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={`${holdProgress * 7.03} 703`}
                  className="text-primary transition-all"
                />
              </svg>
            </div>
          )}
          
          {/* Status text */}
          <div className="absolute bottom-4 left-4 right-4 text-center">
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              !faceDetected
                ? 'bg-yellow-500/80 text-yellow-950'
                : isHolding
                ? 'bg-primary/80 text-primary-foreground'
                : 'bg-green-500/80 text-green-950'
            }`}>
              {!faceDetected
                ? 'Position your face in the frame'
                : isHolding
                ? `Hold for ${Math.ceil((100 - holdProgress) / 33.3)}s...`
                : 'Face detected - Make the expression!'}
            </div>
          </div>
        </div>
        
        {/* Instruction */}
        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-foreground">
            {currentExpression.instruction}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentExpression.description}
          </p>
        </div>
        
        {/* Hold progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Hold Progress</span>
            <span>{Math.round(holdProgress)}%</span>
          </div>
          <Progress value={holdProgress} className="h-2" />
        </div>
        
        {/* Cancel button */}
        <Button variant="outline" onClick={onSkip || onClose} className="w-full">
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
      </div>
      </Card>
    </div>
  );
};

export default FacialExpressionScanning;
