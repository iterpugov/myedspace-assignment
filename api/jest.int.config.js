/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.int\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  globalSetup: '<rootDir>/testing/global-setup.ts',
  globalTeardown: '<rootDir>/testing/global-teardown.ts',
  testTimeout: 30_000,
};
