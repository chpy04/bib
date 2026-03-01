import { useState, useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '../lib/api';
import type { ConnectionStatus, WSMessage } from '../types';

export function useWebSocket(profileId: string | null) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!profileId) return;

    const ws = new WebSocket(getWsUrl(profileId));
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      if (msg.type === 'state_update') setData(msg.data ?? null);
      if (msg.type === 'fetch_status' && msg.status) setStatus(msg.status);
    };

    return () => ws.close();
  }, [profileId]);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { data, status, send };
}
