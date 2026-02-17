import { supabase } from '@/integrations/supabase/client';
import type { CalibrationData } from '@/hooks/useBlinkRemoteControl';

type CalibrationPayload = {
  global?: CalibrationData;
  devices?: Record<string, CalibrationData>;
};

const isCalibrationData = (value: unknown): value is CalibrationData => {
  if (!value || typeof value !== 'object') return false;
  const v = value as CalibrationData;
  return (
    typeof v.offsetX === 'number' &&
    typeof v.offsetY === 'number' &&
    typeof v.scaleX === 'number' &&
    typeof v.scaleY === 'number' &&
    typeof v.calibratedAt === 'number'
  );
};

const normalizePayload = (value: unknown): CalibrationPayload => {
  if (isCalibrationData(value)) {
    return { global: value, devices: {} };
  }
  if (!value || typeof value !== 'object') {
    return { devices: {} };
  }
  const payload = value as CalibrationPayload;
  return {
    global: payload.global,
    devices: payload.devices || {},
  };
};

export const fetchProfileCalibration = async (
  userId: string,
  deviceId?: string | null
): Promise<CalibrationData | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('calibration_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Calibration] Failed to fetch profile calibration', error);
    return null;
  }

  const payload = normalizePayload(data?.calibration_data);
  // Per-device: prefer device-specific calibration when available, else fall back to global
  if (deviceId && payload.devices?.[deviceId] && isCalibrationData(payload.devices[deviceId])) {
    return payload.devices[deviceId] as CalibrationData;
  }
  return (payload.global ?? null) as CalibrationData | null;
};

export const saveProfileCalibration = async (
  userId: string,
  data: CalibrationData,
  deviceId?: string | null
) => {
  const { data: current, error: readError } = await supabase
    .from('profiles')
    .select('calibration_data')
    .eq('user_id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[Calibration] Failed to read profile calibration', readError);
    return;
  }

  const payload = normalizePayload(current?.calibration_data);
  if (deviceId) {
    payload.devices = payload.devices || {};
    payload.devices[deviceId] = data;
    if (!payload.global) payload.global = data;
  } else {
    payload.global = data;
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      calibration_data: payload,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) {
    console.error('[Calibration] Failed to save profile calibration', error);
  }
};
