import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Camera, Check, X, User, RotateCcw, AlertCircle, 
  Volume2, Smartphone, Move, ArrowRight, ArrowDown, AlertTriangle
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { Progress } from '@/components/ui/progress';
import { shouldDisableHeavyComponents } from '@/lib/crashGuard';

export interface BodyScanResult {
  poses: {
    name: string;
    captured: boolean;
    timestamp: number;
  }[];
  completedAt: string;
  scanQuality: number;
}

interface BodyScanningProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: BodyScanResult) => void;
  onSkip?: () => void;
}

interface ScanPose {
  id: string;
  name: string;
  instruction: string;
  voiceMessage: string;
  icon: React.ReactNode;
}

const SCAN_POSES: ScanPose[] = [
  {
    id: 'front_arms_up',
    name: 'Front - Arms Up',
    instruction: 'Face the camera and lift both of your arms',
    voiceMessage: 'Face the camera and lift both of your arms up',
    icon: <User className="w-8 h-8" />
  },
  {
    id: 'right_side',
    name: 'Right Side',
    instruction: 'Turn to the right with your arms open',
    voiceMessage: 'Turn to the right with your arms open',
    icon: <ArrowRight className="w-8 h-8" />
  },
  {
    id: 'back',
    name: 'Back View',
    instruction: 'Turn 180 degrees from the camera, keep arms open',
    voiceMessage: 'Turn 180 degrees from the camera, keep your arms open',
    icon: <RotateCcw className="w-8 h-8" />
  },
  {
    id: 'left_side',
    name: 'Left Side (75%)',
    instruction: 'Turn one more time to the left at 75%, keep arms lifted',
    voiceMessage: 'Turn one more time to the left at 75% of the full circle, keep your arms lifted',
    icon: <RotateCcw className="w-8 h-8 scale-x-[-1]" />
  },
  {
    id: 'front_arms_down',
    name: 'Front - Arms Down',
    instruction: 'Look at the camera and lower your arms',
    voiceMessage: 'Last one, look at the camera and lower your arms',
    icon: <ArrowDown className="w-8 h-8" />
  }
];

const HOLD_DURATION = 3000; // 3 seconds to capture each pose

type ScanStep = 'intro' | 'setup' | 'positioning' | 'scanning' | 'complete';

