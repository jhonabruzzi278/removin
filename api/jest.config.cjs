/** @type {import('jest').Config} */
module.exports = {
  // Tests del backend corren en Node (no en jsdom)
  testEnvironment: 'node',

  // Transformar ES modules a CommonJS con babel-jest
  transform: {
    '^.+\\.m?js$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },

  // Solo ejecutar tests en api/__tests__
  testMatch: ['<rootDir>/__tests__/**/*.test.{js,mjs}'],

  moduleFileExtensions: ['js', 'mjs', 'json'],
};
