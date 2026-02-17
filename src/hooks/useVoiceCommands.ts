import { useState, useRef, useCallback, useEffect } from 'react';
import { matchVoiceCommand, type VoiceCommandId } from '@/constants/voiceCommands';

const COMMAND_DEBOUNCE_MS = 1200;

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface VoiceCommandPayload {
  commandId: VoiceCommandId;
  transcript: string;
  confidence?: number;
}

export interface UseVoiceCommandsOptions {
  enabled?: boolean;
  /** Custom phrase per command id (from calibration). */
  customPhrases?: Record<string, string>;
  onCommand?: (payload: VoiceCommandPayload) => void;
  /** Called when recognition is not supported or fails. */
  onError?: (message: string) => void;
}

export function useVoiceCommands(options: UseVoiceCommandsOptions = {}) {
  const { enabled = true, customPhrases, onCommand, onError } = options;
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<VoiceCommandId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lastCommandTimeRef = useRef(0);
  const onCommandRef = useRef(onCommand);
  const customPhrasesRef = useRef(customPhrases);

  onCommandRef.current = onCommand;
  customPhrasesRef.current = customPhrases;

  useEffect(() => {
    const SpeechRecognitionCtor =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : undefined;
    setIsSupported(!!SpeechRecognitionCtor);
    if (!SpeechRecognitionCtor) {
      setError('Voice recognition is not supported in this browser.');
      return;
    }
    setError(null);
  }, []);

  const processResult = useCallback((transcript: string, confidence?: number) => {
    const t = transcript.trim();
    if (!t) return;
    setLastTranscript(t);
    const commandId = matchVoiceCommand(t, customPhrasesRef.current ?? undefined);
    if (!commandId) return;
    const now = Date.now();
    if (now - lastCommandTimeRef.current < COMMAND_DEBOUNCE_MS) return;
    lastCommandTimeRef.current = now;
    setLastCommand(commandId);
    onCommandRef.current?.({
      commandId,
      transcript: t,
      confidence,
    });
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError('Voice recognition not supported');
      onError?.('Voice recognition not supported');
      return;
    }
    setError(null);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognitionCtor() as SpeechRecognitionInstance;
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[e.resultIndex];
      const item = result.isFinal ? result[0] : null;
      if (!item) return;
      const transcript = typeof item.transcript === 'string' ? item.transcript : item.transcript;
      const confidence = typeof item.confidence === 'number' ? item.confidence : undefined;
      processResult(transcript, confidence);
    };

    recognition.onend = () => {
      if (!recognitionRef.current) return;
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      const msg = e.message || e.error || 'Recognition error';
      if (e.error === 'no-speech' || e.error === 'aborted') {
        setError(null);
        return;
      }
      setError(msg);
      onError?.(msg);
    };

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recognition';
      setError(msg);
      onError?.(msg);
      recognitionRef.current = null;
    }
  }, [processResult, onError]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, stopListening]);

  return {
    isListening,
    isSupported,
    lastTranscript,
    lastCommand,
    error,
    startListening,
    stopListening,
  };
}
