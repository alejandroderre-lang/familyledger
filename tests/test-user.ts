/**
 * Credentials for the local E2E test account.
 *
 * These are fixtures, not secrets: they only exist inside a local
 * `supabase start` stack, which itself runs on the CLI's published shared
 * default keys. Never reuse them for a hosted project.
 */
export const TEST_USER = {
  email: 'e2e-tester@familyledger.test',
  password: 'e2e-local-fixture-7Qx4mZ',
  fullName: 'E2E Tester',
} as const

export const TEST_ADMIN = {
  email: 'e2e-admin@familyledger.test',
  password: 'e2e-local-fixture-3Kp9wR',
  fullName: 'E2E Admin',
} as const

/** Local stack defaults, printed by `supabase status`. */
export const LOCAL_SUPABASE = {
  url: 'http://127.0.0.1:54321',
  serviceRoleKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
} as const
