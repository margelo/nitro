import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const compat = new FlatCompat({
  baseDirectory: rootDir,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
})

const baseConfig = compat.config({
  extends: ['@react-native', 'plugin:prettier/recommended'],
  plugins: ['@typescript-eslint', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: true,
    tsconfigRootDir: path.join(rootDir, 'config'),
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'prettier/prettier': [
      'warn',
      {
        quoteProps: 'consistent',
        singleQuote: true,
        tabWidth: 2,
        trailingComma: 'es5',
        useTabs: false,
        semi: false,
      },
    ],
  },
})

function packageConfig(packageDir, project = true, jsx = true) {
  return {
    files: [`${packageDir}/**/*.{js,ts,tsx}`],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: path.join(rootDir, packageDir),
        project,
        ecmaFeatures: {
          jsx,
        },
      },
    },
  }
}

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.harness/**',
      '**/lib/**',
      '**/.eslintrc.*',
      '**/.prettierrc.*',
      '**/jest.config.js',
      '**/babel.config.js',
      '**/metro.config.js',
      '**/react-native.config.js',
      '**/tsconfig.json',
    ],
  },
  ...baseConfig,
  packageConfig('packages/react-native-nitro-modules', [
    './tsconfig.json',
    './tests/tsconfig.json',
  ]),
  packageConfig('packages/nitrogen', true, false),
  packageConfig('packages/react-native-nitro-test'),
  packageConfig('packages/react-native-nitro-test-external'),
  packageConfig('apps/example'),
  packageConfig('apps/benchmark'),
]
