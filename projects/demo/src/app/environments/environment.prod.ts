import { CognitoAuthConfig } from 'ngx-cognito-auth';

export const environment = {
  production: true,
  cognito: {
    userPoolId: 'us-east-1_XXXXXXXXX',
    clientId: 'YOUR_CLIENT_ID',
    domain: 'your-domain.auth.us-east-1.amazoncognito.com',
    redirectUri: 'https://your-production-domain.com/callback',
    scopes: ['openid', 'email', 'profile'],
    postLoginRoute: '/dashboard',
    postLogoutRoute: '/login',
    storageKeyPrefix: 'demo_auth',
  } satisfies CognitoAuthConfig,
};
