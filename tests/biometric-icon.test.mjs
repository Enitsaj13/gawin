import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
// Mirror Metro's web aliases, using the real SVG web renderer for this regression.
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'react-native') return next('react-native-web', context);
  if (specifier === '@react-native/assets-registry/registry') return next(require.resolve('react-native-web/dist/cjs/modules/AssetRegistry'), context);
  const result = next(specifier, context);
  if (result.url.startsWith('file:') && result.url.includes('/react-native-svg/')) {
    const web = fileURLToPath(result.url).replace(/\.js$/, '.web.js');
    if (existsSync(web)) return { ...result, url: pathToFileURL(web).href };
  }
  return result;
} });
const shapes = require('react-native-svg/lib/commonjs/elements.web.js');
const source = readFileSync(new URL('../src/features/app-lock/biometric-icon.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;

test('all biometric icons render in both themes without React DOM prop errors', () => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args);
  try {
    for (const color of ['#3c3c39', '#c6c5bd']) {
      const module = { exports: {} };
      const localRequire = (specifier) => specifier === 'react-native-svg' ? { ...shapes, default: shapes.Svg, __esModule: true }
        : specifier === '@/theme/theme' ? { useAppTheme: () => ({ colors: { textSecondary: color } }) }
          : require(specifier);
      new Function('require', 'exports', 'module', compiled)(localRequire, module.exports, module);
      for (const kind of ['face', 'fingerprint', 'device']) {
        const markup = renderToStaticMarkup(React.createElement(module.exports.BiometricIcon, { kind }));
        assert.match(markup, /<svg/);
        assert.match(markup, /aria-hidden="true"/);
        assert.ok(markup.includes(`stroke="${color}"`));
        assert.doesNotMatch(markup, /\saccessible=/);
      }
    }
  } finally { console.error = originalError; }
  assert.deepEqual(errors, [], 'decorative SVG props must not produce React DOM errors');
});
