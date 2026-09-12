import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';
// Debe ir SIEMPRE el último: apaga las reglas de ESLint que chocan con Prettier.
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  js.configs.recommended,

  // Reglas con información de tipos: detectan cosas que el analizador sintáctico
  // no puede ver, como una promesa sin await o una comparación siempre falsa.
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      ...reactRefresh.configs.vite.rules,

      // El dominio se apoya en `as` solo dentro de los constructores de unidades.
      // Fuera de ahí, una aserción de tipo es casi siempre un error de diseño.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // Interpolar un número en el mensaje de un error es intencionado y seguro.
      // El resto de tipos sigue prohibido dentro de una plantilla de cadena.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],

      // Un guion bajo delante del nombre significa "lo descarto a propósito".
      // Hace falta al quitar propiedades con desestructuración de resto.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Los archivos de configuración en JavaScript no están en ningún tsconfig,
  // así que no pueden pasar por las reglas con información de tipos.
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // Las funciones serverless corren en Node, no en el navegador.
  {
    files: ['api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
