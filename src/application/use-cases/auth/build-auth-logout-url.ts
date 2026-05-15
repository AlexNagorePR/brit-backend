import type { AuthenticationProvider } from '@/application/ports/authentication-provider.js';

export class BuildAuthLogoutUrl {
  constructor(private readonly authenticationProvider: AuthenticationProvider) {}

  execute(): string {
    return this.authenticationProvider.createLogoutUrl();
  }
}
