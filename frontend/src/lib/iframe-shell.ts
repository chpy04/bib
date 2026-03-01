/**
 * The iframe shell HTML — written once into the iframe document on first mount.
 *
 * It loads React, ReactDOM, Babel, and Tailwind from CDN, then listens for
 * two postMessage events from the parent:
 *
 *   RENDER       { type: 'RENDER', code: string, data: object }
 *                Transpiles the component code with Babel and mounts it.
 *
 *   DATA_UPDATE  { type: 'DATA_UPDATE', data: object }
 *                Re-renders the existing component with fresh data.
 *
 * It sends two postMessage events to the parent:
 *
 *   SHELL_READY  Fired once the shell has loaded and is ready to receive RENDER.
 *   RESIZE       { type: 'RESIZE', height: number }  After every render.
 *   NAVIGATE     { type: 'NAVIGATE', url: string }   When navigateTo() is called.
 *   ACTION       { type: 'ACTION', name: string }     When executeAction() is called.
 */
export const IFRAME_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    var _root = null;
    var _componentFn = null;
    var _currentData = {};

    function navigateTo(url) {
      window.parent.postMessage({ type: 'NAVIGATE', url: url }, '*');
    }

    function executeAction(name) {
      window.parent.postMessage({ type: 'ACTION', name: name }, '*');
    }

    function _reportHeight() {
      setTimeout(function() {
        var h = document.documentElement.scrollHeight || document.body.scrollHeight;
        window.parent.postMessage({ type: 'RESIZE', height: h }, '*');
      }, 80);
    }

    function _render() {
      if (!_componentFn) return;
      try {
        var props = Object.assign({}, _currentData, {
          navigateTo: navigateTo,
          executeAction: executeAction,
        });
        if (!_root) {
          _root = ReactDOM.createRoot(document.getElementById('root'));
        }
        _root.render(React.createElement(_componentFn, props));
        _reportHeight();
      } catch (err) {
        document.getElementById('root').innerHTML =
          '<pre style="color:red;padding:16px;white-space:pre-wrap;font-size:13px">' +
          'Render error: ' + err.message + '</pre>';
        console.error('[iframe] Render error:', err);
      }
    }

    function _evalComponent(code) {
      try {
        var transpiled = Babel.transform(code, { presets: ['react'] }).code;
        // Wrap so GeneratedPage is returned from the IIFE
        var wrapped = '(function() {\\n' + transpiled + '\\n; return typeof GeneratedPage !== "undefined" ? GeneratedPage : null; })()';
        var fn = eval(wrapped);
        if (typeof fn !== 'function') {
          throw new Error('Component code did not define a function named GeneratedPage');
        }
        return fn;
      } catch (err) {
        document.getElementById('root').innerHTML =
          '<pre style="color:red;padding:16px;white-space:pre-wrap;font-size:13px">' +
          'Compilation error: ' + err.message + '</pre>';
        console.error('[iframe] Compilation error:', err);
        return null;
      }
    }

    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (!msg || !msg.type) return;

      if (msg.type === 'RENDER') {
        _currentData = msg.data || {};
        _componentFn = _evalComponent(msg.code);
        _render();
      } else if (msg.type === 'DATA_UPDATE') {
        _currentData = Object.assign({}, _currentData, msg.data || {});
        _render();
      }
    });

    // Signal parent that shell is initialised
    window.parent.postMessage({ type: 'SHELL_READY' }, '*');
  </script>
</body>
</html>`;
