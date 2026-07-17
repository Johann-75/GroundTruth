/**
 * constants.js
 * Central source of truth for dropdown options, location hierarchy,
 * program areas, and stakeholder types used across the app.
 */


import locationsData from './india_states_districts.json';

// Languages supported for dynamically translated UI
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'gu', name: 'ગુજરાતી (Gujarati)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' },
  { code: 'or', name: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'ur', name: 'اردو (Urdu)' },
  { code: 'as', name: 'অસમীয়া (Assamese)' },
  { code: 'kok', name: 'कोंकणी (Konkani)' },
  { code: 'mai', name: 'मैथिली (Maithili)' },
  { code: 'ne', name: 'नेपाली (Nepali)' },
  { code: 'sa', name: 'संस्कृतम् (Sanskrit)' },
  { code: 'sd', name: 'सिंधी (Sindhi)' }
];

/** Retrieve current translation language from cookies */
export const getTranslationLanguage = () => {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  return match ? match[1] : 'en';
};

// Navigation items configuration per role
export const NAV_ITEMS = {
  field_officer: [
    { to: '/new-visit', label: 'New Visit', iconName: 'PlusCircle' },
    { to: '/my-visits', label: 'Visits',    iconName: 'ClipboardList' },
    { to: '/settings',  label: 'Settings',  iconName: 'Settings' },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard', iconName: 'LayoutDashboard' },
    { to: '/map',       label: 'View Map',  iconName: 'Map' },
    { to: '/my-visits', label: 'Visits',    iconName: 'ClipboardList' },
    { to: '/settings',  label: 'Settings',  iconName: 'Settings' },
  ],
};

// Program areas tracked across field visits
export const PROGRAM_AREAS = [
  'Agriculture',
  'Skilling',
  'Livelihood',
  'Health',
  'Education',
  'WASH',
  'Governance',
];

// Types of stakeholders a field officer might meet during a visit
export const STAKEHOLDER_TYPES = [
  'Community Members',
  'Gram Panchayat',
  'SHG Members',
  'Program Staff',
  'Government Officials',
  'Youth/Trainees',
  'Teachers',
  'Health Workers',
  'Other',
];

// Location hierarchy: State → District[]
export const LOCATIONS = {};
locationsData.states.forEach((item) => {
  LOCATIONS[item.state] = item.districts;
});

/** Returns all state names as a sorted array. */
export const getStates = () => Object.keys(LOCATIONS);

/** Returns district names for a given state, or [] if not found. */
export const getDistricts = (state) => (state && LOCATIONS[state]) ? LOCATIONS[state] : [];

// User roles
export const ROLES = {
  FIELD_OFFICER: 'field_officer',
  MANAGER: 'manager',
};

// Shared sentiment colour map (used in Dashboard and Map)
export const SENTIMENT_COLORS = {
  positive: '#10B981',
  mixed:    '#F59E0B',
  negative: '#EF4444',
};

