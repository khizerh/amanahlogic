import nextConfig from 'eslint-config-next/core-web-vitals.js';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  {
    ignores: [
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
      '**/.turbo/**',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/coverage/**',
    ],
  },
  ...nextConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable Next.js specific rules for non-Next.js packages
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default eslintConfig;
