import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuração mínima e sem ruído.
 *
 * O código já é consistente (TypeScript estrito, `tsc --noEmit` limpo); o
 * objetivo aqui é só impedir regressões óbvias, não reformatar o repositório.
 * Regras de estilo ficam de fora: `prettier` reescreveria todos os arquivos de
 * uma vez e esconderia o histórico.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // `_` marca parâmetro/argumento aceito por contrato e não usado.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none',
      }],
      // Proibido contornar o sistema de tipos.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.mjs', 'vite.config.ts'],
    languageOptions: {
      globals: { Buffer: 'readonly', process: 'readonly', console: 'readonly',
        URL: 'readonly', globalThis: 'readonly' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
);
