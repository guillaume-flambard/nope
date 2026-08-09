// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'node_modules/', 'bun.lock', '*.log', '.superflow/', 'docs/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Le code compile en CommonJS : require() est légitime (chalk/ora/dotenv sont CJS).
      '@typescript-eslint/no-require-imports': 'off',
      // Les catches vides sont des best-effort volontaires (recording, ws.close, handlers).
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
