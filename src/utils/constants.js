import locationsData from './india_states_districts.json';

/**
 * constants.js
 * Central source of truth for all dropdown options, location hierarchy,
 * program areas, and stakeholder types used across the app.
 */

// Program areas that The/Nudge Institute operates in
export const PROGRAM_AREAS = [
  'Agriculture',
  'Skilling',
  'Livelihood',
  'Health',
  'Education',
  'WASH',
  'Governance',
];

// Types of stakeholders a field officer might meet
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

// Location hierarchy: State → District
// Loaded from all states and districts of India JSON
export const LOCATIONS = {};
locationsData.states.forEach((item) => {
  LOCATIONS[item.state] = item.districts;
});

// Helper: Get all states as a flat array
export const getStates = () => Object.keys(LOCATIONS);

// Helper: Get districts for a given state
export const getDistricts = (state) => {
  if (!state || !LOCATIONS[state]) return [];
  return LOCATIONS[state];
};

// Helper: Get blocks (stubbed, block is now a text field)
export const getBlocks = () => [];

// Roles available in the app
export const ROLES = {
  FIELD_OFFICER: 'field_officer',
  MANAGER: 'manager',
};

// Sentiment types for consistency across the app
export const SENTIMENTS = {
  POSITIVE: 'positive',
  MIXED: 'mixed',
  NEGATIVE: 'negative',
};

// Blocker severity levels
export const SEVERITY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};
