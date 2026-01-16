/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Enable coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    'src/data-access-supabase/**/*.ts',
    'src/routes/user/UserSupabase.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
  testTimeout: 10000,
  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      isolatedModules: true, // Faster compilation, skip type checking
    }],
  },
};
