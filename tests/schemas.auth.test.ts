import { describe, expect, it } from 'vitest';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from '../api/schemas/auth.schema';

describe('auth schemas', () => {
  it('validates and sanitizes register payload', () => {
    const payload = registerSchema.parse({
      email: 'user@example.com',
      password: 'password123',
      name: '<b>Alice</b>',
    });

    expect(payload.email).toBe('user@example.com');
    expect(payload.name).toBe('Alice');
  });

  it('rejects short register password', () => {
    expect(() =>
      registerSchema.parse({
        email: 'user@example.com',
        password: 'short',
        name: 'Alice',
      })
    ).toThrow();
  });

  it('validates login/refresh/logout payloads', () => {
    expect(
      loginSchema.parse({
        email: 'user@example.com',
        password: 'p',
      })
    ).toEqual({
      email: 'user@example.com',
      password: 'p',
    });

    expect(refreshSchema.parse({ refreshToken: 'token' }).refreshToken).toBe('token');
    expect(logoutSchema.parse({ refreshToken: 'token' }).refreshToken).toBe('token');
  });
});
