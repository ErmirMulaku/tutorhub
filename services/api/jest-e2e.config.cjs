/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@ermulaku/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@ermulaku/slot-engine$': '<rootDir>/../../packages/slot-engine/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // The Prisma adapter takes a moment to connect on boot.
  testTimeout: 30000,
};
