/**
 * Local mockup video paths. Videos are in public/videos/{feed}/
 * - friends (PEOPLE): folder 1
 * - explore (NATURE): folder 2 -> /videos/favorites
 * - saved (SCIENCE): folder 3 -> /videos/main
 * - promotions (PROMOS): folder 4 -> /videos/promos
 */
const BASE = '/videos';

export const FRIENDS_VIDEOS = [
  `${BASE}/friends/1.mp4`,
  `${BASE}/friends/11.mp4`,
  `${BASE}/friends/111.mp4`,
  `${BASE}/friends/1111.mp4`,
  `${BASE}/friends/11111.mp4`,
  `${BASE}/friends/111111.mp4`,
  `${BASE}/friends/1111111.mp4`,
  `${BASE}/friends/11111111.mp4`,
  `${BASE}/friends/111111111.mp4`,
  `${BASE}/friends/1111111111.mp4`,
] as const;

export const EXPLORE_VIDEOS = [
  `${BASE}/favorites/2.mp4`,
  `${BASE}/favorites/22.mp4`,
  `${BASE}/favorites/222.mp4`,
  `${BASE}/favorites/2222.mp4`,
  `${BASE}/favorites/22222.mp4`,
  `${BASE}/favorites/222222.mp4`,
  `${BASE}/favorites/2222222.mp4`,
  `${BASE}/favorites/22222222.mp4`,
  `${BASE}/favorites/222222222.mp4`,
  `${BASE}/favorites/2222222222222222222222222222222.mp4`,
] as const;

export const SAVED_VIDEOS = [
  `${BASE}/main/3.mp4`,
  `${BASE}/main/33.mp4`,
  `${BASE}/main/333.mp4`,
  `${BASE}/main/3333.mp4`,
  `${BASE}/main/33333.mp4`,
  `${BASE}/main/333333.mp4`,
  `${BASE}/main/33333333.mp4`,
  `${BASE}/main/333333333.mp4`,
  `${BASE}/main/3333333333.mp4`,
] as const;

export const PROMOS_VIDEOS = [
  `${BASE}/promos/4.mp4`,
  `${BASE}/promos/44.mp4`,
  `${BASE}/promos/444.mp4`,
  `${BASE}/promos/4444.mp4`,
  `${BASE}/promos/44444.mp4`,
  `${BASE}/promos/444444.mp4`,
  `${BASE}/promos/4444444.mp4`,
  `${BASE}/promos/44444444.mp4`,
  `${BASE}/promos/444444444.mp4`,
  `${BASE}/promos/4444444444.mp4`,
] as const;

// Backward-compatible aliases while feed naming shifts to Explore/Saved terminology.
export const FAVORITES_VIDEOS = EXPLORE_VIDEOS;
export const MAIN_VIDEOS = SAVED_VIDEOS;
