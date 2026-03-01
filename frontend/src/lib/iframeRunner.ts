/**
 * Utilities for iframe code execution.
 * With esbuild-wasm, most of the old transformation logic is no longer needed
 * since esbuild handles imports, JSX, and exports natively.
 */

/**
 * Creates a standalone HTML document for rendering a React component.
 * Useful for generating shareable/exportable pages.
 */
export function createRunnerHtml(componentCode: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19",
      "react-dom": "https://esm.sh/react-dom@19",
      "react-dom/client": "https://esm.sh/react-dom@19/client",
      "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime"
    }
  }
  <\/script>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    ${componentCode}
    const root = createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  <\/script>
</body>
</html>`;
}

export function createRunnerBlobUrl(componentCode: string): string {
  const html = createRunnerHtml(componentCode);
  const blob = new Blob([html], { type: 'text/html' });
  return URL.createObjectURL(blob);
}
