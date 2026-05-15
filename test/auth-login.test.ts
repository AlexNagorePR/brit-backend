import { beforeEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';

const mockLogin = vi.hoisted(() =>
  vi.fn((req: any, res: any, opts: any) => {
    req.session.user = opts.account;
    return res.redirect(opts.redirect);
  })
);

vi.mock('@/server/auth.js', () => ({
  login: mockLogin,
  requireLogin: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (req: any, _res: any, next: any) => next(),
}));

import { createApp } from '@/server/app.js';

describe('Auth', () => {
  beforeEach(() => {
    mockLogin.mockClear();
  });

  it('GET /auth/login redirects to the identity provider', async () => {
    const oidcClient = {
      authorizationUrl: ({ state, nonce }: any) =>
        `http://example/authorize?state=${state}&nonce=${nonce}`,
    };

    const app = createApp({ oidcClient });

    const res = await request(app).get('/auth/login').expect(302);
    expect(res.headers.location).toMatch(/^http:\/\/example\/authorize\?/);
  });

  it('GET /auth/callback exchanges an allowed identity and logs in', async () => {
    let pendingChallenge: { state: string; nonce: string } | undefined;
    const oidcClient = {
      authorizationUrl: vi.fn(({ state, nonce }: any) => {
        pendingChallenge = { state, nonce };
        return `http://example/authorize?state=${state}&nonce=${nonce}`;
      }),
      callbackParams: vi.fn((req: any) => req.query),
      callback: vi.fn(async () => ({
        claims: () => ({
          sub: 'subject-1',
          email: 'user@example.com',
          'cognito:groups': ['allowed', 'admin'],
        }),
      })),
    };
    const app = createApp({ oidcClient });
    const agent = request.agent(app);

    await agent.get('/auth/login').expect(302);
    expect(pendingChallenge).toBeDefined();

    const res = await agent
      .get(`/auth/callback?state=${pendingChallenge!.state}&code=code-1`)
      .expect(302);

    expect(res.headers.location).toBe('http://localhost:5173/');
    expect(oidcClient.callback).toHaveBeenCalledWith(
      'http://localhost/auth/callback',
      { state: pendingChallenge!.state, code: 'code-1' },
      {
        state: pendingChallenge!.state,
        nonce: pendingChallenge!.nonce,
      }
    );
    expect(mockLogin).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      {
        account: {
          _id: 'user@example.com',
          email: 'user@example.com',
          admin: true,
          verified: true,
          created: expect.any(Date),
        },
        redirect: 'http://localhost:5173/',
      }
    );
  });
});
