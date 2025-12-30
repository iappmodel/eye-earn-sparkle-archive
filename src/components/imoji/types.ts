// iMoji Types and Interfaces

export type IMojiStyle = 
  | 'realistic'
  | 'manga'
  | 'disney'
  | 'cartoon'
  | 'pixar'
  | 'anime'
  | 'chibi'
  | 'memoji'
  | 'sketch'
  | 'pop-art'
  | 'watercolor'
  | '3d-render';

export type IMojiTone = 
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'excited'
  | 'love'
  | 'laughing'
  | 'crying'
  | 'wink'
  | 'thinking'
  | 'cool'
  | 'worried'
  | 'hopeful'
  | 'pensive'
  | 'funny'
  | 'clever'
  | 'sexy'
  | 'smart'
  | 'elegant'
  | 'young'
  | 'mature'
  | 'neutral'
  | 'poetic';

export type IMojiType = 'static' | 'animated' | 'fullscreen';

export interface IMoji {
  id: string;
  userId: string;
  name: string;
  baseImageUrl: string; // Original face image
  generatedUrl: string; // Generated iMoji image/animation
  thumbnailUrl: string;
  style: IMojiStyle;
  tone: IMojiTone;
  type: IMojiType;
  customPrompt?: string;
  hasSound: boolean;
  soundUrl?: string;
  clothing?: string;
  accessories?: string;
  characteristics?: string[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  sourceType: 'camera' | 'gallery' | 'profile-media' | 'body-scan';
  sourceMediaId?: string;
}

export interface IMojiGenerationRequest {
  faceImageUrl: string;
  style: IMojiStyle;
  tone: IMojiTone;
  type: IMojiType;
  customPrompt?: string;
  clothing?: string;
  accessories?: string;
}

export interface IMojiEditRequest {
  imojiId: string;
  editPrompt: string;
  newStyle?: IMojiStyle;
  newTone?: IMojiTone;
  addSound?: boolean;
  soundPrompt?: string;
}

export const IMOJI_STYLES: { id: IMojiStyle; name: string; description: string; icon: string }[] = [
  { id: 'realistic', name: 'Realistic', description: 'Photo-realistic representation', icon: '📷' },
  { id: 'manga', name: 'Manga', description: 'Japanese manga style', icon: '🎌' },
  { id: 'disney', name: 'Disney', description: 'Disney animation style', icon: '✨' },
  { id: 'cartoon', name: 'Cartoon', description: 'Classic cartoon style', icon: '🎨' },
  { id: 'pixar', name: 'Pixar', description: 'Pixar 3D animation style', icon: '🎬' },
  { id: 'anime', name: 'Anime', description: 'Japanese anime style', icon: '🌸' },
  { id: 'chibi', name: 'Chibi', description: 'Cute chibi style', icon: '🍡' },
  { id: 'memoji', name: 'Memoji', description: 'Apple Memoji style', icon: '😀' },
  { id: 'sketch', name: 'Sketch', description: 'Hand-drawn sketch', icon: '✏️' },
  { id: 'pop-art', name: 'Pop Art', description: 'Andy Warhol pop art', icon: '🎭' },
  { id: 'watercolor', name: 'Watercolor', description: 'Watercolor painting', icon: '🖌️' },
  { id: '3d-render', name: '3D Render', description: 'High-quality 3D render', icon: '💎' },
];

export const IMOJI_TONES: { id: IMojiTone; name: string; emoji: string }[] = [
  { id: 'happy', name: 'Happy', emoji: '😊' },
  { id: 'sad', name: 'Sad', emoji: '😢' },
  { id: 'angry', name: 'Angry', emoji: '😠' },
  { id: 'surprised', name: 'Surprised', emoji: '😲' },
  { id: 'excited', name: 'Excited', emoji: '🤩' },
  { id: 'love', name: 'Love', emoji: '😍' },
  { id: 'laughing', name: 'Laughing', emoji: '😂' },
  { id: 'crying', name: 'Crying', emoji: '😭' },
  { id: 'wink', name: 'Wink', emoji: '😉' },
  { id: 'thinking', name: 'Thinking', emoji: '🤔' },
  { id: 'cool', name: 'Cool', emoji: '😎' },
  { id: 'worried', name: 'Worried', emoji: '😟' },
  { id: 'hopeful', name: 'Hopeful', emoji: '🥺' },
  { id: 'pensive', name: 'Pensive', emoji: '😔' },
  { id: 'funny', name: 'Funny', emoji: '🤪' },
  { id: 'clever', name: 'Clever', emoji: '🧐' },
  { id: 'sexy', name: 'Sexy', emoji: '😏' },
  { id: 'smart', name: 'Smart', emoji: '🤓' },
  { id: 'elegant', name: 'Elegant', emoji: '🎩' },
  { id: 'young', name: 'Young', emoji: '👶' },
  { id: 'mature', name: 'Mature', emoji: '🧔' },
  { id: 'neutral', name: 'Neutral', emoji: '😐' },
  { id: 'poetic', name: 'Poetic', emoji: '🌹' },
];
