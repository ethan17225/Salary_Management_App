import { z } from 'zod';

const envSchema = z.object({
  BACKEND_URL: z.string().url().default('http://127.0.0.1:8001'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse({
  BACKEND_URL: process.env.BACKEND_URL || undefined,
  NODE_ENV: process.env.NODE_ENV || undefined,
});

