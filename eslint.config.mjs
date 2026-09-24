import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettier from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  prettier,
  {
    rules: {
      // CLAUDE.md §5.1: any 禁止
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // shadcn/ui の生成物と型生成物は Lint 対象外（手で編集しない）
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'src/components/ui/**',
      'src/types/database.ts',
      'public/sw.js', // serwist の生成物（.gitignore 済み）
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default eslintConfig;
