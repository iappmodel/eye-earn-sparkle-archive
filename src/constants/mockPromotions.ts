/**
 * Mock promotions data and generators for Discovery Map and fallback when backend is unavailable.
 * Provides rich, realistic fake promotions with deterministic seeding for consistent UX.
 */

export type MockRewardType = 'vicoin' | 'icoin' | 'both';

export interface MockPromotion {
  id: string;
  business_name: string;
  description: string;
  reward_type: MockRewardType;
  reward_amount: number;
  required_action: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  distance?: number;
  image_url?: string | null;
  expires_at?: string | null;
  current_claims?: number;
  max_claims?: number | null;
  is_featured?: boolean;
}

// Seeded RNG for deterministic but varied output (Mulberry32)
function seededRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(lat: number, lng: number, startId: number, index: number): number {
  const s = `${lat.toFixed(4)}_${lng.toFixed(4)}_${startId}_${index}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = (h << 5) - h + c;
    h = h & h;
  }
  return h >>> 0;
}

const CATEGORY_IDS = [
  'food_drink',
  'shopping',
  'entertainment',
  'health',
  'services',
  'cafe',
  'fitness',
  'beauty',
  'automotive',
  'education',
  'nightlife',
  'travel',
  'home',
  'fashion',
  'gifts',
] as const;

const REWARD_TYPES: MockRewardType[] = ['vicoin', 'icoin', 'both'];

// Rich per-category business name pools (realistic variety)
const BUSINESS_NAMES_BY_CATEGORY: Record<string, string[]> = {
  food_drink: [
    'The Golden Fork', 'Bistro 42', 'Savor & Co', 'Flame Grill', 'Urban Eats', 'The Local Table',
    'Harvest Kitchen', 'Spice Route', 'Noodle House', 'Taco Loco', 'Pizza Paradiso', 'Sushi Zen',
    'Mama\'s Kitchen', 'The Hungry Bear', 'Fresh Bowl', 'Dragon Wok', 'Sunset Diner', 'Riverside Bistro',
  ],
  shopping: [
    'Main Street Market', 'Urban Outfitters', 'The General Store', 'Boutique 7', 'Plaza Retail',
    'Corner Shop', 'Mercado Central', 'Style Haven', 'Treasure Chest', 'The Emporium',
    'Local Goods Co', 'Village Market', 'Downtown Mall', 'Fashion Forward', 'Gadget Hub',
  ],
  entertainment: [
    'Starlight Cinema', 'Arcade Zone', 'Comedy Cellar', 'Lane 7 Bowling', 'Escape Room 101',
    'Live at the Venue', 'Theatre District', 'Game On Lounge', 'Concert Hall', 'Rooftop Cinema',
    'Retro Arcade', 'Jazz Club', 'Improv Palace', 'VR World', 'Board Game Café',
  ],
  health: [
    'Wellness Center', 'Pure Health Clinic', 'Vitality Medical', 'Community Health', 'Care Plus',
    'Health First', 'Natural Remedies', 'Mind & Body', 'Total Wellness', 'Healing Touch',
    'MedSpa One', 'Holistic Care', 'Family Health', 'QuickCare', 'Wellness Hub',
  ],
  services: [
    'QuickFix Repairs', 'Pro Services Co', 'Local Handyman', 'Tech Support Plus', 'Clean & Shine',
    'Copy & Print Pro', 'Mail & More', 'Dry Clean Express', 'Laundry Hub', 'Key Masters',
    'Locks & Security', 'Moving Help', 'Pet Sitters Inc', 'Tutor Pro', 'Notary Now',
  ],
  cafe: [
    'Blue Bean Coffee', 'Daily Grind', 'Corner Café', 'Brew & Co', 'The Roastery', 'Cuppa Joy',
    'Espresso Bar', 'Mocha House', 'Bean There', 'Steam & Sip', 'Artisan Coffee', 'Lazy Cup',
    'Morning Glory', 'The Coffee House', 'Café Luna', 'Brew Lab', 'Flat White Co',
  ],
  fitness: [
    'Iron Gym', 'FitLife Studio', 'CrossFit Central', 'Yoga Haven', 'Peak Performance',
    'Body Works', 'Pulse Fitness', 'Strength Lab', 'Flex Studio', 'Active Life',
    'The Movement', 'Core Club', 'Spin Zone', 'Boxing Academy', 'Pilates Place',
  ],
  beauty: [
    'Glamour Studio', 'Luxe Nails', 'Hair Artistry', 'Skin Deep Spa', 'Bella Beauty',
    'The Nail Bar', 'Blowout Co', 'Glow Studio', 'Pure Beauty', 'Serenity Spa',
    'Lash Lounge', 'Brow House', 'Color Room', 'Manicure & Co', 'Radiance Skin',
  ],
  automotive: [
    'Quick Lube', 'AutoCare Plus', 'Tire & Brake Co', 'Muffler Masters', 'Detail Pro',
    'Car Wash Express', 'Service Center', 'Drive Safe Auto', 'Engine Works', 'Transmission Pro',
    'Body Shop 101', 'Battery World', 'Oil Change Plus', 'Wheel Alignment', 'Smog & Go',
  ],
  education: [
    'Learning Tree', 'Tutor Hub', 'Study Center', 'Language Lab', 'Code Academy',
    'Music School', 'Art Studio', 'Test Prep Pro', 'Adult Ed Center', 'Kids Academy',
    'STEM Lab', 'Writing Workshop', 'Math Masters', 'Science Center', 'Craft Classes',
  ],
  nightlife: [
    'The Velvet Room', 'Neon Lounge', 'Jazz & Blues', 'Rooftop Bar', 'The Speakeasy',
    'Draft House', 'Cocktail Club', 'Live Wire', 'The Underground', 'Sky Bar',
    'Brewery Tap', 'Wine Bar', 'Karaoke Central', 'Dance Floor', 'Late Night Bites',
  ],
  travel: [
    'Wanderlust Tours', 'Local Adventures', 'Travel Desk', 'Getaway Co', 'Explore More',
    'Trip Planner', 'City Tours', 'Adventure Hub', 'Passport Ready', 'Journey Co',
    'Day Trips Inc', 'Sightseeing Pro', 'Travel Agency', 'Vacation Spot', 'Roam Free',
  ],
  home: [
    'Garden World', 'Home Depot Style', 'Furniture Plus', 'Plant Haven', 'Hardware Central',
    'Decor Studio', 'Outdoor Living', 'Nursery & Garden', 'Fix It All', 'Paint & Paper',
    'Lighting Co', 'Rug Gallery', 'Kitchen Pro', 'Bath & Tile', 'Storage Solutions',
  ],
  fashion: [
    'Threads & Co', 'Runway Local', 'Vintage Finds', 'Shoe Palace', 'Accessory Lane',
    'Denim Bar', 'Formal Wear', 'Street Style', 'Boutique 9', 'The Closet',
    'Style Edit', 'Trendy Threads', 'Capsule Wardrobe', 'Luxury Outlet', 'Designer Seconds',
  ],
  gifts: [
    'Gift Haven', 'Present Perfect', 'The Gift Shop', 'Curated Gifts', 'Something Special',
    'Wrap & Bow', 'Treasure Box', 'Thoughtful Gifts', 'Occasion Co', 'Surprise Me',
    'Local Crafts', 'Artisan Gifts', 'Card & Gift', 'Holiday Corner', 'Memories & More',
  ],
};

// Descriptions and actions per category for coherence
const DESCRIPTIONS_BY_CATEGORY: Record<string, string[]> = {
  food_drink: [
    'Enjoy a meal and earn rewards. Valid for dine-in or takeout.',
    'Exclusive offer for iView users. Show this promotion at checkout.',
    'Great food and great rewards. Visit us today!',
    'Try our seasonal specials and earn coins on your visit.',
    'Family-friendly dining with rewards for every visit.',
  ],
  shopping: [
    'Shop local and earn. Present this offer at the register.',
    'Exclusive rewards for iView members. No minimum purchase on select items.',
    'Discover new products and earn with every purchase.',
    'Special promotion for our loyal community. Visit in-store.',
    'Shop the latest arrivals and stack your rewards.',
  ],
  entertainment: [
    'Have fun and earn! Valid for admission or concessions.',
    'Experience the best in town and get rewarded for it.',
    'Bring friends, enjoy the show, and collect your coins.',
    'Exclusive iView member offer. Book your visit today.',
    'Entertainment that pays you back. Check in to claim.',
  ],
  health: [
    'Invest in your wellness and earn rewards. Book a visit.',
    'Exclusive offer for first-time and returning clients.',
    'Quality care with rewards. Present at reception.',
    'Wellness visit or consultation—earn when you check in.',
    'Take care of yourself and get rewarded. Valid for services.',
  ],
  services: [
    'Get the job done and earn. Mention iView at checkout.',
    'Quality service and rewards. Book your appointment.',
    'Exclusive offer for iView users. One per customer.',
    'Visit us for service and collect your reward after completion.',
    'We value your business. Check in to claim this offer.',
  ],
  cafe: [
    'Grab your favorite drink and earn. Valid for any purchase.',
    'Coffee and rewards—what could be better? Visit us today.',
    'Exclusive offer for iView. Show at counter when ordering.',
    'Start your day with a brew and bonus coins.',
    'Any drink or pastry. Check in and earn.',
  ],
  fitness: [
    'Work out and earn. Valid for drop-in or class.',
    'Get fit and get rewarded. First visit or returning.',
    'Exclusive iView offer. Present at front desk.',
    'No membership required for this reward. Just check in.',
    'Class or gym visit—earn when you show up.',
  ],
  beauty: [
    'Look good and earn. Book any service and check in.',
    'Exclusive rewards for iView. Valid for services over $25.',
    'Pamper yourself and collect coins. Mention iView when booking.',
    'First-time or regular—earn on your visit.',
    'Any treatment or service. Show this at reception.',
  ],
  automotive: [
    'Service your vehicle and earn. Mention iView when you arrive.',
    'Quality auto care with rewards. Valid for any service.',
    'Oil change, tire rotation, or full service—earn every time.',
    'Exclusive iView offer. One per vehicle per visit.',
    'We take care of your car; we reward you. Check in.',
  ],
  education: [
    'Learn something new and earn. Enroll or attend a class.',
    'Exclusive offer for iView. Valid for first session or course.',
    'Invest in your growth and get rewarded. Book a session.',
    'Workshop, class, or tutoring—check in to claim.',
    'Education that pays you back. Present at front desk.',
  ],
  nightlife: [
    'Night out with rewards. Check in at the door or bar.',
    'Exclusive iView offer. Valid with any purchase.',
    'Enjoy the vibe and earn. Show this at entry or first round.',
    'Live music, drinks, and coins. Visit us tonight.',
    'One check-in per visit. Have fun and collect.',
  ],
  travel: [
    'Book a tour or activity and earn. Mention iView when booking.',
    'Adventure awaits—and so do rewards. Check in at start.',
    'Exclusive offer for iView travelers. Valid for tours.',
    'Explore the area and get rewarded. Present at meeting point.',
    'Day trip or multi-day—earn when you start your experience.',
  ],
  home: [
    'Shop for your home and earn. Valid in-store or on pickup.',
    'Exclusive iView offer. Present at checkout.',
    'Plants, furniture, or supplies—earn on your purchase.',
    'Transform your space and collect coins. Visit us.',
    'One reward per visit. No minimum on select categories.',
  ],
  fashion: [
    'Refresh your wardrobe and earn. Valid on full-price and sale.',
    'Exclusive iView offer. Show at register.',
    'New arrivals and classics. Check in and get rewarded.',
    'Style upgrade with rewards. One per visit.',
    'Try on and buy—earn when you check in.',
  ],
  gifts: [
    'Find the perfect gift and earn. Valid for any purchase.',
    'Exclusive rewards for iView. Present at checkout.',
    'Thoughtful presents and bonus coins. Visit our store.',
    'One reward per visit. Great for last-minute or planned gifts.',
    'Gift wrap available. Check in to claim this offer.',
  ],
};

const REQUIRED_ACTIONS: Record<string, string[]> = {
  food_drink: [
    'Visit the restaurant and check in at the host stand or counter.',
    'Make a purchase of $15 or more and show this offer at checkout.',
    'Dine in and scan the QR code at your table to claim your reward.',
    'Order at the register and mention iView to earn.',
    'Complete your meal and leave a review in the app to unlock the reward.',
  ],
  shopping: [
    'Visit the store and check in at the entrance or register.',
    'Make any purchase and present this promotion at checkout.',
    'Scan the in-store QR code and complete the 30-second promo to earn.',
    'Spend $20 or more and show your iView app to the cashier.',
    'Browse and buy—check in when you arrive to claim.',
  ],
  entertainment: [
    'Check in at the venue entrance or box office.',
    'Purchase a ticket and show this offer to earn your reward.',
    'Scan the QR code inside and watch the short promo to claim.',
    'Arrive for your booking and check in on the iView app.',
    'Enjoy the experience and claim your reward before you leave.',
  ],
  health: [
    'Book and attend your appointment; check in at reception.',
    'Complete your visit and show this offer at the front desk.',
    'Arrive for your session and scan the QR code to earn.',
    'Mention iView when booking and check in on the day of your visit.',
    'Receive your service and claim your reward in the app.',
  ],
  services: [
    'Arrive for your appointment and check in at the front desk.',
    'Complete the service and present this offer to earn.',
    'Scan the QR code in-store and watch the short promo to claim.',
    'Mention iView when scheduling and check in when you arrive.',
    'Get the job done and claim your reward before you leave.',
  ],
  cafe: [
    'Order any drink or food and check in at the counter.',
    'Visit the café and scan the QR code on the table or counter.',
    'Make a purchase of $5 or more and show this offer.',
    'Grab your coffee and mention iView to the barista to earn.',
    'Stay for a bit and leave a review in the app to unlock the reward.',
  ],
  fitness: [
    'Check in at the front desk when you arrive for your workout.',
    'Complete a class or gym session and claim your reward in the app.',
    'Scan the QR code in the lobby and watch the short promo.',
    'Drop in or use your membership—check in to earn.',
    'Attend your first session or return visit and show this offer.',
  ],
  beauty: [
    'Book a service and check in when you arrive at the salon or spa.',
    'Complete your treatment and show this offer at the front desk.',
    'Scan the QR code in the waiting area to claim your reward.',
    'Mention iView when booking and check in on the day of your visit.',
    'Enjoy your service and claim your reward before you leave.',
  ],
  automotive: [
    'Bring your vehicle in and check in at the service desk.',
    'Complete the service and present this offer to earn.',
    'Mention iView when you drop off and check in in the app.',
    'Pick up your car and claim your reward before you leave.',
    'Scan the QR code in the waiting area and watch the short promo.',
  ],
  education: [
    'Attend your class or session and check in when you arrive.',
    'Complete your first lesson or workshop and show this offer.',
    'Enroll in a course and scan the QR code at the front desk.',
    'Mention iView when signing up and check in on the day.',
    'Finish your session and claim your reward in the app.',
  ],
  nightlife: [
    'Check in at the door or at the bar when you arrive.',
    'Make a purchase and show this offer to earn your reward.',
    'Scan the QR code at your table or the bar to claim.',
    'Enjoy the night and claim your reward before you leave.',
    'Mention iView to staff and check in in the app.',
  ],
  travel: [
    'Meet at the starting point and check in with your guide or desk.',
    'Start your tour or activity and show this offer to earn.',
    'Scan the QR code at the meeting point and watch the short promo.',
    'Book with iView mentioned and check in on the day of the experience.',
    'Complete your experience and claim your reward in the app.',
  ],
  home: [
    'Visit the store and check in at the entrance or checkout.',
    'Make a purchase and present this offer at the register.',
    'Scan the in-store QR code and complete the promo to earn.',
    'Spend $25 or more and show your iView app to claim.',
    'Browse and buy—check in when you arrive to unlock the reward.',
  ],
  fashion: [
    'Visit the store and check in at the entrance or fitting room.',
    'Make a purchase and show this offer at checkout to earn.',
    'Try on and buy—scan the QR code in-store to claim.',
    'Spend $30 or more and mention iView to the cashier.',
    'Complete your purchase and claim your reward in the app.',
  ],
  gifts: [
    'Visit the store and check in at the counter.',
    'Make any purchase and present this promotion to earn.',
    'Find the perfect gift and scan the QR code to claim.',
    'Spend $15 or more and show your iView app at checkout.',
    'Browse and buy—check in when you arrive to unlock.',
  ],
};

const STREET_NAMES = [
  'Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Park', 'Lake', 'River', 'Hill',
  'First', 'Second', 'Market', 'Broadway', 'Washington', 'Lincoln', 'Jefferson', 'Union',
  'Spring', 'Summer', 'Winter', 'Church', 'School', 'College', 'Central', 'Grand',
  'High', 'King', 'Queen', 'State', 'Liberty', 'Commerce', 'Industrial', 'Valley',
];

const STREET_SUFFIXES = ['St', 'Ave', 'Blvd', 'Dr', 'Ln', 'Way', 'Pl', 'Ct', 'Rd'];

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Placeholder image URL that is stable per promo (by id) for consistent UI */
export function getMockPromotionImageUrl(promoId: string, width = 400, height = 300): string {
  const seed = promoId.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}

/** Optional expiry: ~30% get an expiry 7–60 days from now */
function maybeExpiry(rng: () => number): string | null {
  if (rng() > 0.3) return null;
  const days = 7 + Math.floor(rng() * 54);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Optional limited claims: ~25% have max_claims */
function maybeLimitedClaims(rng: () => number): { current_claims: number; max_claims: number } | {} {
  if (rng() > 0.25) return {};
  const max = 50 + Math.floor(rng() * 200);
  const current = Math.floor(rng() * max * 0.7);
  return { current_claims: current, max_claims: max };
}

export interface GenerateLocalPromotionsOptions {
  /** Include image_url for each promotion */
  includeImageUrl?: boolean;
  /** Include expires_at for some promotions */
  includeExpiry?: boolean;
  /** Include current_claims / max_claims for some promotions */
  includeClaims?: boolean;
  /** Fraction of promos that are "featured" (higher reward, both coins) 0..1 */
  featuredRatio?: number;
  /** Optional city/region name for address line (e.g. "New York") */
  cityName?: string;
}

const DEFAULT_OPTIONS: GenerateLocalPromotionsOptions = {
  includeImageUrl: true,
  includeExpiry: true,
  includeClaims: true,
  featuredRatio: 0.08,
};

/**
 * Generate local mock promotions around a center point.
 * Deterministic for the same (centerLat, centerLng, count, startId) and options.
 */
export function generateLocalPromotions(
  centerLat: number,
  centerLng: number,
  count: number,
  startId: number = 0,
  options: GenerateLocalPromotionsOptions = {}
): MockPromotion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const promotions: MockPromotion[] = [];
  const radiusDegrees = 0.145; // ~10 miles at mid-latitudes

  for (let i = 0; i < count; i++) {
    const seed = hashSeed(centerLat, centerLng, startId, i);
    const rng = seededRandom(seed);

    const angle = rng() * 2 * Math.PI;
    const distance = Math.sqrt(rng()) * radiusDegrees;
    const lat = centerLat + distance * Math.cos(angle);
    const lng = centerLng + (distance * Math.sin(angle)) / Math.cos((centerLat * Math.PI) / 180);

    const category = pick(rng, CATEGORY_IDS);
    const names = BUSINESS_NAMES_BY_CATEGORY[category] ?? BUSINESS_NAMES_BY_CATEGORY.shopping;
    const businessName = pick(rng, names);
    const descs = DESCRIPTIONS_BY_CATEGORY[category] ?? DESCRIPTIONS_BY_CATEGORY.shopping;
    const actions = REQUIRED_ACTIONS[category] ?? REQUIRED_ACTIONS.shopping;

    const isFeatured = rng() < (opts.featuredRatio ?? 0);
    const rewardType = isFeatured ? 'both' : pick(rng, REWARD_TYPES);
    const baseAmount = isFeatured ? 150 + Math.floor(rng() * 250) : 50 + Math.floor(rng() * 350);
    const reward_amount = Math.min(500, baseAmount);

    const street = pick(rng, STREET_NAMES);
    const suffix = pick(rng, STREET_SUFFIXES);
    const number = Math.floor(rng() * 9999) + 1;
    const address = opts.cityName
      ? `${number} ${street} ${suffix}, ${opts.cityName}`
      : `${number} ${street} ${suffix}`;

    const id = `local-${startId + i}`;
    const promo: MockPromotion = {
      id,
      business_name: businessName,
      description: pick(rng, descs),
      reward_type: rewardType,
      reward_amount,
      required_action: pick(rng, actions),
      latitude: lat,
      longitude: lng,
      address,
      category,
      ...(opts.includeImageUrl ? { image_url: getMockPromotionImageUrl(id) } : {}),
      ...(opts.includeExpiry ? { expires_at: maybeExpiry(rng) } : {}),
      ...(opts.includeClaims ? maybeLimitedClaims(rng) : {}),
      ...(isFeatured ? { is_featured: true } : {}),
    };
    promotions.push(promo);
  }

  return promotions;
}

export interface GlobalCity {
  name: string;
  lat: number;
  lng: number;
  /** Promos per city */
  count?: number;
}

const GLOBAL_CITIES: GlobalCity[] = [
  { name: 'New York', lat: 40.7128, lng: -74.006, count: 55 },
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437, count: 50 },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, count: 45 },
  { name: 'Houston', lat: 29.7604, lng: -95.3698, count: 40 },
  { name: 'Phoenix', lat: 33.4484, lng: -112.074, count: 38 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652, count: 42 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936, count: 35 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611, count: 45 },
  { name: 'Dallas', lat: 32.7767, lng: -96.797, count: 42 },
  { name: 'San Jose', lat: 37.3382, lng: -121.8863, count: 40 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431, count: 42 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557, count: 35 },
  { name: 'London', lat: 51.5074, lng: -0.1278, count: 60 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522, count: 55 },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, count: 65 },
  { name: 'Sydney', lat: -33.8688, lng: 151.2093, count: 45 },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, count: 50 },
  { name: 'Singapore', lat: 1.3521, lng: 103.8198, count: 48 },
  { name: 'Mumbai', lat: 19.076, lng: 72.8777, count: 55 },
  { name: 'São Paulo', lat: -23.5505, lng: -46.6333, count: 50 },
  { name: 'Mexico City', lat: 19.4326, lng: -99.1332, count: 52 },
  { name: 'Berlin', lat: 52.52, lng: 13.405, count: 48 },
  { name: 'Seoul', lat: 37.5665, lng: 126.978, count: 58 },
  { name: 'Bangkok', lat: 13.7563, lng: 100.5018, count: 45 },
  { name: 'Toronto', lat: 43.6532, lng: -79.3832, count: 45 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038, count: 42 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964, count: 45 },
  { name: 'Istanbul', lat: 41.0082, lng: 28.9784, count: 48 },
  { name: 'Beijing', lat: 39.9042, lng: 116.4074, count: 55 },
  { name: 'Shanghai', lat: 31.2304, lng: 121.4737, count: 55 },
  { name: 'Hong Kong', lat: 22.3193, lng: 114.1694, count: 50 },
];

/**
 * Generate global mock promotions across multiple cities.
 * Deterministic per run (same cities and counts).
 */
export function generateGlobalPromotions(
  options: GenerateLocalPromotionsOptions = {}
): MockPromotion[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let all: MockPromotion[] = [];
  let idCounter = 0;

  for (const city of GLOBAL_CITIES) {
    const count = city.count ?? 50;
    const cityPromos = generateLocalPromotions(
      city.lat,
      city.lng,
      count,
      idCounter,
      { ...opts, cityName: city.name }
    );
    all = all.concat(cityPromos);
    idCounter += count;
  }

  return all;
}

/** Featured demo spot shown near the user on the map */
export const MOCK_CLIENT_SPOT_ID = 'mock-client-iview-demo';

export function createMockClientSpot(lat: number, lng: number): MockPromotion {
  return {
    id: MOCK_CLIENT_SPOT_ID,
    business_name: 'iView Demo Store',
    description:
      'Experience the full iView check-in flow! Visit, scan the QR code, complete the actions, and earn rewards.',
    reward_type: 'both',
    reward_amount: 250,
    required_action:
      'Check in, scan the QR code, and watch the 30-second promo to earn your reward.',
    latitude: lat + 0.002,
    longitude: lng + 0.001,
    address: 'Near You',
    category: 'entertainment',
    image_url: getMockPromotionImageUrl(MOCK_CLIENT_SPOT_ID),
    is_featured: true,
  };
}
