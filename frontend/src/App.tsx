import { useState, useEffect, useRef } from 'react';

const isTestingMode = import.meta.env.VITE_TESTING_MODE === 'true';

const RUNNER_URL = '/runner.html';

// Test snippet uses Tailwind + shadcn so you can verify the full stack in the iframe.
const TEST_COMPONENT_CODE = `
export default function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="p-6 font-sans">
      <h2 className="text-lg font-semibold mb-2">Iframe test — React + Tailwind + shadcn</h2>
      <p className="text-muted-foreground mb-4">Count: {count}</p>
      <div className="flex gap-2">
        <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
        <Button variant="outline" onClick={() => setCount(0)}>Reset</Button>
      </div>
      <Card className="mt-4 max-w-sm">
        <CardHeader>
          <CardTitle>Card from shadcn</CardTitle>
          <CardDescription>If you see this, Tailwind and shadcn are working.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
`;

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [url, setUrl] = useState('');
  const [componentCode, setComponentCode] = useState<string | null>(null);
  const [runnerReady, setRunnerReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'runner-ready') setRunnerReady(true);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!runnerReady || !componentCode || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: 'RUN_CODE', code: componentCode },
      '*'
    );
  }, [runnerReady, componentCode]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setComponentCode(null);
    setLoading(true);
    try {
      if (isTestingMode) {
        setComponentCode(TEST_COMPONENT_CODE);
      } else {
        const res = await fetch('/api/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, prompt }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const detail = data?.detail || res.statusText || 'Request failed';
          throw new Error(detail);
        }
        const code = data?.componentCode ?? data?.component_code;
        if (typeof code !== 'string') throw new Error('Response missing componentCode string');
        setComponentCode(code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-6 font-sans">
      <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-6 shrink-0">
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-zinc-400 mb-2">
            URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-zinc-400 mb-2">
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt…"
            rows={5}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20 resize-y min-h-[120px]"
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      {/* Runner iframe is always mounted so it stays loaded and ready; we only show the panel when we have code. */}
      <div
        className={`mt-8 flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto transition-opacity ${
          componentCode !== null ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 min-h-0 overflow-hidden'
        }`}
        aria-hidden={componentCode === null}
      >
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Response</h2>
        <iframe
          ref={iframeRef}
          src={RUNNER_URL}
          title="Rendered response"
          className="w-full flex-1 min-h-[400px] rounded-lg border border-zinc-700 bg-white"
          sandbox="allow-scripts"
        />
      </div>
    </div>
  );
}
