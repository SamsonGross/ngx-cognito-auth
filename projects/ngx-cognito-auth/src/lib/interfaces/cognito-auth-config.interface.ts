export interface CognitoAuthConfig {
  /** Cognito User Pool ID, e.g. "us-east-1_AbCdEfGhI" */
  userPoolId: string;
  /** App client ID (must have hosted UI enabled, no client secret) */
  clientId: string;
  /** Cognito hosted UI domain, e.g. "myapp.auth.us-east-1.amazoncognito.com" */
  domain: string;
  /** Full redirect URI registered in the app client */
  redirectUri: string;
  /** OAuth scopes, e.g. ["openid", "email", "profile"] */
  scopes: string[];
  /** Where to navigate after successful login. Default: "/dashboard" */
  postLoginRoute?: string;
  /** Where to navigate after logout. Default: "/" */
  postLogoutRoute?: string;
  /** Storage key prefix. Default: "cog_auth" */
  storageKeyPrefix?: string;
}
