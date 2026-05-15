import express, { Router } from 'express';
import { generators } from 'openid-client';
import utils from '@transitive-sdk/utils';
import { login } from '@/server/auth.js';

const log = utils.getLogger('routes/auth');

type OidcClientLike = {
  authorizationUrl(args: any): string;
  callbackParams(req: any): any;
  callback(redirectUri: string, params: any, checks: any): Promise<{ claims(): any }>;
};

export function createAuthRouter(config: any, oidcClient?: OidcClientLike) {
  const router = Router();

  // OIDC login
  /**
   * @swagger
   * /auth/login:
   *   get:
   *     summary: Start OIDC authentication flow
   *     description: Initiates the OpenID Connect login flow with Cognito
   *     tags:
   *       - Authentication
   *     responses:
   *       302:
   *         description: Redirects to Cognito authentication server
   *       500:
   *         description: OIDC client not initialized
   */
  router.get('/login', (req: any, res) => {
    if (!oidcClient) return res.status(500).send('OIDC client not initialized');

    const nonce = generators.nonce();
    const state = generators.state();

    req.session.oidc ||= {};
    req.session.oidc.pending ||= {};
    req.session.oidc.pending[state] = { nonce, ts: Date.now() };

    const authUrl = oidcClient.authorizationUrl({
      scope: 'email openid phone',
      state,
      nonce,
    });

    return res.redirect(authUrl);
  });

  // OIDC callback
  /**
   * @swagger
   * /auth/callback:
   *   get:
   *     summary: OIDC authentication callback
   *     description: Callback endpoint for OIDC authentication. Validates the token and establishes the session
   *     tags:
   *       - Authentication
   *     parameters:
   *       - in: query
   *         name: code
   *         required: true
   *         schema:
   *           type: string
   *         description: Authorization code from Cognito
   *       - in: query
   *         name: state
   *         required: true
   *         schema:
   *           type: string
   *         description: State parameter for CSRF validation
   *       - in: query
   *         name: error
   *         schema:
   *           type: string
   *         description: Error code if authentication failed
   *     responses:
   *       302:
   *         description: Redirects to postLoginRedirectUrl on success
   *       400:
   *         description: Invalid state, expired login, or OIDC error
   *       500:
   *         description: OIDC client not initialized or callback error
   */
  router.get('/callback', async (req: any, res) => {
    try {
      if (!oidcClient) return res.status(500).send('OIDC client not initialized');

      if (req.query?.error) {
        log.error('OIDC error on callback', req.query);
        return res.status(400).send(`OIDC error: ${req.query.error}`);
      }

      const params = oidcClient.callbackParams(req);
      const returnedState = params.state;

      const pending = req.session?.oidc?.pending?.[returnedState];
      if (!pending) {
        log.warn('OIDC callback with unknown/expired state', { returnedState });
        return res.status(400).send('Invalid/expired state. Please try again.');
      }

      const OIDC_STATE_TTL_MS = 10 * 60 * 1000;
      if (Date.now() - pending.ts > OIDC_STATE_TTL_MS) {
        if (req.session?.oidc?.pending) delete req.session.oidc.pending[returnedState];
        return res.status(400).send('Login expired. Please try again.');
      }

      if (req.session?.oidc?.pending) delete req.session.oidc!.pending![returnedState];

      const tokenSet = await oidcClient.callback(
        config.cognitoRedirectUri,
        params,
        { nonce: pending.nonce, state: returnedState }
      );

      const claims = tokenSet.claims();
      const groups: string[] = (claims['cognito:groups'] as string[]) || [];

      if (!groups.includes('allowed')) {
        return req.session.destroy(() => {
          res.clearCookie('connect.sid');
          return res.redirect(`${config.postLoginRedirectUrl}?error=not_allowed`)
        });
      }

      const email = claims.email as string;
      const userId = email || (claims.sub as string);

      const accountLike = {
        _id: userId,
        email: email || '',
        admin: groups.includes('admin'),
        verified: true,
        created: new Date(),
      };

      return login(req, res, { account: accountLike, redirect: config.postLoginRedirectUrl });
    } catch (err: any) {
      if (res.headersSent) {
        log.error('Callback error after headers sent', err);
        return;
      }
      log.error('Callback error', err);
      return res.status(500).send(`Callback error: ${err?.message || err}`);
    }
  });

  // Logout
  /**
   * @swagger
   * /auth/logout:
   *   get:
   *     summary: Logout the current user
   *     description: Destroys the user session and redirects to Cognito logout
   *     tags:
   *       - Authentication
   *     responses:
   *       302:
   *         description: Redirects to Cognito logout endpoint
   */
  router.get('/logout', (req: any, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      const url =
        `https://${config.cognitoDomain}/logout` +
        `?client_id=${encodeURIComponent(config.cognitoClientId)}` +
        `&logout_uri=${encodeURIComponent(config.cognitoLogoutUri)}`;
      return res.redirect(url);
    });
  });

  return router;
}
