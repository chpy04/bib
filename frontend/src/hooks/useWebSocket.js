import { useState, useEffect, useRef, useCallback } from 'react';
import { getWsUrl } from '../lib/api';

export function useWebSocket(profileId) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!profileId) return;

    const ws = new WebSocket(getWsUrl(profileId));
    wsRef.current = ws;

    ws.onopen = () => setStatus('connected');
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'state_update') setData(msg.data);
      if (msg.type === 'fetch_status') setStatus(msg.status);
    };

    return () => ws.close();
  }, [profileId]);

  const send = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { data, status, send };
}
