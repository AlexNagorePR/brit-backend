import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationProvider } from '@/application/ports/authentication-provider.js';
import { BuildAuthLogoutUrl } from '@/application/use-cases/auth/build-auth-logout-url.js';
import { CompleteAuthCallback } from '@/application/use-cases/auth/complete-auth-callback.js';
import {
  AuthCallbackRejectedError,
  ExpiredAuthStateError,
  InvalidAuthStateError,
} from '@/application/use-cases/auth/errors.js';
import { StartAuthLogin } from '@/application/use-cases/auth/start-auth-login.js';

function createAuthenticationProvider(
  overrides: Partial<AuthenticationProvider> = {}
): AuthenticationProvider {
  return {
    createLoginChallenge: vi.fn(() => ({
      state: 'state-1',
      nonce: 'nonce-1',
      createdAt: 1_000,
    })),
    createAuthorizationUrl: vi.fn(() => 'https://auth.example/authorize'),
    readCallbackParams: vi.fn(),
    completeCallback: vi.fn(async () => ({
      subject: 'subject-1',
      email: 'user@example.com',
      groups: ['allowed', 'admin'],
      claims: {},
    })),
    createLogoutUrl: vi.fn(() => 'https://auth.example/logout'),
    ...overrides,
  };
}

describe('auth use cases', () => {
  it('starts login with an authorization URL and pending challenge', () => {
    const provider = createAuthenticationProvider();
    const useCase = new StartAuthLogin(provider);

    const result = useCase.execute();

    expect(result).toEqual({
      authorizationUrl: 'https://auth.example/authorize',
      challenge: {
        state: 'state-1',
        nonce: 'nonce-1',
        createdAt: 1_000,
      },
    });
    expect(provider.createAuthorizationUrl).toHaveBeenCalledWith(result.challenge);
  });

  it('completes callback for an allowed user', async () => {
    const provider = createAuthenticationProvider();
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
    });

    const result = await useCase.execute({
      params: { state: 'state-1', code: 'code-1' },
      pending: {
        state: 'state-1',
        nonce: 'nonce-1',
        createdAt: 1_000,
      },
      now: 2_000,
    });

    expect(provider.completeCallback).toHaveBeenCalledWith({
      redirectUri: 'http://localhost/auth/callback',
      params: { state: 'state-1', code: 'code-1' },
      checks: {
        state: 'state-1',
        nonce: 'nonce-1',
      },
    });
    expect(result).toEqual({
      kind: 'authenticated',
      state: 'state-1',
      account: {
        _id: 'user@example.com',
        email: 'user@example.com',
        admin: true,
        verified: true,
        created: new Date(2_000),
      },
    });
  });

  it('falls back to subject when identity has no email', async () => {
    const provider = createAuthenticationProvider({
      completeCallback: vi.fn(async () => ({
        subject: 'subject-1',
        groups: ['allowed'],
        claims: {},
      })),
    });
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
    });

    const result = await useCase.execute({
      params: { state: 'state-1' },
      pending: {
        state: 'state-1',
        nonce: 'nonce-1',
        createdAt: 1_000,
      },
      now: 2_000,
    });

    expect(result).toMatchObject({
      kind: 'authenticated',
      account: {
        _id: 'subject-1',
        email: '',
        admin: false,
      },
    });
  });

  it('returns not_allowed when identity lacks allowed group', async () => {
    const provider = createAuthenticationProvider({
      completeCallback: vi.fn(async () => ({
        subject: 'subject-1',
        email: 'user@example.com',
        groups: [],
        claims: {},
      })),
    });
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
    });

    await expect(
      useCase.execute({
        params: { state: 'state-1' },
        pending: {
          state: 'state-1',
          nonce: 'nonce-1',
          createdAt: 1_000,
        },
        now: 2_000,
      })
    ).resolves.toEqual({
      kind: 'not_allowed',
      state: 'state-1',
    });
  });

  it('rejects callback errors from the identity provider', async () => {
    const provider = createAuthenticationProvider();
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
    });

    await expect(
      useCase.execute({
        params: { state: 'state-1', error: 'access_denied' },
        pending: {
          state: 'state-1',
          nonce: 'nonce-1',
          createdAt: 1_000,
        },
      })
    ).rejects.toBeInstanceOf(AuthCallbackRejectedError);
    expect(provider.completeCallback).not.toHaveBeenCalled();
  });

  it('rejects callbacks without a matching pending state', async () => {
    const provider = createAuthenticationProvider();
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
    });

    await expect(
      useCase.execute({
        params: { state: 'unknown-state' },
        pending: undefined,
      })
    ).rejects.toBeInstanceOf(InvalidAuthStateError);
    expect(provider.completeCallback).not.toHaveBeenCalled();
  });

  it('rejects expired pending states', async () => {
    const provider = createAuthenticationProvider();
    const useCase = new CompleteAuthCallback(provider, {
      redirectUri: 'http://localhost/auth/callback',
      stateTtlMs: 500,
    });

    await expect(
      useCase.execute({
        params: { state: 'state-1' },
        pending: {
          state: 'state-1',
          nonce: 'nonce-1',
          createdAt: 1_000,
        },
        now: 1_501,
      })
    ).rejects.toBeInstanceOf(ExpiredAuthStateError);
    expect(provider.completeCallback).not.toHaveBeenCalled();
  });

  it('builds the logout URL through the provider', () => {
    const provider = createAuthenticationProvider();
    const useCase = new BuildAuthLogoutUrl(provider);

    expect(useCase.execute()).toBe('https://auth.example/logout');
  });
});
