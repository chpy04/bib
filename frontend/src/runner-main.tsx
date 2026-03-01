/**
 * Iframe runner: uses esbuild-wasm to bundle LLM-generated code,
 * resolving imports via esm.sh CDN. Renders the result into #root.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as jsxRuntime from 'react/jsx-runtime';
import * as esbuild from 'esbuild-wasm';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import './index.css';

// Packages we provide locally instead of fetching from CDN
const LOCAL_MODULES: Record<string, unknown> = {
  'react': React,
  'react/jsx-runtime': jsxRuntime,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOM,
};

// shadcn components available as bare imports
const SHADCN_MODULES: Record<string, unknown> = {
  '@/components/ui/button': { Button },
  '@/components/ui/card': { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter },
};

// Also expose on window for code that uses globals
declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
  }
}
window.React = React;
window.ReactDOM = ReactDOM;

let esbuildReady = false;

async function initEsbuild() {
  await esbuild.initialize({
    wasmURL: 'https://unpkg.com/esbuild-wasm@latest/esbuild.wasm',
  });
  esbuildReady = true;
}

// esbuild plugin: resolve local modules and shadcn, send everything else to esm.sh
function cdnPlugin(): esbuild.Plugin {
  return {
    name: 'cdn-resolve',
    setup(build) {
      // Handle local modules (react, react-dom)
      build.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, (args) => ({
        path: args.path,
        namespace: 'local-module',
      }));

      build.onLoad({ filter: /.*/, namespace: 'local-module' }, (args) => {
        const mod = LOCAL_MODULES[args.path];
        if (!mod) {
          return { contents: `export default {}`, loader: 'js' };
        }
        // Re-export all properties, filtering out "default" (not a valid named export)
        const keys = Object.keys(mod as object).filter((k) => k !== 'default');
        const exports = keys.map((k) => `export const ${k} = __mod["${k}"];`).join('\n');
        return {
          contents: `const __mod = globalThis.__LOCAL_MODULES__["${args.path}"];\n${exports}\nexport default __mod;`,
          loader: 'js',
        };
      });

      // Handle shadcn component imports
      build.onResolve({ filter: /^@\/components\/ui\// }, (args) => ({
        path: args.path,
        namespace: 'shadcn-module',
      }));

      build.onLoad({ filter: /.*/, namespace: 'shadcn-module' }, (args) => {
        const mod = SHADCN_MODULES[args.path];
        if (!mod) {
          return { contents: `export default {}`, loader: 'js' };
        }
        const keys = Object.keys(mod as object).filter((k) => k !== 'default');
        const exports = keys.map((k) => `export const ${k} = __mod["${k}"];`).join('\n');
        return {
          contents: `const __mod = globalThis.__SHADCN_MODULES__["${args.path}"];\n${exports}\nexport default __mod;`,
          loader: 'js',
        };
      });

      // Everything else: resolve to esm.sh CDN
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.namespace === 'cdn') {
          // Resolve relative imports within CDN modules
          return { path: new URL(args.path, `https://esm.sh/${args.importer}`).href, namespace: 'cdn' };
        }
        return { path: `https://esm.sh/${args.path}`, namespace: 'cdn', external: true };
      });

      // Relative imports within CDN modules
      build.onResolve({ filter: /^\./, namespace: 'cdn' }, (args) => ({
        path: new URL(args.path, args.importer).href,
        namespace: 'cdn',
        external: true,
      }));
    },
  };
}

let runnerRoot: ReactDOM.Root | null = null;

async function runCode(code: string): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  if (runnerRoot) {
    runnerRoot.unmount();
    runnerRoot = null;
  }

  try {
    if (!esbuildReady) {
      rootEl.innerHTML = '<p style="color:#888;padding:1rem;">Initializing bundler…</p>';
      await initEsbuild();
    }

    // Make local modules available on globalThis for the bundled code
    (globalThis as any).__LOCAL_MODULES__ = LOCAL_MODULES;
    (globalThis as any).__SHADCN_MODULES__ = SHADCN_MODULES;

    const result = await esbuild.build({
      stdin: {
        contents: code,
        loader: 'jsx',
        resolveDir: '.',
      },
      bundle: true,
      format: 'iife',
      globalName: '__bundle__',
      plugins: [cdnPlugin()],
      write: false,
      jsx: 'automatic',
      jsxImportSource: 'react',
    });

    const bundledCode = result.outputFiles[0].text;

    // Execute the bundle
    const script = document.createElement('script');
    script.textContent = bundledCode;
    document.head.appendChild(script);
    document.head.removeChild(script);

    // Get the default export from the bundle
    const bundle = (window as any).__bundle__;
    const Component = bundle?.default || bundle;

    if (Component && typeof Component === 'function') {
      runnerRoot = ReactDOM.createRoot(rootEl);
      runnerRoot.render(React.createElement(Component));
    } else {
      rootEl.innerHTML =
        '<p style="color:#888;padding:1rem;">No default export found. Use "export default function App() { ... }"</p>';
    }
  } catch (err) {
    rootEl.innerHTML = `<pre style="color:#e11;padding:1rem;white-space:pre-wrap;font-size:12px;">${err instanceof Error ? err.message : String(err)}</pre>`;
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'RUN_CODE' && typeof event.data.code === 'string') {
    runCode(event.data.code);
  }
});

// Initialize esbuild immediately, then tell parent we're ready
initEsbuild()
  .then(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'runner-ready' }, '*');
    }
  })
  .catch((err) => {
    console.error('Failed to initialize esbuild:', err);
    // Still signal ready so the UI isn't stuck
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'runner-ready' }, '*');
    }
  });
