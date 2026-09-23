import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    vanillaExtractPlugin(),
    swc.vite({
      jsc: {
        preserveAllComments: true,
        parser: {
          syntax: 'typescript',
          dynamicImport: true,
          tsx: true,
          decorators: true,
        },
        target: 'es2022',
        externalHelpers: false,
        transform: {
          react: {
            runtime: 'automatic',
          },
          useDefineForClassFields: false,
          decoratorVersion: '2022-03',
        },
      },
      sourceMaps: true,
      inlineSourcesContent: true,
    }),
  ],
  test: {
    include: ['src/__tests__/**/*.unit.spec.ts'],
    testTimeout: 5000,
    restoreMocks: true,
  },
});
