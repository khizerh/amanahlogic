/**
 * Database Services - Centralized data access layer
 *
 * All services follow the same pattern:
 * - Static methods for CRUD operations
 * - Transform functions to convert snake_case DB → camelCase TypeScript
 * - Support for optional Supabase client injection (for transactions/webhooks)
 */

// Core entities
export * from "./organizations";
export * from "./plans";
export * from "./members";
export * from "./memberships";
export * from "./payments";
export * from "./agreements";
export * from "./agreement-links";
export * from "./agreement-templates";
export * from "./email-templates";

// Supporting entities
export * from "./email-logs";
export * from "./onboarding-invites";
