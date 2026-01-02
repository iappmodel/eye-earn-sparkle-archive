import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Mic, MicOff, Volume2, Play, Pause, Check, X, ChevronRight, 
  Sparkles, Waves, AlertCircle, RotateCcw, Music
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

export interface VoiceCalibrationResult {
  samplesRecorded: number;
  tonesRecorded: string[];
  commandsRecorded: number;
  completedAt: number;
  voicePrint: {
    sampleUrls: string[];
    toneSamples: Record<string, string>;
  };
}

interface VoiceCalibrationProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: VoiceCalibrationResult) => void;
  onSkip?: () => void;
}

// Phrases for voice sampling
const SAMPLE_PHRASES = [
  { id: 'hello', text: 'Hello, how are you today?', category: 'greeting' },
  { id: 'numbers', text: 'One, two, three, four, five, six, seven, eight, nine, ten', category: 'numbers' },
  { id: 'alphabet', text: 'A, B, C, D, E, F, G, H, I, J, K, L, M', category: 'alphabet' },
  { id: 'pangram', text: 'The quick brown fox jumps over the lazy dog', category: 'pangram' },
  { id: 'vowels', text: 'Ah, Eh, Ee, Oh, Oo', category: 'vowels' },
];

// Emotional tones to record
const VOICE_TONES = [
  { id: 'neutral', name: 'Neutral', emoji: '😐', phrase: 'This is my neutral voice' },
  { id: 'happy', name: 'Happy', emoji: '😊', phrase: 'I am so happy right now!' },
  { id: 'sad', name: 'Sad', emoji: '😢', phrase: 'I feel a bit down today' },
  { id: 'excited', name: 'Excited', emoji: '🤩', phrase: 'This is amazing, I love it!' },
  { id: 'calm', name: 'Calm', emoji: '😌', phrase: 'Everything is peaceful and serene' },
  { id: 'serious', name: 'Serious', emoji: '😐', phrase: 'This is a very important matter' },
  { id: 'playful', name: 'Playful', emoji: '😜', phrase: 'Haha, just kidding around!' },
  { id: 'confident', name: 'Confident', emoji: '😎', phrase: 'I know exactly what I am doing' },
];

// Voice commands to train
const VOICE_COMMANDS = [
  { id: 'next', command: 'Next', description: 'Go to next content' },
  { id: 'back', command: 'Go back', description: 'Return to previous' },
  { id: 'like', command: 'Like this', description: 'Like current content' },
  { id: 'share', command: 'Share', description: 'Open share menu' },
  { id: 'comment', command: 'Add comment', description: 'Open comments' },
  { id: 'pause', command: 'Pause', description: 'Pause playback' },
  { id: 'play', command: 'Play', description: 'Resume playback' },
  { id: 'scroll', command: 'Scroll down', description: 'Scroll content' },
];

type CalibrationPhase = 'intro' | 'phrases' | 'tones' | 'commands' | 'complete';

