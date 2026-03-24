import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';
import { environment } from './environments/environment';
import {
  provideCognitoAuth,
  withCognitoInterceptor,
} from 'ngx-cognito-auth';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withCognitoInterceptor()),
    provideCognitoAuth(environment.cognito),
  ],
};
