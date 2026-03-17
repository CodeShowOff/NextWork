import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(4000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BREVO_API_KEY: Joi.string().optional(),
  BREVO_API_BASE_URL: Joi.string().uri().optional(),
  BREVO_SENDER_EMAIL: Joi.string().email().optional(),
  BREVO_SENDER_NAME: Joi.string().max(120).optional(),
  AUTH_DEBUG_TOKEN_EXPOSE: Joi.string().optional(),
  INVITE_LINK_BASE_URL: Joi.string().optional(),
  POST_SHARE_BASE_URL: Joi.string().optional(),
  LOG_SLOW_REQUEST_MS: Joi.number().integer().min(100).default(1200),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(10).default(120),
  RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().min(1).default(60),
});