export const VoiceCalibration: React.FC<VoiceCalibrationProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
}) => {
  const haptics = useHapticFeedback();
  const voiceRecorder = useVoiceRecorder();
  
  const [phase, setPhase] = useState<CalibrationPhase>('intro');
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentToneIndex, setCurrentToneIndex] = useState(0);
  const [currentCommandIndex, setCurrentCommandIndex] = useState(0);
  
  const [recordedPhrases, setRecordedPhrases] = useState<Record<string, Blob>>({});
  const [recordedTones, setRecordedTones] = useState<Record<string, Blob>>({});
  const [recordedCommands, setRecordedCommands] = useState<Record<string, Blob>>({});
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setPhase('intro');
      setCurrentPhraseIndex(0);
      setCurrentToneIndex(0);
      setCurrentCommandIndex(0);
      setRecordedPhrases({});
      setRecordedTones({});
      setRecordedCommands({});
      setError(null);
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playSound = useCallback((type: 'start' | 'stop' | 'success' | 'error') => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const frequencies: Record<string, number> = {
      start: 440,
      stop: 330,
      success: 523,
      error: 200,
    };
    
    osc.frequency.value = frequencies[type];
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      await voiceRecorder.startRecording();
      playSound('start');
      haptics.medium();

      // Setup volume visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const updateVolume = () => {
        if (analyserRef.current && voiceRecorder.isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolumeLevel(average / 255);
          animationFrameRef.current = requestAnimationFrame(updateVolume);
        }
      };
      updateVolume();
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
      playSound('error');
    }
  };

  const stopRecording = async () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setVolumeLevel(0);
    
    const blob = await voiceRecorder.stopRecording();
    playSound('stop');
    haptics.light();
    
    return blob;
  };

  const handleRecordPhrase = async () => {
    if (voiceRecorder.isRecording) {
      const blob = await stopRecording();
      if (blob) {
        const phrase = SAMPLE_PHRASES[currentPhraseIndex];
        setRecordedPhrases(prev => ({ ...prev, [phrase.id]: blob }));
        playSound('success');
        haptics.success();
      }
    } else {
      await startRecording();
    }
  };

  const handleRecordTone = async () => {
    if (voiceRecorder.isRecording) {
      const blob = await stopRecording();
      if (blob) {
        const tone = VOICE_TONES[currentToneIndex];
        setRecordedTones(prev => ({ ...prev, [tone.id]: blob }));
        playSound('success');
        haptics.success();
      }
    } else {
      await startRecording();
    }
  };

  const handleRecordCommand = async () => {
    if (voiceRecorder.isRecording) {
      const blob = await stopRecording();
      if (blob) {
        const command = VOICE_COMMANDS[currentCommandIndex];
        setRecordedCommands(prev => ({ ...prev, [command.id]: blob }));
        playSound('success');
        haptics.success();
      }
    } else {
      await startRecording();
    }
  };

  const playRecording = async (blob: Blob, id: string) => {
    if (isPlaying && playingId === id) {
      setIsPlaying(false);
      setPlayingId(null);
      return;
    }

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    setIsPlaying(true);
    setPlayingId(id);
    
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingId(null);
      URL.revokeObjectURL(url);
    };
    
    await audio.play();
  };

  const nextPhrase = () => {
    if (currentPhraseIndex < SAMPLE_PHRASES.length - 1) {
      setCurrentPhraseIndex(prev => prev + 1);
    } else {
      setPhase('tones');
      setCurrentToneIndex(0);
    }
  };

  const nextTone = () => {
    if (currentToneIndex < VOICE_TONES.length - 1) {
      setCurrentToneIndex(prev => prev + 1);
    } else {
      setPhase('commands');
      setCurrentCommandIndex(0);
    }
  };

  const nextCommand = () => {
    if (currentCommandIndex < VOICE_COMMANDS.length - 1) {
      setCurrentCommandIndex(prev => prev + 1);
    } else {
      setPhase('complete');
    }
  };

  const handleComplete = () => {
    const result: VoiceCalibrationResult = {
      samplesRecorded: Object.keys(recordedPhrases).length,
      tonesRecorded: Object.keys(recordedTones),
      commandsRecorded: Object.keys(recordedCommands).length,
      completedAt: Date.now(),
      voicePrint: {
        sampleUrls: [],
        toneSamples: {},
      },
    };
    
    haptics.success();
    onComplete(result);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentPhrase = SAMPLE_PHRASES[currentPhraseIndex];
  const currentTone = VOICE_TONES[currentToneIndex];
  const currentCommand = VOICE_COMMANDS[currentCommandIndex];

  const phraseProgress = ((currentPhraseIndex + (recordedPhrases[currentPhrase?.id] ? 1 : 0)) / SAMPLE_PHRASES.length) * 100;
  const toneProgress = ((currentToneIndex + (recordedTones[currentTone?.id] ? 1 : 0)) / VOICE_TONES.length) * 100;
  const commandProgress = ((currentCommandIndex + (recordedCommands[currentCommand?.id] ? 1 : 0)) / VOICE_COMMANDS.length) * 100;

  if (!isOpen) return null;

  // Use 25% floating overlay instead of full sheet
  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-[100] w-[90%] max-w-md max-h-[25vh] bg-card border border-border rounded-2xl shadow-xl overflow-hidden transition-all duration-300",
        !isOpen && "opacity-0 pointer-events-none translate-y-4"
      )}
    >
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Voice Calibration</span>
          {phase !== 'intro' && phase !== 'complete' && (
            <span className="text-xs text-muted-foreground">
              Step {phase === 'phrases' ? 1 : phase === 'tones' ? 2 : 3}/3
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 overflow-y-auto max-h-[calc(25vh-60px)]">
          {/* Intro Phase */}
          {phase === 'intro' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic className="w-12 h-12 text-primary" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Train Your Voice</h2>
                <p className="text-muted-foreground max-w-sm">
                  Record your voice to enable AI-powered voice messaging, voice commands, 
                  and personalized audio responses.
                </p>
              </div>

              <div className="space-y-4 w-full max-w-sm">
                <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                  <Volume2 className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Voice Messages</p>
                    <p className="text-xs text-muted-foreground">
                      Send voice notes from text using your own voice
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                  <Music className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Emotional Tones</p>
                    <p className="text-xs text-muted-foreground">
                      Apply happy, sad, excited, or calm tones to messages
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 text-left p-3 rounded-lg bg-muted/50">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Voice Commands</p>
                    <p className="text-xs text-muted-foreground">
                      Control the app with your voice
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 w-full max-w-sm pt-4">
                {onSkip && (
                  <Button variant="ghost" onClick={onSkip} className="flex-1">
                    Skip for now
                  </Button>
                )}
                <Button onClick={() => setPhase('phrases')} className="flex-1">
                  Start Training
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Phrases Phase */}
          {phase === 'phrases' && (
            <div className="flex-1 flex flex-col p-4 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Step 1 of 3 • Voice Samples</p>
                <Progress value={phraseProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {currentPhraseIndex + 1} of {SAMPLE_PHRASES.length}
                </p>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground uppercase tracking-wide">
                    {currentPhrase.category}
                  </p>
                  <p className="text-xl font-medium px-4">"{currentPhrase.text}"</p>
                </div>

                {/* Volume visualizer */}
                <div className="w-full max-w-xs h-16 flex items-center justify-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 rounded-full transition-all duration-75',
                        voiceRecorder.isRecording ? 'bg-primary' : 'bg-muted'
                      )}
                      style={{
                        height: voiceRecorder.isRecording 
                          ? `${Math.max(4, volumeLevel * 64 * (1 + Math.sin(i * 0.5) * 0.3))}px`
                          : '4px',
                      }}
                    />
                  ))}
                </div>

                {/* Recording button */}
                <button
                  onClick={handleRecordPhrase}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                    voiceRecorder.isRecording
                      ? 'bg-destructive text-destructive-foreground animate-pulse scale-110'
                      : recordedPhrases[currentPhrase.id]
                        ? 'bg-green-500/20 text-green-500 border-2 border-green-500'
                        : 'bg-primary/20 text-primary border-2 border-primary'
                  )}
                >
                  {voiceRecorder.isRecording ? (
                    <MicOff className="w-8 h-8" />
                  ) : recordedPhrases[currentPhrase.id] ? (
                    <Check className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>

                {voiceRecorder.isRecording && (
                  <p className="text-sm text-muted-foreground">
                    Recording... {formatTime(voiceRecorder.recordingDuration)}
                  </p>
                )}

                {recordedPhrases[currentPhrase.id] && !voiceRecorder.isRecording && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playRecording(recordedPhrases[currentPhrase.id], currentPhrase.id)}
                    >
                      {isPlaying && playingId === currentPhrase.id ? (
                        <><Pause className="w-4 h-4 mr-1" /> Stop</>
                      ) : (
                        <><Play className="w-4 h-4 mr-1" /> Play</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecordedPhrases(prev => {
                          const next = { ...prev };
                          delete next[currentPhrase.id];
                          return next;
                        });
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Redo
                    </Button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentPhraseIndex > 0) {
                      setCurrentPhraseIndex(prev => prev - 1);
                    }
                  }}
                  disabled={currentPhraseIndex === 0}
                >
                  Back
                </Button>
                <Button
                  onClick={nextPhrase}
                  className="flex-1"
                  disabled={!recordedPhrases[currentPhrase.id]}
                >
                  {currentPhraseIndex === SAMPLE_PHRASES.length - 1 ? 'Next: Emotional Tones' : 'Next Phrase'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Tones Phase */}
          {phase === 'tones' && (
            <div className="flex-1 flex flex-col p-4 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Step 2 of 3 • Emotional Tones</p>
                <Progress value={toneProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {currentToneIndex + 1} of {VOICE_TONES.length}
                </p>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div className="text-center space-y-3">
                  <span className="text-5xl">{currentTone.emoji}</span>
                  <p className="text-xl font-medium">{currentTone.name} Tone</p>
                  <p className="text-muted-foreground px-4">
                    Say this with a <span className="text-primary font-medium">{currentTone.name.toLowerCase()}</span> voice:
                  </p>
                  <p className="text-lg font-medium px-4">"{currentTone.phrase}"</p>
                </div>

                {/* Volume visualizer */}
                <div className="w-full max-w-xs h-16 flex items-center justify-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 rounded-full transition-all duration-75',
                        voiceRecorder.isRecording ? 'bg-primary' : 'bg-muted'
                      )}
                      style={{
                        height: voiceRecorder.isRecording 
                          ? `${Math.max(4, volumeLevel * 64 * (1 + Math.sin(i * 0.5) * 0.3))}px`
                          : '4px',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={handleRecordTone}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                    voiceRecorder.isRecording
                      ? 'bg-destructive text-destructive-foreground animate-pulse scale-110'
                      : recordedTones[currentTone.id]
                        ? 'bg-green-500/20 text-green-500 border-2 border-green-500'
                        : 'bg-primary/20 text-primary border-2 border-primary'
                  )}
                >
                  {voiceRecorder.isRecording ? (
                    <MicOff className="w-8 h-8" />
                  ) : recordedTones[currentTone.id] ? (
                    <Check className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>

                {voiceRecorder.isRecording && (
                  <p className="text-sm text-muted-foreground">
                    Recording... {formatTime(voiceRecorder.recordingDuration)}
                  </p>
                )}

                {recordedTones[currentTone.id] && !voiceRecorder.isRecording && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playRecording(recordedTones[currentTone.id], currentTone.id)}
                    >
                      {isPlaying && playingId === currentTone.id ? (
                        <><Pause className="w-4 h-4 mr-1" /> Stop</>
                      ) : (
                        <><Play className="w-4 h-4 mr-1" /> Play</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecordedTones(prev => {
                          const next = { ...prev };
                          delete next[currentTone.id];
                          return next;
                        });
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Redo
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentToneIndex > 0) {
                      setCurrentToneIndex(prev => prev - 1);
                    } else {
                      setPhase('phrases');
                      setCurrentPhraseIndex(SAMPLE_PHRASES.length - 1);
                    }
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={nextTone}
                  className="flex-1"
                  disabled={!recordedTones[currentTone.id]}
                >
                  {currentToneIndex === VOICE_TONES.length - 1 ? 'Next: Voice Commands' : 'Next Tone'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Commands Phase */}
          {phase === 'commands' && (
            <div className="flex-1 flex flex-col p-4 space-y-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Step 3 of 3 • Voice Commands</p>
                <Progress value={commandProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {currentCommandIndex + 1} of {VOICE_COMMANDS.length}
                </p>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                    <Waves className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">{currentCommand.description}</p>
                  <p className="text-2xl font-bold">"{currentCommand.command}"</p>
                </div>

                {/* Volume visualizer */}
                <div className="w-full max-w-xs h-16 flex items-center justify-center gap-1">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-2 rounded-full transition-all duration-75',
                        voiceRecorder.isRecording ? 'bg-primary' : 'bg-muted'
                      )}
                      style={{
                        height: voiceRecorder.isRecording 
                          ? `${Math.max(4, volumeLevel * 64 * (1 + Math.sin(i * 0.5) * 0.3))}px`
                          : '4px',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={handleRecordCommand}
                  className={cn(
                    'w-20 h-20 rounded-full flex items-center justify-center transition-all',
                    voiceRecorder.isRecording
                      ? 'bg-destructive text-destructive-foreground animate-pulse scale-110'
                      : recordedCommands[currentCommand.id]
                        ? 'bg-green-500/20 text-green-500 border-2 border-green-500'
                        : 'bg-primary/20 text-primary border-2 border-primary'
                  )}
                >
                  {voiceRecorder.isRecording ? (
                    <MicOff className="w-8 h-8" />
                  ) : recordedCommands[currentCommand.id] ? (
                    <Check className="w-8 h-8" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>

                {voiceRecorder.isRecording && (
                  <p className="text-sm text-muted-foreground">
                    Recording... {formatTime(voiceRecorder.recordingDuration)}
                  </p>
                )}

                {recordedCommands[currentCommand.id] && !voiceRecorder.isRecording && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playRecording(recordedCommands[currentCommand.id], currentCommand.id)}
                    >
                      {isPlaying && playingId === currentCommand.id ? (
                        <><Pause className="w-4 h-4 mr-1" /> Stop</>
                      ) : (
                        <><Play className="w-4 h-4 mr-1" /> Play</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRecordedCommands(prev => {
                          const next = { ...prev };
                          delete next[currentCommand.id];
                          return next;
                        });
                      }}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Redo
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (currentCommandIndex > 0) {
                      setCurrentCommandIndex(prev => prev - 1);
                    } else {
                      setPhase('tones');
                      setCurrentToneIndex(VOICE_TONES.length - 1);
                    }
                  }}
                >
                  Back
                </Button>
                <Button
                  onClick={nextCommand}
                  className="flex-1"
                  disabled={!recordedCommands[currentCommand.id]}
                >
                  {currentCommandIndex === VOICE_COMMANDS.length - 1 ? 'Finish Training' : 'Next Command'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Complete Phase */}
          {phase === 'complete' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
              <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-12 h-12 text-green-500" />
              </div>
              
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Voice Training Complete!</h2>
                <p className="text-muted-foreground max-w-sm">
                  Your voice profile has been created. You can now use voice features throughout the app.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-primary">{Object.keys(recordedPhrases).length}</p>
                  <p className="text-xs text-muted-foreground">Samples</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-primary">{Object.keys(recordedTones).length}</p>
                  <p className="text-xs text-muted-foreground">Tones</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold text-primary">{Object.keys(recordedCommands).length}</p>
                  <p className="text-xs text-muted-foreground">Commands</p>
                </div>
              </div>

              <div className="space-y-2 w-full max-w-sm">
                <p className="text-sm font-medium">What you can do now:</p>
                <ul className="text-sm text-muted-foreground space-y-1 text-left">
                  <li>• Send voice messages from typed text</li>
                  <li>• Apply emotional tones to messages</li>
                  <li>• Use voice commands to navigate</li>
                  <li>• Create AI videos with your voice</li>
                </ul>
              </div>

              <Button onClick={handleComplete} className="w-full max-w-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                Done
              </Button>
            </div>
          )}
      </div>
    </div>
  );
};

export default VoiceCalibration;
