export interface CognitoUser {
  /** Cognito unique user ID */
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  preferred_username?: string;
  /** Raw decoded ID token claims (allows custom Cognito attributes) */
  [claim: string]: unknown;
}
