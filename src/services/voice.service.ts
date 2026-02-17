import { supabase } from '@/integrations/supabase/client';

export interface VoiceCalibrationProfile {
  completedAt: number;
  samplesRecorded: number;
  tonesRecorded: string[];
  commandsRecorded: number;
  /** Optional: custom trigger phrase per command id (what the user said during calibration). */
  customPhrases?: Record<string, string>;
  /** Metadata for future use (e.g. sample URLs if we upload to storage). */
  voicePrint?: {
    sampleUrls?: string[];
    toneSamples?: Record<string, string>;
  };
}

type CalibrationDataRow = {
  calibration_data?: Record<string, unknown> | null;
};

const VOICE_KEY = 'voice';

export async function fetchVoiceCalibration(userId: string): Promise<VoiceCalibrationProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('calibration_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Voice] Failed to fetch voice calibration', error);
    return null;
  }

  const row = data as CalibrationDataRow | null;
  const raw = row?.calibration_data;
  if (!raw || typeof raw !== 'object' || !(VOICE_KEY in raw)) {
    return null;
  }

  const voice = (raw as Record<string, unknown>)[VOICE_KEY];
  if (!voice || typeof voice !== 'object') return null;

  const v = voice as Record<string, unknown>;
  if (typeof v.completedAt !== 'number') return null;

  return {
    completedAt: v.completedAt as number,
    samplesRecorded: typeof v.samplesRecorded === 'number' ? v.samplesRecorded : 0,
    tonesRecorded: Array.isArray(v.tonesRecorded) ? (v.tonesRecorded as string[]) : [],
    commandsRecorded: typeof v.commandsRecorded === 'number' ? v.commandsRecorded : 0,
    customPhrases:
      v.customPhrases && typeof v.customPhrases === 'object' && !Array.isArray(v.customPhrases)
        ? (v.customPhrases as Record<string, string>)
        : undefined,
    voicePrint:
      v.voicePrint && typeof v.voicePrint === 'object'
        ? (v.voicePrint as VoiceCalibrationProfile['voicePrint'])
        : undefined,
  };
}

export async function saveVoiceCalibration(
  userId: string,
  profile: VoiceCalibrationProfile
): Promise<{ error: Error | null }> {
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('calibration_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[Voice] Failed to read profile for voice calibration', readError);
    return { error: new Error(readError.message) };
  }

  const existing = (current as CalibrationDataRow | null)?.calibration_data;
  const payload: Record<string, unknown> =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? { ...existing }
      : {};
  payload[VOICE_KEY] = {
    completedAt: profile.completedAt,
    samplesRecorded: profile.samplesRecorded,
    tonesRecorded: profile.tonesRecorded,
    commandsRecorded: profile.commandsRecorded,
    customPhrases: profile.customPhrases ?? undefined,
    voicePrint: profile.voicePrint ?? undefined,
  };

  const { error } = await supabase
    .from('profiles')
    .update({
      calibration_data: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Voice] Failed to save voice calibration', error);
    return { error: new Error(error.message) };
  }
  return { error: null };
}
