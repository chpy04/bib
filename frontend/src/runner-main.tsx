/**
 * Iframe runner: exposes React, ReactDOM, and shadcn on window,
 * listens for code via postMessage, compiles with Babel, and renders.
 * Tailwind + shadcn styles are bundled with this entry.
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { toRunnerCode } from './lib/iframeRunner';
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

declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    __SHADCN__: Record<string, unknown>;
    __COMPONENT__?: React.ComponentType;
    Babel: {
      transform: (code: string, options: { presets: string[] }) => { code: string };
    };
  }
}

window.React = React;
window.ReactDOM = ReactDOM;
window.__SHADCN__ = {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};

let runnerRoot: ReactDOM.Root | null = null;

function runCode(code: string): void {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;
  if (runnerRoot) {
    runnerRoot.unmount();
    runnerRoot = null;
  }
  try {
    const runnerCode = toRunnerCode(code);
    const transformed = window.Babel.transform(runnerCode, { presets: ['react'] }).code;
    const preamble =
      'var React = window.React; var ReactDOM = window.ReactDOM; ' +
      Object.keys(window.__SHADCN__)
        .map((k) => `var ${k} = window.__SHADCN__["${k}"];`)
        .join(' ');
    // eslint-disable-next-line no-eval
    eval(preamble + transformed);
    const Component = window.__COMPONENT__;
    if (Component) {
      runnerRoot = ReactDOM.createRoot(rootEl);
      runnerRoot.render(React.createElement(Component));
    } else {
      rootEl.innerHTML =
        '<p style="color:#888;padding:1rem;">No component assigned (use export default or window.__COMPONENT__)</p>';
    }
  } catch (err) {
    rootEl.innerHTML = `<pre style="color:#e11;padding:1rem;white-space:pre-wrap;font-size:12px;">${(err instanceof Error ? err.message : String(err))}</pre>`;
  }
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'RUN_CODE' && typeof event.data.code === 'string') {
    runCode(event.data.code);
  }
});

// Tell parent we're ready once Babel is available
function sendReady() {
  if (window.parent !== window && window.Babel) {
    window.parent.postMessage({ type: 'runner-ready' }, '*');
  } else if (!window.Babel) {
    setTimeout(sendReady, 50);
  }
}
sendReady();
