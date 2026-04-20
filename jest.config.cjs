/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  globals: {
    __DEBUG_API__: true,
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^three/examples/jsm/utils/SkeletonUtils\\.js$': '<rootDir>/tests/__mocks__/SkeletonUtils.ts',
    '^three/examples/jsm/loaders/GLTFLoader\\.js$': '<rootDir>/tests/__mocks__/GLTFLoader.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/types/**',
  ],
};
