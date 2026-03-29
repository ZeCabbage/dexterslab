'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SystemListener() {
  const router = useRouter();

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;
    let isComponentMounted = true;

    const connect = () => {
      if (!isComponentMounted) return;
      
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      let wsUrl: string;

      if (isLocal) {
        wsUrl = 'ws://localhost:8888/ws/system';
      } else if (/^192\.168\.|^10\.|^100\.|^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) {
        wsUrl = `ws://${hostname}:8888/ws/system`;
      } else {
        // Fallback to secure API endpoint for public internet access
        wsUrl = 'wss://dexterslab-api.cclottaaworld.com/ws/system';
      }
      
      console.log(`[SystemListener] Connecting to ${wsUrl}...`);
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[SystemListener] Connected to Voice Navigator');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'navigate' && msg.route) {
            console.log(`[SystemListener] Force navigation to -> ${msg.route}`);
            router.push(msg.route);
          }
        } catch (err) {
          console.error('[SystemListener] Payload parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('[SystemListener] Disconnected from System WebSocket, reconnecting in 2s...');
        if (isComponentMounted) {
          reconnectTimer = setTimeout(connect, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error('[SystemListener] WebSocket error:', err);
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect loop
        ws.close();
      }
    };
  }, [router]);

  return null; // Invisible component
}
