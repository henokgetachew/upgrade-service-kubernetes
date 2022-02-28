/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,
    testPathIgnorePatterns: ['/resources/'],
    restoreMocks: true,
    clearMocks: true,
    resetMocks: true
};
