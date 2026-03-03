module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-typescript'],
  ],
  plugins: [
    // Transforma import.meta.env.* al objeto vacío para Jest
    'babel-plugin-transform-vite-meta-env',
  ],
};
