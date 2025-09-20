import {fixupConfigRules, fixupPluginRules} from '@eslint/compat';
import react from 'eslint-plugin-react';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import _import from 'eslint-plugin-import';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';
import {FlatCompat} from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
});

export default [
	// Global ignores (replaces .eslintignore)
	{
		ignores: [
			'**/node_modules/',
			'**/build/',
			'**/dist/',
			'**/test/',
			'**/coverage/',
		],
	},

	// Main configuration
	{
		files: ['**/*.{js,jsx,ts,tsx}'],

		...js.configs.recommended,

		languageOptions: {
			parser: tsParser,
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
				project: './tsconfig.json',
			},
		},

		plugins: {
			react: fixupPluginRules(react),
			'@typescript-eslint': fixupPluginRules(typescriptEslint),
			'react-hooks': fixupPluginRules(reactHooks),
			import: fixupPluginRules(_import),
		},

		settings: {
			react: {
				version: 'detect',
			},
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json',
				},
			},
		},

		rules: {
			// React rules
			'react/react-in-jsx-scope': 'off',
			'react/jsx-filename-extension': [
				1,
				{
					extensions: ['.tsx'],
				},
			],
			'react/prop-types': 'off',

			// React Hooks rules
			'react-hooks/rules-of-hooks': 'error',
			'react-hooks/exhaustive-deps': 'warn',

			// TypeScript rules
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
				},
			],

			// General rules
			'no-console': 'warn',
			'no-debugger': 'error',

			// Import rules
			'import/prefer-default-export': 'off',
			'import/no-unresolved': 'off',

			// Code quality rules
			'max-lines': [
				'warn',
				{
					max: 300,
					skipBlankLines: true,
					skipComments: true,
				},
			],
			'max-lines-per-function': [
				'warn',
				{
					max: 50,
					skipBlankLines: true,
					skipComments: true,
				},
			],
		},
	},

	// Apply Prettier config last to disable conflicting rules
	prettierConfig,
];
