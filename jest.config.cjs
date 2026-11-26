/**
 * Jest en mode ESM : NestJS 12 est publié en modules ES, donc le backend l'est
 * aussi. `ts-jest` compile les tests en ESM et Jest tourne avec
 * `--experimental-vm-modules` (voir le script `test`).
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  testEnvironment: 'node',
  clearMocks: true,
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  collectCoverageFrom: ['auth/**/*.ts', 'common/**/*.ts', 'users/**/*.ts', '!**/*.module.ts', '!**/*.spec.ts'],
  coverageDirectory: '../coverage',
};
