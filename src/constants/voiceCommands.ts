/**
 * Voice command definitions shared between calibration UI and recognition.
 * Each id maps to an app action (navigation or combo).
 */

export interface VoiceCommandDef {
  id: string;
  command: string;
  description: string;
  /** Alternative phrases that should trigger this command (user can add more during calibration). */
  keywords: string[];
}

export const VOICE_COMMAND_DEFS: VoiceCommandDef[] = [
  { id: 'next', command: 'Next', description: 'Go to next content', keywords: ['next', 'skip', 'next video', 'skip this', 'next one', 'go next'] },
  { id: 'back', command: 'Go back', description: 'Return to previous', keywords: ['back', 'go back', 'previous', 'prev', 'last video', 'go back'] },
  { id: 'like', command: 'Like this', description: 'Like current content', keywords: ['like', 'like this', 'love it', 'heart'] },
  { id: 'share', command: 'Share', description: 'Open share menu', keywords: ['share', 'share this', 'share video'] },
  { id: 'comment', command: 'Add comment', description: 'Open comments', keywords: ['comment', 'add comment', 'comments', 'open comments'] },
  { id: 'pause', command: 'Pause', description: 'Pause playback', keywords: ['pause', 'stop', 'hold'] },
  { id: 'play', command: 'Play', description: 'Resume playback', keywords: ['play', 'resume', 'start', 'unpause'] },
  { id: 'scroll', command: 'Scroll down', description: 'Scroll content', keywords: ['scroll', 'scroll down', 'more', 'down'] },
  { id: 'save', command: 'Save', description: 'Save video', keywords: ['save', 'save this', 'save video', 'bookmark'] },
  { id: 'follow', command: 'Follow', description: 'Follow creator', keywords: ['follow', 'follow them', 'subscribe'] },
  { id: 'checkIn', command: 'Check in', description: 'Open check-in and map', keywords: ['check in', 'checkin', 'check-in', 'I\'m here', 'location', 'check in here'] },
];

export type VoiceCommandId = typeof VOICE_COMMAND_DEFS[number]['id'];

/** Build a list of all trigger phrases for a command (default keywords + optional custom phrase). */
export function getTriggerPhrases(commandId: string, customPhrase?: string | null): string[] {
  const def = VOICE_COMMAND_DEFS.find((c) => c.id === commandId);
  const base = def ? [...def.keywords] : [];
  if (customPhrase && customPhrase.trim()) {
    base.unshift(customPhrase.trim().toLowerCase());
  }
  return base;
}

/** Match transcribed text to a command ID. Returns the first matching command or null. */
export function matchVoiceCommand(
  transcript: string,
  customPhrases?: Record<string, string>
): VoiceCommandId | null {
  const normalized = transcript.trim().toLowerCase();
  if (!normalized) return null;

  for (const def of VOICE_COMMAND_DEFS) {
    const phrases = getTriggerPhrases(def.id, customPhrases?.[def.id]);
    for (const phrase of phrases) {
      if (normalized === phrase || normalized.includes(phrase) || phrase.includes(normalized)) {
        return def.id as VoiceCommandId;
      }
    }
  }
  return null;
}
