import js from '@eslint/js'
import typescript from 'typescript-eslint'
import vue from 'eslint-plugin-vue'

export default [
  js.configs.recommended,
  ...typescript.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: typescript.parser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        // 浏览器全局变量
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        NodeJS: 'readonly',
        WebSocket: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        RequestInit: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        File: 'readonly',
        // Electron 相关
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly'
      }
    }
  },
  {
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: {
         // 浏览器和Node.js全局变量
           window: 'readonly',
           document: 'readonly',
           console: 'readonly',
           setTimeout: 'readonly',
           setInterval: 'readonly',
           clearTimeout: 'readonly',
           clearInterval: 'readonly',
           HTMLElement: 'readonly',
           HTMLInputElement: 'readonly',
           NodeJS: 'readonly',
           WebSocket: 'readonly',
           URLSearchParams: 'readonly',
           fetch: 'readonly',
           Blob: 'readonly',
           URL: 'readonly',
           requestAnimationFrame: 'readonly',
           cancelAnimationFrame: 'readonly',
           navigator: 'readonly',
           location: 'readonly',
           localStorage: 'readonly',
           RequestInit: 'readonly',
           KeyboardEvent: 'readonly',
           MouseEvent: 'readonly',
           File: 'readonly',
         require: 'readonly',
         process: 'readonly',
         __dirname: 'readonly',
         __filename: 'readonly'
       }
    }
  },
  {
    files: ['**/*.{js,ts,vue}'],
    rules: {
      // 关闭一些可能过于严格的规则
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/max-attributes-per-line': 'off',
      'vue/attribute-hyphenation': 'off',
      'no-empty': 'warn',
      'no-case-declarations': 'warn'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.config.js',
      '*.config.ts'
    ]
  }
]