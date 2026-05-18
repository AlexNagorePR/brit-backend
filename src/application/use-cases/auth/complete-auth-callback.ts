import type {
  AuthenticationProvider,
  AuthCallbackParams,
  AuthLoginChallenge,
} from '@/application/ports/authentication-provider.js';
import type { AuthenticatedAccount } from './authenticated-account.js';
import {
  AuthCallbackRejectedError,
  ExpiredAuthStateError,
  InvalidAuthStateError,
} from './errors.js';

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;

export type CompleteAuthCallbackCommand = {
  params: AuthCallbackParams;
  pending?: AuthLoginChallenge;
  now?: Date | number;
};

export type CompleteAuthCallbackResult =
  | {
      kind: 'authenticated';
      state: string;
      account: AuthenticatedAccount;
    }
  | {
      kind: 'not_allowed';
      state: string;
    };

export class CompleteAuthCallback {
  private readonly stateTtlMs: number;

  constructor(
    private readonly authenticationProvider: AuthenticationProvider,
    private readonly options: { redirectUri: string; stateTtlMs?: number }
  ) {
    this.stateTtlMs = options.stateTtlMs ?? DEFAULT_STATE_TTL_MS;
  }

  async execute(command: CompleteAuthCallbackCommand): Promise<CompleteAuthCallbackResult> {
    if (command.params.error) {
      throw new AuthCallbackRejectedError(String(command.params.error));
    }

    const returnedState = this.getReturnedState(command.params);
    if (!returnedState || !command.pending || command.pending.state !== returnedState) {
      throw new InvalidAuthStateError(returnedState);
    }

    const now = this.toTimestamp(command.now);
    if (now - command.pending.createdAt > this.stateTtlMs) {
      throw new ExpiredAuthStateError(returnedState);
    }

    const identity = await this.authenticationProvider.completeCallback({
      redirectUri: this.options.redirectUri,
      params: command.params,
      checks: {
        state: returnedState,
        nonce: command.pending.nonce,
      },
    });

    if (!identity.groups.includes('allowed')) {
      return {
        kind: 'not_allowed',
        state: returnedState,
      };
    }

    const userId = getStringClaim(identity.claims, 'cognito:username') || identity.subject || identity.email || '';

    return {
      kind: 'authenticated',
      state: returnedState,
      account: {
        _id: userId,
        email: identity.email || '',
        admin: identity.groups.includes('admin'),
        verified: true,
        created: new Date(now),
      },
    };
  }

  private getReturnedState(params: AuthCallbackParams): string | undefined {
    return typeof params.state === 'string' ? params.state : undefined;
  }

  private toTimestamp(value?: Date | number): number {
    if (value instanceof Date) {
      return value.getTime();
    }

    return typeof value === 'number' ? value : Date.now();
  }
}

function getStringClaim(claims: Record<string, unknown>, key: string): string | undefined {
  const value = claims[key];
  return typeof value === 'string' ? value : undefined;
}
