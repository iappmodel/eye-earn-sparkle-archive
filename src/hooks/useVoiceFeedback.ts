import { useCallback, useRef, useState, useEffect } from 'react';

// Storage key
const VOICE_FEEDBACK_SETTINGS_KEY = 'app_voice_feedback_settings';

export interface VoiceFeedbackSettings {
  voiceEnabled: boolean;
  soundEnabled: boolean;
  voiceVolume: number;
  soundVolume: number;
  voiceRate: number;
  voicePitch: number;
  selectedVoice: string | null;
}

const DEFAULT_SETTINGS: VoiceFeedbackSettings = {
  voiceEnabled: true,
  soundEnabled: true,
  voiceVolume: 0.8,
  soundVolume: 0.5,
  voiceRate: 1.0,
  voicePitch: 1.0,
  selectedVoice: null,
};

// Sound effect frequencies for different feedback types
const SOUND_EFFECTS = {
  success: { frequency: 880, duration: 150, type: 'sine' as OscillatorType },
  combo: { frequency: 1320, duration: 200, type: 'sine' as OscillatorType },
  step: { frequency: 440, duration: 50, type: 'square' as OscillatorType },
  error: { frequency: 220, duration: 300, type: 'sawtooth' as OscillatorType },
  activate: { frequency: 660, duration: 100, type: 'sine' as OscillatorType },
};

export const loadVoiceFeedbackSettings = (): VoiceFeedbackSettings => {
  try {
    const saved = localStorage.getItem(VOICE_FEEDBACK_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveVoiceFeedbackSettings = (settings: VoiceFeedbackSettings) => {
  localStorage.setItem(VOICE_FEEDBACK_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('voiceFeedbackSettingsChanged'));
};

export function useVoiceFeedback() {
  const [settings, setSettings] = useState<VoiceFeedbackSettings>(loadVoiceFeedbackSettings);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechSynthRef = useRef<SpeechSynthesis | null>(null);

  // Initialize speech synthesis and get available voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const voices = speechSynthRef.current?.getVoices() || [];
        setAvailableVoices(voices);
      };
      
      loadVoices();
      speechSynthRef.current.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
      }
    };
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleChange = () => setSettings(loadVoiceFeedbackSettings());
    window.addEventListener('voiceFeedbackSettingsChanged', handleChange);
    return () => window.removeEventListener('voiceFeedbackSettingsChanged', handleChange);
  }, []);

  // Get or create audio context
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Play a synthesized sound effect
  const playSound = useCallback((type: keyof typeof SOUND_EFFECTS) => {
    if (!settings.soundEnabled) return;
    
    try {
      const ctx = getAudioContext();
      const effect = SOUND_EFFECTS[type];
      
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = effect.type;
      oscillator.frequency.setValueAtTime(effect.frequency, ctx.currentTime);
      
      gainNode.gain.setValueAtTime(settings.soundVolume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + effect.duration / 1000);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + effect.duration / 1000);
    } catch (error) {
      console.error('[VoiceFeedback] Error playing sound:', error);
    }
  }, [settings.soundEnabled, settings.soundVolume, getAudioContext]);

  // Play combo success sound (ascending notes)
  const playComboSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    
    try {
      const ctx = getAudioContext();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      
      notes.forEach((freq, i) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1);
        
        gainNode.gain.setValueAtTime(settings.soundVolume * 0.5, ctx.currentTime + i * 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.15);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start(ctx.currentTime + i * 0.1);
        oscillator.stop(ctx.currentTime + i * 0.1 + 0.15);
      });
    } catch (error) {
      console.error('[VoiceFeedback] Error playing combo sound:', error);
    }
  }, [settings.soundEnabled, settings.soundVolume, getAudioContext]);

  // Speak text using speech synthesis
  const speak = useCallback((text: string, priority: boolean = false) => {
    if (!settings.voiceEnabled || !speechSynthRef.current) return;
    
    if (priority) {
      speechSynthRef.current.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = settings.voiceVolume;
    utterance.rate = settings.voiceRate;
    utterance.pitch = settings.voicePitch;
    
    // Set voice if specified
    if (settings.selectedVoice) {
      const voice = availableVoices.find(v => v.name === settings.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthRef.current.speak(utterance);
  }, [settings, availableVoices]);

  // Announce combo execution
  const announceCombo = useCallback((comboName: string, actionName: string) => {
    playComboSound();
    speak(`${comboName}. ${actionName}`, true);
  }, [playComboSound, speak]);

  // Announce practice mode combo
  const announcePracticeCombo = useCallback((comboName: string) => {
    playSound('success');
    speak(`Practice: ${comboName}`, true);
  }, [playSound, speak]);

  // Announce step progress
  const announceStep = useCallback((stepDescription: string) => {
    playSound('step');
  }, [playSound]);

  // Announce activation
  const announceActivation = useCallback((active: boolean) => {
    playSound('activate');
    speak(active ? 'Remote control activated' : 'Remote control deactivated', true);
  }, [playSound, speak]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<VoiceFeedbackSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveVoiceFeedbackSettings(newSettings);
  }, [settings]);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    settings,
    availableVoices,
    isSpeaking,
    playSound,
    playComboSound,
    speak,
    announceCombo,
    announcePracticeCombo,
    announceStep,
    announceActivation,
    updateSettings,
    stopSpeaking,
  };
}
