import { useState, useRef, useCallback, useEffect } from 'react';

/** Maximum voice message duration in seconds (5 minutes) */
export const VOICE_MAX_DURATION_SEC = 300;

/** Minimum voice message duration in seconds (to avoid accidental short recordings) */
export const VOICE_MIN_DURATION_SEC = 1;

export interface UseVoiceRecorderOptions {
  /** Maximum recording duration in seconds. Default: 300 (5 min) */
  maxDuration?: number;
  /** Called when max duration is reached (recording auto-stops) */
  onMaxDurationReached?: () => void;
}

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  isPaused: boolean;
  recordingDuration: number;
  /** 0–1 normalized audio level for waveform visualization */
  audioLevel: number;
  /** Approximate duration of the recorded blob (set after stop) */
  recordedDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ blob: Blob; durationSeconds: number } | null>;
  cancelRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: string | null;
  clearError: () => void;
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderResult {
  const { maxDuration = VOICE_MAX_DURATION_SEC, onMaxDurationReached } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  const clearError = useCallback(() => setError(null), []);

  const stopAnalyser = useCallback(() => {
    if (animationRef.current != null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const startAnalyser = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      source.connect(analyser);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserRef.current || !mediaRecorderRef.current?.state?.match?.(/recording|active/)) {
          return;
        }
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(Math.min(1, (avg / 128) * 2));
        animationRef.current = requestAnimationFrame(updateLevel);
      };
      animationRef.current = requestAnimationFrame(updateLevel);
    } catch {
      // Analyser optional; ignore
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      durationRef.current = 0;
      setRecordingDuration(0);
      setRecordedDuration(0);
      startAnalyser(stream);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          if (next >= maxDuration) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            mediaRecorder.stop();
            onMaxDurationReached?.();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to access microphone';
      setError(
        msg.toLowerCase().includes('permission')
          ? 'Microphone permission denied'
          : 'Could not start recording'
      );
      throw err;
    }
  }, [maxDuration, onMaxDurationReached, startAnalyser]);

  const stopRecording = useCallback(async (): Promise<{ blob: Blob; durationSeconds: number } | null> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr || (mr.state !== 'recording' && mr.state !== 'active')) {
        stopAnalyser();
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        resolve(null);
        return;
      }

      mr.onstop = () => {
        stopAnalyser();
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || 'audio/webm',
        });
        const dur = durationRef.current;
        setRecordedDuration(dur);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        setIsRecording(false);
        setIsPaused(false);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        resolve({ blob, durationSeconds: dur });
      };

      mr.stop();
    });
  }, [stopAnalyser]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state?.match?.(/recording|active/)) {
      mediaRecorderRef.current.stop();
    }
    stopAnalyser();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setIsPaused(false);
    setRecordingDuration(0);
    setRecordedDuration(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stopAnalyser]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopAnalyser();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [stopAnalyser]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      if (streamRef.current) startAnalyser(streamRef.current);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          if (next >= maxDuration) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            mediaRecorderRef.current?.stop();
            onMaxDurationReached?.();
          }
          return next;
        });
      }, 1000);
    }
  }, [maxDuration, onMaxDurationReached, startAnalyser]);

  useEffect(() => {
    return () => {
      cancelRecording();
    };
  }, [cancelRecording]);

  return {
    isRecording,
    isPaused,
    recordingDuration,
    audioLevel,
    recordedDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
    error,
    clearError,
  };
}
