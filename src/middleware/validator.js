const Joi = require('joi');
const { ValidationError } = require('../utils/errors');
const { VALID_GAME_STATUSES } = require('../utils/constants');

function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const message = error.details.map(detail => detail.message).join(', ');
      return next(new ValidationError(message));
    }

    req[property] = value;
    next();
  };
}

// Common validation schemas
const schemas = {
  // Auth schemas
  register: Joi.object({
    email: Joi.string().email().required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).required(),
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required(),
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required(),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),

  // User schemas
  updateProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(30),
    bio: Joi.string().max(500).allow(''),
    avatar: Joi.string().uri().allow(''),
  }),

  // Library schemas
  addToLibrary: Joi.object({
    igdbId: Joi.number().integer().required(),
    status: Joi.string()
      .valid(...VALID_GAME_STATUSES)
      .required(),
    platform: Joi.string().required(),
    playtime: Joi.number().integer().min(0),
    startedAt: Joi.date().iso(),
    completedAt: Joi.date().iso(),
    favorite: Joi.boolean(),
  }),

  updateLibraryItem: Joi.object({
    status: Joi.string().valid(...VALID_GAME_STATUSES),
    playtime: Joi.number().integer().min(0),
    lastPlayedAt: Joi.date().iso().allow(null),
    startedAt: Joi.date().iso().allow(null),
    completedAt: Joi.date().iso().allow(null),
    favorite: Joi.boolean(),
  }),

  // Review schemas
  createReview: Joi.object({
    userGameId: Joi.string().uuid().required(),
    rating: Joi.number().min(1).max(5).required(),
    text: Joi.string().max(5000).allow(''),
    containsSpoilers: Joi.boolean(),
  }),

  updateReview: Joi.object({
    rating: Joi.number().min(1).max(5),
    text: Joi.string().max(5000).allow(''),
    containsSpoilers: Joi.boolean(),
  }),

  // Query params
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),

  gameSearch: Joi.object({
    q: Joi.string().min(2).required(),
    limit: Joi.number().integer().min(1).max(50).default(10),
  }),

  libraryFilter: Joi.object({
    status: Joi.string().valid(...VALID_GAME_STATUSES),
    platform: Joi.string(),
    favorite: Joi.boolean(),
  }),

  // Report schemas
  createReport: Joi.object({
    type: Joi.string().valid('review', 'reply').required(),
    targetId: Joi.string().uuid().required(),
    reason: Joi.string().valid('spam', 'offensive', 'inappropriate', 'harassment', 'other').required(),
    description: Joi.string().max(500).allow(''),
  }),
};

module.exports = {
  validate,
  schemas,
};
