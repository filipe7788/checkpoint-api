// Game Status
const GAME_STATUS = {
  OWNED: 'owned',
  PLAYING: 'playing',
  COMPLETED: 'completed',
  WANT_TO_PLAY: 'want_to_play',
  DROPPED: 'dropped',
  BACKLOG: 'backlog',
};

// User Roles
const USER_ROLE = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
};

// Activity Types
const ACTIVITY_TYPE = {
  STARTED_PLAYING: 'started_playing',
  COMPLETED: 'completed',
  REVIEWED: 'reviewed',
  LIKED_REVIEW: 'liked_review',
  FOLLOWED_USER: 'followed_user',
};

// Rating Range
const RATING = {
  MIN: 1,
  MAX: 5,
};

// Pagination
const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

module.exports = {
  GAME_STATUS,
  USER_ROLE,
  ACTIVITY_TYPE,
  RATING,
  PAGINATION,
};
