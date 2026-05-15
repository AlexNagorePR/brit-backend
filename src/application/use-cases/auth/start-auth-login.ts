import type {
  AuthenticationProvider,
  AuthLoginChallenge,
} from '@/application/ports/authentication-provider.js';

export type StartAuthLoginResult = {
  authorizationUrl: string;
  challenge: AuthLoginChallenge;
};

export class StartAuthLogin {
  constructor(private readonly authenticationProvider: AuthenticationProvider) {}

  execute(): StartAuthLoginResult {
    const challenge = this.authenticationProvider.createLoginChallenge();

    return {
      authorizationUrl: this.authenticationProvider.createAuthorizationUrl(challenge),
      challenge,
    };
  }
}
