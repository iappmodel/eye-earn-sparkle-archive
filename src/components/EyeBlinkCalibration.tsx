import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Target, Check, X, Volume2, VolumeX, Loader2, RotateCcw, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

// 9 calibration positions in the specified order (portrait mode)
const CALIBRATION_POSITIONS_PORTRAIT = [
  { x: 0.1, y: 0.1, label: 'Top Left' },
  { x: 0.9, y: 0.1, label: 'Top Right' },
  { x: 0.1, y: 0.5, label: 'Middle Left' },
  { x: 0.9, y: 0.5, label: 'Middle Right' },
  { x: 0.1, y: 0.9, label: 'Bottom Left' },
  { x: 0.9, y: 0.9, label: 'Bottom Right' },
  { x: 0.5, y: 0.1, label: 'Top Middle' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.5, y: 0.9, label: 'Bottom Middle' },
];

// 9 calibration positions for landscape/panorama mode
const CALIBRATION_POSITIONS_LANDSCAPE = [
  { x: 0.08, y: 0.15, label: 'Top Left' },
  { x: 0.92, y: 0.15, label: 'Top Right' },
  { x: 0.08, y: 0.5, label: 'Middle Left' },
  { x: 0.92, y: 0.5, label: 'Middle Right' },
  { x: 0.08, y: 0.85, label: 'Bottom Left' },
  { x: 0.92, y: 0.85, label: 'Bottom Right' },
  { x: 0.5, y: 0.15, label: 'Top Middle' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.5, y: 0.85, label: 'Bottom Middle' },
];

// Blink requirements per position (cycles through 1, 2, 3)
const getBlinkRequirement = (positionIndex: number): number => {
  return (positionIndex % 3) + 1;
};

export interface CalibrationResult {
  positions: Array<{
    position: { x: number; y: number };
    blinkData: {
      requiredBlinks: number;
      actualBlinks: number;
      timing: number[];
    };
  }>;
  landscapePositions?: Array<{
    position: { x: number; y: number };
    blinkData: {
      requiredBlinks: number;
      actualBlinks: number;
      timing: number[];
    };
  }>;
  eyeFrameData: {
    captured: boolean;
    timestamp: number;
  };
  completedAt: number;
}

interface EyeBlinkCalibrationProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: CalibrationResult) => void;
  onSkip?: () => void;
}

type CalibrationStep = 'intro' | 'eye-frame' | 'blink-calibration' | 'rotate-prompt' | 'landscape-calibration' | 'complete';
type OrientationMode = 'portrait' | 'landscape';

