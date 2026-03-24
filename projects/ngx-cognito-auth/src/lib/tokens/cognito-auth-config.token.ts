import { InjectionToken } from '@angular/core';
import { CognitoAuthConfig } from '../interfaces/cognito-auth-config.interface';

export const COGNITO_AUTH_CONFIG = new InjectionToken<CognitoAuthConfig>(
  'COGNITO_AUTH_CONFIG'
);