export const BodyScanning: React.FC<BodyScanningProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState<ScanStep>('intro');
  const [currentPoseIndex, setCurrentPoseIndex] = useState(0);
  const [isInFrame, setIsInFrame] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [capturedPoses, setCapturedPoses] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [frameStatus, setFrameStatus] = useState<'searching' | 'found' | 'lost'>('searching');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const { light, medium, success, error } = useHapticFeedback();

  const currentPose = SCAN_POSES[currentPoseIndex];

  // Initialize audio context
  useEffect(() => {
    if (isOpen && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isOpen]);

  // Play error sound
  const playErrorSound = useCallback(() => {
    if (!audioContextRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = 200;
    oscillator.type = 'square';
    
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.3);
  }, []);

  // Play success sound
  const playSuccessSound = useCallback(() => {
    if (!audioContextRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = 880;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.2);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + 0.2);
    
    setTimeout(() => {
      if (!audioContextRef.current) return;
      const osc2 = audioContextRef.current.createOscillator();
      const gain2 = audioContextRef.current.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContextRef.current.destination);
      osc2.frequency.value = 1100;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.2);
      osc2.start(audioContextRef.current.currentTime);
      osc2.stop(audioContextRef.current.currentTime + 0.2);
    }, 150);
  }, []);

  // Speak voice message
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera access error:', err);
      error();
    }
  }, [error]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    window.speechSynthesis.cancel();
  }, []);

  // Detect if person is in frame (simplified detection using skin tone)
  const detectPersonInFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return false;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Define frame zone (center 60% of the image)
    const frameLeft = canvas.width * 0.2;
    const frameRight = canvas.width * 0.8;
    const frameTop = canvas.height * 0.1;
    const frameBottom = canvas.height * 0.9;
    
    let skinPixelsInFrame = 0;
    let totalPixelsInFrame = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const inFrame = x >= frameLeft && x <= frameRight && y >= frameTop && y <= frameBottom;
        
        if (inFrame) {
          totalPixelsInFrame++;
          const i = (y * canvas.width + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Skin tone detection
          if (r > 60 && g > 40 && b > 20 && 
              r > g && r > b && 
              Math.abs(r - g) > 15 &&
              r - g < 100) {
            skinPixelsInFrame++;
          }
        }
      }
    }
    
    const skinPercentage = skinPixelsInFrame / totalPixelsInFrame;
    return skinPercentage > 0.05; // At least 5% skin tone detected in frame
  }, []);

  // Start frame detection
  const startFrameDetection = useCallback(() => {
    detectionIntervalRef.current = setInterval(() => {
      const detected = detectPersonInFrame();
      
      if (detected && !isInFrame) {
        setIsInFrame(true);
        setFrameStatus('found');
        light();
      } else if (!detected && isInFrame) {
        setIsInFrame(false);
        setFrameStatus('lost');
        playErrorSound();
        error();
        // Cancel hold if in progress
        if (isHolding) {
          cancelHold();
        }
      }
    }, 200);
  }, [detectPersonInFrame, isInFrame, isHolding, light, playErrorSound, error]);

  // Cancel hold timer
  const cancelHold = useCallback(() => {
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

  // Start hold timer for pose capture
  const startHold = useCallback(() => {
    if (isHolding || !isInFrame) return;
    
    setIsHolding(true);
    setHoldProgress(0);
    
    const startTime = Date.now();
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(progressIntervalRef.current!);
        captureCurrentPose();
      }
    }, 50);
  }, [isHolding, isInFrame]);

  // Capture current pose
  const captureCurrentPose = useCallback(() => {
    cancelHold();
    setShowSuccess(true);
    playSuccessSound();
    success();
    
    setCapturedPoses(prev => [...prev, currentPose.id]);
    
    setTimeout(() => {
      setShowSuccess(false);
      
      if (currentPoseIndex < SCAN_POSES.length - 1) {
        setCurrentPoseIndex(prev => prev + 1);
        // Speak next instruction after a brief pause
        setTimeout(() => {
          speak(SCAN_POSES[currentPoseIndex + 1].voiceMessage);
        }, 500);
      } else {
        setStep('complete');
        speak('Ready! Your body scan is completed!');
      }
    }, 1500);
  }, [cancelHold, currentPose, currentPoseIndex, playSuccessSound, success, speak]);

  // Auto-start hold when in frame during scanning
  useEffect(() => {
    if (step === 'scanning' && isInFrame && !isHolding && !showSuccess) {
      const timer = setTimeout(() => {
        startHold();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!isInFrame && isHolding) {
      cancelHold();
    }
  }, [step, isInFrame, isHolding, showSuccess, startHold, cancelHold]);

  // Start positioning phase
  const startPositioning = useCallback(() => {
    setStep('positioning');
    speak('Place your phone at chest level facing you. Then walk away and position yourself in the frame shown on screen.');
    startCamera();
  }, [speak, startCamera]);

  // Start scanning phase
  const startScanning = useCallback(() => {
    setStep('scanning');
    setCurrentPoseIndex(0);
    setCapturedPoses([]);
    startFrameDetection();
    
    setTimeout(() => {
      speak(SCAN_POSES[0].voiceMessage);
    }, 1000);
  }, [speak, startFrameDetection]);

  // Handle complete
  const handleComplete = useCallback(() => {
    stopCamera();
    
    const result: BodyScanResult = {
      poses: SCAN_POSES.map(pose => ({
        name: pose.name,
        captured: capturedPoses.includes(pose.id),
        timestamp: Date.now()
      })),
      completedAt: new Date().toISOString(),
      scanQuality: (capturedPoses.length / SCAN_POSES.length) * 100
    };
    
    onComplete(result);
  }, [stopCamera, capturedPoses, onComplete]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopCamera();
      cancelHold();
    };
  }, [stopCamera, cancelHold]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setCurrentPoseIndex(0);
      setCapturedPoses([]);
      setIsInFrame(false);
      setHoldProgress(0);
      setIsHolding(false);
      setShowSuccess(false);
      setFrameStatus('searching');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Crash guard: show safe-mode fallback
  if (shouldDisableHeavyComponents()) {
    return (
      <div className="fixed bottom-4 right-4 z-[200] w-80 max-h-[25vh] bg-card border border-border rounded-2xl shadow-xl p-4 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold text-sm">Body Scan Paused</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Body scanning is temporarily disabled to stabilize the app.
        </p>
        <Button variant="outline" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    );
  }

  // Frame overlay component
  const FrameOverlay = () => (
    <div className="absolute inset-0 pointer-events-none">
      {/* Frame border */}
      <div 
        className={`absolute transition-colors duration-300 ${
          isInFrame ? 'border-green-500' : frameStatus === 'lost' ? 'border-red-500' : 'border-primary/50'
        }`}
        style={{
          left: '15%',
          right: '15%',
          top: '5%',
          bottom: '5%',
          borderWidth: '4px',
          borderStyle: 'dashed',
          borderRadius: '1rem'
        }}
      />
      
      {/* Corner markers */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((corner) => (
        <div
          key={corner}
          className={`absolute w-8 h-8 border-4 transition-colors duration-300 ${
            isInFrame ? 'border-green-500' : frameStatus === 'lost' ? 'border-red-500' : 'border-primary'
          }`}
          style={{
            [corner.includes('top') ? 'top' : 'bottom']: '5%',
            [corner.includes('left') ? 'left' : 'right']: '15%',
            borderTopWidth: corner.includes('top') ? '4px' : '0',
            borderBottomWidth: corner.includes('bottom') ? '4px' : '0',
            borderLeftWidth: corner.includes('left') ? '4px' : '0',
            borderRightWidth: corner.includes('right') ? '4px' : '0',
            borderRadius: '4px'
          }}
        />
      ))}
      
      {/* Status indicator */}
      <div className={`absolute top-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
        isInFrame 
          ? 'bg-green-500/90 text-white' 
          : frameStatus === 'lost'
          ? 'bg-red-500/90 text-white animate-pulse'
          : 'bg-background/80 text-foreground'
      }`}>
        {isInFrame ? '✓ In Position' : frameStatus === 'lost' ? '⚠ Step back into frame' : 'Position yourself in the frame'}
      </div>
    </div>
  );

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <User className="w-10 h-10 text-primary" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Body Scanning
              </h2>
              <p className="text-muted-foreground">
                Create a 3D model for virtual try-ons, emojis, and studio features
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">What you'll do:</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <Smartphone className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Place your phone at chest level, facing you</span>
                </li>
                <li className="flex items-start gap-2">
                  <Move className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Walk away and stand in the frame</span>
                </li>
                <li className="flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Follow voice instructions for 5 poses</span>
                </li>
                <li className="flex items-start gap-2">
                  <Volume2 className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Voice guidance will help you throughout</span>
                </li>
              </ul>
            </div>
            
            <div className="text-sm text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 inline-block mr-2 text-amber-500" />
              Make sure you have enough space to turn around
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={onSkip || onClose} className="flex-1">
                Skip
              </Button>
              <Button onClick={startPositioning} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Start Scan
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'positioning') {
    return (
      <div className="fixed inset-0 z-[200] bg-black flex flex-col">
        {/* Camera view */}
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          <FrameOverlay />
          
          {/* Instructions */}
          <div className="absolute bottom-8 left-4 right-4">
            <Card className="p-4 bg-background/90 backdrop-blur-sm">
              <div className="text-center space-y-3">
                <p className="text-foreground font-medium">
                  Position yourself in the frame
                </p>
                <p className="text-sm text-muted-foreground">
                  Stand back until your full body fits in the frame. The border will turn green when you're ready.
                </p>
                <Button 
                  onClick={startScanning}
                  disabled={!isInFrame}
                  className="w-full"
                >
                  {isInFrame ? 'Start Scanning' : 'Get in Position First'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
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
                Body Scan Complete!
              </h2>
              <p className="text-muted-foreground">
                All {SCAN_POSES.length} poses have been captured
              </p>
            </div>
            
            <div className="space-y-2">
              {SCAN_POSES.map((pose, index) => (
                <div 
                  key={pose.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    capturedPoses.includes(pose.id) ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {capturedPoses.includes(pose.id) ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-foreground">{pose.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground">
              Your body model is now ready for virtual try-ons and emojis!
            </div>
            
            <Button onClick={handleComplete} className="w-full">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Scanning step
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      {/* Camera view */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <FrameOverlay />
        
        {/* Success overlay */}
        {showSuccess && (
          <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center animate-in fade-in">
            <div className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="w-12 h-12 text-white" />
            </div>
          </div>
        )}
        
        {/* Progress indicator */}
        <div className="absolute top-4 left-4 right-4">
          <div className="flex justify-center gap-2 mb-2">
            {SCAN_POSES.map((pose, index) => (
              <div
                key={pose.id}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index < currentPoseIndex
                    ? 'bg-green-500'
                    : index === currentPoseIndex
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="text-center text-white text-sm">
            {currentPoseIndex + 1} / {SCAN_POSES.length}
          </div>
        </div>
      </div>
      
      {/* Pose instructions */}
      <div className="bg-background/95 backdrop-blur-sm p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            {currentPose.icon}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground">{currentPose.name}</h3>
            <p className="text-sm text-muted-foreground">{currentPose.instruction}</p>
          </div>
        </div>
        
        {/* Hold progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{isHolding ? 'Hold still...' : isInFrame ? 'Get ready...' : 'Step into frame'}</span>
            <span>{Math.round(holdProgress)}%</span>
          </div>
          <Progress value={holdProgress} className="h-2" />
        </div>
        
        {/* Skip button */}
        <Button 
          variant="ghost" 
          onClick={onSkip || onClose}
          className="w-full text-muted-foreground"
        >
          Cancel Scan
        </Button>
      </div>
    </div>
  );
};

export default BodyScanning;
