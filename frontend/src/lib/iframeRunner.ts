/**
 * Converts normal React code into the form the iframe runner expects
 * (code that assigns the root component to window.__COMPONENT__).
 *
 * Supports:
 * - export default function App() { ... }
 * - export default function() { ... }
 * - export default () => <div>...</div>
 * - export default App;
 * - export default class App extends React.Component { ... }
 * - Code that already assigns to window.__COMPONENT__ (passed through)
 * - A single top-level function App(...) with no export → appends window.__COMPONENT__ = App;
 */
export function toRunnerCode(userCode: string): string {
  const code = userCode.trim();
  if (!code) return code;

  if (/window\.__COMPONENT__\s*=/.test(code)) return code;

  if (/\bexport\s+default\s+/.test(code)) {
    return code.replace(/\bexport\s+default\s+/, 'window.__COMPONENT__ = ');
  }

  const namedFunctionMatch = code.match(/^\s*function\s+(\w+)\s*\(/m);
  if (namedFunctionMatch) {
    return code + '\nwindow.__COMPONENT__ = ' + namedFunctionMatch[1] + ';';
  }

  const constComponentMatch = code.match(/^\s*(?:const|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|function\s*\()/m);
  if (constComponentMatch) {
    return code + '\nwindow.__COMPONENT__ = ' + constComponentMatch[1] + ';';
  }

  return code;
}

/**
 * Creates an HTML document that loads React, ReactDOM, and Babel standalone,
 * then compiles and renders the given React code string in an iframe.
 * Use toRunnerCode() first if the code is normal React (export default, etc.).
 */
export function createRunnerHtml(componentCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"><\/script>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      var code = ${JSON.stringify(componentCode)};
      try {
        var transformed = Babel.transform(code, { presets: ['react'] }).code;
        eval(transformed);
        var Component = window.__COMPONENT__;
        if (Component) {
          var root = ReactDOM.createRoot(document.getElementById('root'));
          root.render(React.createElement(Component));
        } else {
          document.getElementById('root').innerHTML = '<p style="color:#888;padding:1rem;">No component assigned to window.__COMPONENT__</p>';
        }
      } catch (err) {
        document.getElementById('root').innerHTML = '<pre style="color:#e11;padding:1rem;white-space:pre-wrap;">' + err.message + '</pre>';
      }
    })();
  <\/script>
</body>
</html>`;
}

export function createRunnerBlobUrl(componentCode: string): string {
  const runnerCode = toRunnerCode(componentCode);
  const html = createRunnerHtml(runnerCode);
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
