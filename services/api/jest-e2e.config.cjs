/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^@ermulaku/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^tutorhub-slot-engine$': '<rootDir>/../../packages/slot-engine/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
  // The Prisma adapter takes a moment to connect on boot.
  testTimeout: 30000,
  // Each suite boots a whole Nest app (DB pool, GraphQL, sockets) and some
  // fire 20 requests at once on purpose. With one worker per core, an 8-core
  // laptop ran 7 apps + Postgres + Redpanda side by side and starved the CPU:
  // requests waited > 2s for a pool connection (Prisma P2028) or the test's
  // HTTP socket was reset. Half the cores ran clean 4 runs out of 4, no slower.
  maxWorkers: '50%',
};