export const EyeBlinkCalibration: React.FC<EyeBlinkCalibrationProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
}) => {
  const haptics = useHapticFeedback();
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Eye frame step
  const [eyeFrameMatched, setEyeFrameMatched] = useState(false);
  const [eyeFrameProgress, setEyeFrameProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Orientation mode
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('portrait');
  const [landscapeCalibrationData, setLandscapeCalibrationData] = useState<CalibrationResult['positions']>([]);
  
  // Blink calibration step
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [currentBlinkCount, setCurrentBlinkCount] = useState(0);
  const [isWaitingForBlink, setIsWaitingForBlink] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationResult['positions']>([]);
  const [blinkTimings, setBlinkTimings] = useState<number[]>([]);
  const [targetVisible, setTargetVisible] = useState(false);
  const [instruction, setInstruction] = useState('');
  
  // Get current positions based on orientation
  const CALIBRATION_POSITIONS = orientationMode === 'portrait' 
    ? CALIBRATION_POSITIONS_PORTRAIT 
    : CALIBRATION_POSITIONS_LANDSCAPE;
  
  // Blink detection refs
  const lastBlinkTimeRef = useRef<number>(0);
  const blinkDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const eyeOpennessRef = useRef<number>(1);
  const eyeClosedRef = useRef<boolean>(false);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play sound effect
  const playSound = useCallback((type: 'blink' | 'success' | 'error' | 'target') => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch (type) {
        case 'blink':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.1);
          break;
        case 'success':
          oscillator.frequency.value = 523.25;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'error':
          oscillator.frequency.value = 200;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
          break;
        case 'target':
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
          break;
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  }, [soundEnabled]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      return true;
    } catch (e) {
      console.error('Camera error:', e);
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (blinkDetectionIntervalRef.current) {
      clearInterval(blinkDetectionIntervalRef.current);
      blinkDetectionIntervalRef.current = null;
    }
  }, []);

  // Simple eye detection based on skin tone and darkness patterns
  const detectEyes = useCallback((): { detected: boolean; eyeOpenness: number } => {
    if (!videoRef.current || !canvasRef.current) {
      return { detected: false, eyeOpenness: 1 };
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { detected: false, eyeOpenness: 1 };
    
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Analyze upper portion of frame for face/eyes
    const eyeRegion = ctx.getImageData(
      canvas.width * 0.2, 
      canvas.height * 0.1, 
      canvas.width * 0.6, 
      canvas.height * 0.4
    );
    
    const data = eyeRegion.data;
    let skinPixels = 0;
    let darkPixels = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      
      // Skin detection
      if (r > 60 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
        skinPixels++;
      }
      
      // Dark pixel detection (eyes region)
      if (brightness < 50) {
        darkPixels++;
      }
    }
    
    const totalPixels = data.length / 4;
    const skinRatio = skinPixels / totalPixels;
    const darkRatio = darkPixels / totalPixels;
    
    // Face detected if enough skin pixels
    const detected = skinRatio > 0.15;
    
    // Estimate eye openness (more dark pixels = eyes open, fewer = closed)
    // Normalize between 0.3-0.8 range for typical values
    const eyeOpenness = Math.min(1, Math.max(0, darkRatio * 10));
    
    return { detected, eyeOpenness };
  }, []);

  // Blink detection logic
  const detectBlink = useCallback((): boolean => {
    const { detected, eyeOpenness } = detectEyes();
    
    if (!detected) return false;
    
    const prevOpenness = eyeOpennessRef.current;
    eyeOpennessRef.current = eyeOpenness;
    
    // Detect eye closing
    if (eyeOpenness < 0.2 && !eyeClosedRef.current) {
      eyeClosedRef.current = true;
      return false;
    }
    
    // Detect eye opening (blink complete)
    if (eyeOpenness > 0.4 && eyeClosedRef.current) {
      eyeClosedRef.current = false;
      
      const now = Date.now();
      if (now - lastBlinkTimeRef.current > 200) { // Debounce
        lastBlinkTimeRef.current = now;
        return true;
      }
    }
    
    return false;
  }, [detectEyes]);

  // Eye frame matching step
  useEffect(() => {
    if (step !== 'eye-frame' || !isOpen) return;
    
    const checkEyeFrame = setInterval(() => {
      const { detected } = detectEyes();
      
      if (detected) {
        setEyeFrameProgress(prev => {
          const newProgress = Math.min(100, prev + 5);
          if (newProgress >= 100 && !eyeFrameMatched) {
            setEyeFrameMatched(true);
            playSound('success');
            haptics.success();
            
            setTimeout(() => {
              setStep('blink-calibration');
              setTargetVisible(true);
            }, 1000);
          }
          return newProgress;
        });
      } else {
        setEyeFrameProgress(prev => Math.max(0, prev - 10));
      }
    }, 100);
    
    return () => clearInterval(checkEyeFrame);
  }, [step, isOpen, detectEyes, eyeFrameMatched, haptics, playSound]);

  // Blink calibration step (works for both portrait and landscape)
  useEffect(() => {
    if ((step !== 'blink-calibration' && step !== 'landscape-calibration') || !isOpen || !targetVisible) return;
    
    const requiredBlinks = getBlinkRequirement(currentPositionIndex);
    const position = CALIBRATION_POSITIONS[currentPositionIndex];
    
    setInstruction(`Look at the target and blink ${requiredBlinks} time${requiredBlinks > 1 ? 's' : ''}`);
    setIsWaitingForBlink(true);
    playSound('target');
    
    // Start blink detection
    blinkDetectionIntervalRef.current = setInterval(() => {
      if (detectBlink()) {
        const now = Date.now();
        setBlinkTimings(prev => [...prev, now]);
        setCurrentBlinkCount(prev => {
          const newCount = prev + 1;
          playSound('blink');
          haptics.light();
          
          if (newCount >= requiredBlinks) {
            // Position complete
            setTimeout(() => {
              const positionData = {
                position: { x: position.x, y: position.y },
                blinkData: {
                  requiredBlinks,
                  actualBlinks: newCount,
                  timing: blinkTimings.concat(now),
                },
              };
              
              setCalibrationData(prev => [...prev, positionData]);
              setBlinkTimings([]);
              setCurrentBlinkCount(0);
              
              if (currentPositionIndex < CALIBRATION_POSITIONS.length - 1) {
                // Move to next position
                setTargetVisible(false);
                playSound('success');
                haptics.success();
                
                setTimeout(() => {
                  setCurrentPositionIndex(prev => prev + 1);
                  setTargetVisible(true);
                }, 500);
              } else {
                // Portrait calibration complete - move to landscape prompt
                playSound('success');
                haptics.success();
                if (orientationMode === 'portrait') {
                  setStep('rotate-prompt');
                } else {
                  // Landscape complete - all done
                  setStep('complete');
                }
              }
            }, 300);
          }
          
          return newCount;
        });
      }
    }, 50);
    
    return () => {
      if (blinkDetectionIntervalRef.current) {
        clearInterval(blinkDetectionIntervalRef.current);
        blinkDetectionIntervalRef.current = null;
      }
    };
  }, [step, isOpen, targetVisible, currentPositionIndex, detectBlink, haptics, playSound, blinkTimings]);

  // Initialize camera when opening
  useEffect(() => {
    if (isOpen && step !== 'intro') {
      startCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [isOpen, step, startCamera, stopCamera]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('intro');
      setEyeFrameMatched(false);
      setEyeFrameProgress(0);
      setCurrentPositionIndex(0);
      setCurrentBlinkCount(0);
      setCalibrationData([]);
      setBlinkTimings([]);
      setTargetVisible(false);
      setOrientationMode('portrait');
      setLandscapeCalibrationData([]);
      stopCamera();
    }
  }, [isOpen, stopCamera]);

  // Handle starting landscape calibration
  const handleStartLandscapeCalibration = () => {
    setOrientationMode('landscape');
    setLandscapeCalibrationData(calibrationData);
    setCalibrationData([]);
    setCurrentPositionIndex(0);
    setCurrentBlinkCount(0);
    setBlinkTimings([]);
    setStep('landscape-calibration');
    setTargetVisible(true);
  };

  const handleComplete = () => {
    const result: CalibrationResult = {
      positions: orientationMode === 'landscape' ? landscapeCalibrationData : calibrationData,
      landscapePositions: orientationMode === 'landscape' ? calibrationData : undefined,
      eyeFrameData: {
        captured: eyeFrameMatched,
        timestamp: Date.now(),
      },
      completedAt: Date.now(),
    };
    onComplete(result);
    onClose();
  };

  const handleStartCalibration = async () => {
    const cameraStarted = await startCamera();
    if (cameraStarted) {
      setStep('eye-frame');
    }
  };

  if (!isOpen) return null;

  const currentPosition = CALIBRATION_POSITIONS[currentPositionIndex];
  const requiredBlinks = getBlinkRequirement(currentPositionIndex);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-md max-h-[25vh] overflow-auto rounded-2xl border border-border/50 bg-background/95 backdrop-blur-md shadow-xl"
    >
      {/* Hidden video and canvas for processing */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="hidden"
      />

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </Button>
        
        <div className="text-white text-sm font-medium">
          Eye Calibration
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white hover:bg-white/10"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {/* Intro Step */}
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-8"
            >
              <Eye className="w-12 h-12 text-primary" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Eye Blink Calibration
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              This calibration will teach the app to recognize your eye movements and blinks for hands-free control.
            </p>
            
            <div className="space-y-4 mb-8 text-left">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                <span>Match your eyes to the frame</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                <span>Follow targets and blink as instructed</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                <span>Blink 1, 2, or 3 times at each target</span>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleStartCalibration}
              className="w-full max-w-xs"
            >
              Start Calibration
            </Button>
            
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="mt-4 text-white/50"
              >
                Skip for now
              </Button>
            )}
          </motion.div>
        )}

        {/* Eye Frame Step */}
        {step === 'eye-frame' && (
          <motion.div
            key="eye-frame"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Eye frame guide */}
            <div className="relative w-64 h-32 mb-8">
              {/* Eye frame outline */}
              <svg viewBox="0 0 200 80" className="w-full h-full">
                {/* Left eye */}
                <ellipse
                  cx="55"
                  cy="40"
                  rx="35"
                  ry="25"
                  fill="none"
                  stroke={eyeFrameProgress > 50 ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="2"
                  strokeDasharray={eyeFrameProgress > 50 ? 'none' : '5,5'}
                />
                {/* Right eye */}
                <ellipse
                  cx="145"
                  cy="40"
                  rx="35"
                  ry="25"
                  fill="none"
                  stroke={eyeFrameProgress > 50 ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.5)'}
                  strokeWidth="2"
                  strokeDasharray={eyeFrameProgress > 50 ? 'none' : '5,5'}
                />
                {/* Iris left */}
                <circle
                  cx="55"
                  cy="40"
                  r="10"
                  fill="none"
                  stroke={eyeFrameProgress > 70 ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.3)'}
                  strokeWidth="2"
                />
                {/* Iris right */}
                <circle
                  cx="145"
                  cy="40"
                  r="10"
                  fill="none"
                  stroke={eyeFrameProgress > 70 ? 'hsl(var(--primary))' : 'rgba(255,255,255,0.3)'}
                  strokeWidth="2"
                />
              </svg>
              
              {/* Progress ring */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80">
                <rect
                  x="5"
                  y="5"
                  width="190"
                  height="70"
                  rx="35"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={`${eyeFrameProgress * 5.2} 520`}
                  className="transition-all duration-100"
                />
              </svg>
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">
              {eyeFrameMatched ? 'Eyes Matched!' : 'Align Your Eyes'}
            </h2>
            
            <p className="text-white/70 text-center mb-6">
              {eyeFrameMatched 
                ? 'Great! Moving to blink calibration...' 
                : 'Position your face so your eyes align with the frame above'}
            </p>
            
            {/* Progress bar */}
            <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${eyeFrameProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
            
            {eyeFrameMatched && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-6"
              >
                <Check className="w-12 h-12 text-green-500" />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Blink Calibration Step */}
        {step === 'blink-calibration' && (
          <motion.div
            key="blink-calibration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            {/* Progress indicator */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-1">
              {CALIBRATION_POSITIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i < currentPositionIndex 
                      ? 'bg-green-500' 
                      : i === currentPositionIndex 
                        ? 'bg-primary scale-125' 
                        : 'bg-white/30'
                  )}
                />
              ))}
            </div>

            {/* Target dot */}
            <AnimatePresence>
              {targetVisible && currentPosition && (
                <motion.div
                  key={`target-${currentPositionIndex}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute"
                  style={{
                    left: `${currentPosition.x * 100}%`,
                    top: `${currentPosition.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 w-20 h-20 -m-10 rounded-full border-2 border-primary"
                  />
                  
                  {/* Target circle */}
                  <div className="w-16 h-16 rounded-full bg-primary/30 border-4 border-primary flex items-center justify-center">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  
                  {/* Blink counter */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                    {Array.from({ length: requiredBlinks }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          'w-4 h-4 rounded-full transition-all',
                          i < currentBlinkCount 
                            ? 'bg-green-500' 
                            : 'bg-white/30 border border-white/50'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Instructions */}
            <div className="absolute bottom-32 left-0 right-0 text-center px-8">
              <motion.p
                key={instruction}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white text-lg font-medium"
              >
                {instruction}
              </motion.p>
              
              <p className="text-white/50 mt-2 text-sm">
                Position {currentPositionIndex + 1} of {CALIBRATION_POSITIONS.length} • {currentPosition?.label}
              </p>
            </div>

            {/* Blink indicator */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {Array.from({ length: requiredBlinks }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < currentBlinkCount ? { scale: [1, 1.2, 1] } : {}}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    i < currentBlinkCount 
                      ? 'bg-green-500' 
                      : 'bg-white/10 border border-white/30'
                  )}
                >
                  {i < currentBlinkCount && <Check className="w-4 h-4 text-white" />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rotate Prompt Step - Ask user to rotate to landscape */}
        {step === 'rotate-prompt' && (
          <motion.div
            key="rotate-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ repeat: Infinity, duration: 3, times: [0, 0.3, 0.7, 1] }}
              className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center mb-8"
            >
              <Smartphone className="w-12 h-12 text-primary" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Portrait Mode Complete!
            </h1>
            
            <p className="text-white/70 mb-6 max-w-sm">
              Great job! Now rotate your phone to <span className="text-primary font-bold">landscape mode</span> to calibrate for horizontal viewing.
            </p>
            
            <div className="flex items-center gap-3 text-white/60 mb-8">
              <RotateCcw className="w-5 h-5" />
              <span>Turn your phone sideways</span>
            </div>
            
            <div className="flex gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-white font-medium">Portrait calibration</span>
                <span className="text-white/50 text-sm">9 positions completed</span>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleStartLandscapeCalibration}
              className="w-full max-w-xs"
            >
              Start Landscape Calibration
            </Button>
          </motion.div>
        )}

        {/* Landscape Calibration Step */}
        {step === 'landscape-calibration' && (
          <motion.div
            key="landscape-calibration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            {/* Landscape indicator */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
              <RotateCcw className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-medium">Landscape Mode</span>
            </div>
            
            {/* Progress indicator */}
            <div className="absolute top-28 left-1/2 -translate-x-1/2 flex gap-1">
              {CALIBRATION_POSITIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i < currentPositionIndex 
                      ? 'bg-green-500' 
                      : i === currentPositionIndex 
                        ? 'bg-primary scale-125' 
                        : 'bg-white/30'
                  )}
                />
              ))}
            </div>

            {/* Target dot */}
            <AnimatePresence>
              {targetVisible && CALIBRATION_POSITIONS[currentPositionIndex] && (
                <motion.div
                  key={`landscape-target-${currentPositionIndex}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute"
                  style={{
                    left: `${CALIBRATION_POSITIONS[currentPositionIndex].x * 100}%`,
                    top: `${CALIBRATION_POSITIONS[currentPositionIndex].y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 w-20 h-20 -m-10 rounded-full border-2 border-primary"
                  />
                  
                  {/* Target circle */}
                  <div className="w-16 h-16 rounded-full bg-primary/30 border-4 border-primary flex items-center justify-center">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  
                  {/* Blink counter */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                    {Array.from({ length: requiredBlinks }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          'w-4 h-4 rounded-full transition-all',
                          i < currentBlinkCount 
                            ? 'bg-green-500' 
                            : 'bg-white/30 border border-white/50'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Instructions */}
            <div className="absolute bottom-32 left-0 right-0 text-center px-8">
              <motion.p
                key={`landscape-${instruction}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-white text-lg font-medium"
              >
                {instruction}
              </motion.p>
              
              <p className="text-white/50 mt-2 text-sm">
                Position {currentPositionIndex + 1} of {CALIBRATION_POSITIONS.length} • {CALIBRATION_POSITIONS[currentPositionIndex]?.label}
              </p>
            </div>

            {/* Blink indicator */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {Array.from({ length: requiredBlinks }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < currentBlinkCount ? { scale: [1, 1.2, 1] } : {}}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    i < currentBlinkCount 
                      ? 'bg-green-500' 
                      : 'bg-white/10 border border-white/30'
                  )}
                >
                  {i < currentBlinkCount && <Check className="w-4 h-4 text-white" />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-8"
            >
              <Check className="w-12 h-12 text-green-500" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Calibration Complete!
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              Your eye tracking and blink detection has been calibrated for both portrait and landscape modes.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="text-xs text-white/50">Portrait</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {landscapeCalibrationData.length || calibrationData.length}
                </div>
                <div className="text-xs text-white/50">Positions</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-amber-500 rotate-90" />
                  <span className="text-xs text-white/50">Landscape</span>
                </div>
                <div className="text-2xl font-bold text-amber-500">
                  {orientationMode === 'landscape' ? calibrationData.length : 0}
                </div>
                <div className="text-xs text-white/50">Positions</div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-8">
              <div className="text-2xl font-bold text-green-500">18</div>
              <div className="text-xs text-white/50">Total Calibration Points</div>
            </div>
            
            <Button
              size="lg"
              onClick={handleComplete}
              className="w-full max-w-xs"
            >
              Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EyeBlinkCalibration;
