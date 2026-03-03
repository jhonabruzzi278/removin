/** @type {import('jest').Config} */
module.exports = {
  // Entorno: simula un navegador (DOM) para tests de React
  testEnvironment: 'jsdom',

  // Archivo de setup que extiende Jest con matchers de @testing-library/jest-dom
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Transformar TS/TSX/JS con babel-jest
  transform: {
    '^.+\\.(ts|tsx|js|jsx|mjs)$': ['babel-jest', { configFile: './babel.config.cjs' }],
  },

  // Transformar paquetes ESM dentro de node_modules
  transformIgnorePatterns: [
    '/node_modules/(?!(idb-keyval|lucide-react|@firebase|firebase)/)',
  ],

  // Resolver el alias @/ al directorio src/
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // CSS modules → objeto proxy (evita errores de importación de estilos)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Archivos estáticos → string vacío
    '\\.(jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot)$':
      '<rootDir>/src/__tests__/__mocks__/fileMock.cjs',
  },

  // Solo ejecutar tests dentro de src/__tests__
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx,js}'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json'],

  // Coverage
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    'src/pages/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};
