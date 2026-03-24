// Interfaces
export * from './lib/interfaces/cognito-auth-config.interface';
export * from './lib/interfaces/cognito-user.interface';

// Injection token
export * from './lib/tokens/cognito-auth-config.token';

// Core service
export * from './lib/services/cognito-auth.service';

// Route guard
export * from './lib/guards/cognito-auth.guard';

// OAuth callback resolver
export * from './lib/resolvers/cognito-callback.resolver';

// HTTP interceptor
export * from './lib/interceptors/cognito-bearer.interceptor';

// Standalone provider factory (recommended)
export * from './lib/providers/provide-cognito-auth';

// NgModule-based entry point (classic apps)
export * from './lib/module/cognito-auth.module';
