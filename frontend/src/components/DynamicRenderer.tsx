import React, { useState, useEffect } from 'react';

interface Props {
  componentCode: string | null | undefined;
  data: Record<string, unknown> | null;
}

export default function DynamicRenderer({ componentCode, data }: Props) {
  const [Component, setComponent] = useState<React.ComponentType<{ data: Record<string, unknown> | null }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!componentCode) return;
    try {
      const clean = componentCode
        .replace(/^```jsx?\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();

      const wrapped = `
        const { useState, useEffect, useMemo, useCallback, Fragment } = React;
        ${clean.replace(/^export default /, 'return ')}
      `;
      // eslint-disable-next-line no-new-func
      const factory = new Function('React', wrapped);
      const Comp = factory(React);
      setComponent(() => Comp);
      setError(null);
    } catch (err) {
      console.error('Failed to compile component:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [componentCode]);

  if (error) {
    return (
      <div className="p-6 bg-red-900/30 rounded-lg">
        <h3 className="text-red-400 font-medium mb-2">Component Error</h3>
        <pre className="text-sm text-red-300 overflow-auto">{error}</pre>
      </div>
    );
  }

  if (!Component) return <div className="animate-pulse p-6 text-gray-500">Loading component...</div>;

  return <Component data={data} />;
}
