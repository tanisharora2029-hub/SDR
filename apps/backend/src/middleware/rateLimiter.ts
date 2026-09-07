import rateLimit from "express-rate-limit";

// Rate limit for authentication attempts (brute-force defense)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many authentication attempts. Please try again in 15 minutes."
  }
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Rate limit exceeded. Please throttle your requests."
  }
});

// Dedicated limiter for interactive phone / TTS generation
export const voiceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 speech syntheses per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Voice synthesis rate limit reached. Please wait a moment."
  }
});