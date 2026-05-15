import { Router, type Request } from 'express';
import utils from '@transitive-sdk/utils';
import type { AuthenticationProvider } from '@/application/ports/authentication-provider.js';
import type { BuildAuthLogoutUrl } from '@/application/use-cases/auth/build-auth-logout-url.js';
import type { CompleteAuthCallback } from '@/application/use-cases/auth/complete-auth-callback.js';
import {
  AuthCallbackRejectedError,
  AuthProviderUnavailableError,
  ExpiredAuthStateError,
  InvalidAuthStateError,
} from '@/application/use-cases/auth/errors.js';
import type { StartAuthLogin } from '@/application/use-cases/auth/start-auth-login.js';
import { login } from '@/server/auth.js';

const log = utils.getLogger('routes/auth');

type AuthRouterConfig = {
  postLoginRedirectUrl: string;
};

export type AuthRouterDeps = {
  readCallbackParams: AuthenticationProvider['readCallbackParams'];
  startAuthLogin: StartAuthLogin;
  completeAuthCallback: CompleteAuthCallback;
  buildAuthLogoutUrl: BuildAuthLogoutUrl;
};

export function createAuthRouter(
  config: AuthRouterConfig,
  deps: AuthRouterDeps
) {
  const router = Router();

  // OIDC login
  /**
   * @swagger
   * /auth/login:
   *   get:
   *     summary: Start OIDC authentication flow
   *     description: Initiates the OpenID Connect login flow with the identity provider
   *     tags:
   *       - Authentication
   *     responses:
   *       302:
   *         description: Redirects to the identity provider authentication server
   *       500:
   *         description: OIDC client not initialized
   */
  router.get('/login', (req: any, res) => {
    try {
      const result = deps.startAuthLogin.execute();

      req.session.oidc ||= {};
      req.session.oidc.pending ||= {};
      req.session.oidc.pending[result.challenge.state] = result.challenge;

      return res.redirect(result.authorizationUrl);
    } catch (err) {
      if (err instanceof AuthProviderUnavailableError) {
        return res.status(500).send(err.message);
      }

      log.error('Login error', err);
      return res.status(500).send(`Login error: ${(err as Error)?.message || err}`);
    }
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
   *         description: Authorization code from the identity provider
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
      const params = deps.readCallbackParams(req);
      const returnedState = typeof params.state === 'string' ? params.state : undefined;
      const pending = returnedState ? req.session?.oidc?.pending?.[returnedState] : undefined;

      const result = await deps.completeAuthCallback.execute({ params, pending });
      deletePendingState(req, result.state);

      if (result.kind === 'not_allowed') {
        return req.session.destroy(() => {
          res.clearCookie('connect.sid');
          return res.redirect(`${config.postLoginRedirectUrl}?error=not_allowed`);
        });
      }

      return login(req, res, {
        account: result.account,
        redirect: config.postLoginRedirectUrl,
      });
    } catch (err: any) {
      if (res.headersSent) {
        log.error('Callback error after headers sent', err);
        return;
      }

      if (err instanceof AuthProviderUnavailableError) {
        return res.status(500).send(err.message);
      }

      if (err instanceof AuthCallbackRejectedError) {
        log.error('OIDC error on callback', req.query);
        return res.status(400).send(err.message);
      }

      if (err instanceof InvalidAuthStateError) {
        log.warn('OIDC callback with unknown/expired state', { returnedState: err.state });
        return res.status(400).send(err.message);
      }

      if (err instanceof ExpiredAuthStateError) {
        deletePendingState(req, err.state);
        return res.status(400).send(err.message);
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
   *     description: Destroys the user session and redirects to the identity provider logout
   *     tags:
   *       - Authentication
   *     responses:
   *       302:
   *         description: Redirects to the identity provider logout endpoint
   */
  router.get('/logout', (req: any, res) => {
    const logoutUrl = deps.buildAuthLogoutUrl.execute();

    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      return res.redirect(logoutUrl);
    });
  });

  return router;
}

function deletePendingState(req: Request, state: string) {
  if (req.session?.oidc?.pending) {
    delete req.session.oidc.pending[state];
  }
}
