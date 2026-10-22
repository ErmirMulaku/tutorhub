// @ts-check
import js from '@eslint/js';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/generated/**',
      '**/.next/**',
      '**/storybook-static/**',
      '**/cypress/**',
      '**/cypress.config.ts',
      '.nx/**',
      '**/.angular/**',
    ],
  },

  // Type-aware linting for TypeScript sources.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // SPEC §7: no `any` in committed code.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // Angular dashboard: angular-eslint on top of the shared TS rules, with inline
  // templates extracted so the template rules below see them too.
  {
    files: ['apps/dashboard-ng/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      // Attribute components (`<button th-button>`, `<aside th-sidebar>`) keep
      // the native element, so the ported CSS and a11y semantics still apply.
      '@angular-eslint/component-selector': [
        'error',
        { type: ['element', 'attribute'], prefix: 'th', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'th', style: 'camelCase' },
      ],
      // Angular's `Validators.required` etc. are static methods, safe to pass
      // by reference; keep the rule for instance methods.
      '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
    },
  },
  // Specs: `expect(api.reply).toHaveBeenCalled()` hands Jasmine the spy
  // itself — nothing calls it unbound — so the rule only reports false
  // positives there.
  {
    files: ['apps/dashboard-ng/**/*.spec.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' },
  },
  {
    files: ['apps/dashboard-ng/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },

  // Plain JS/CJS/MJS (config files, hooks) — no type-aware rules.
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Keep Prettier in charge of formatting; disable conflicting ESLint rules.
  eslintConfigPrettier,
);
