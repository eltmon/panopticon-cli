import { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface XTerminalProps {
  sessionName: string;
  onDisconnect?: () => void;
}

export function XTerminal({ sessionName, onDisconnect }: XTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminalInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Store onDisconnect in a ref to avoid reconnection loops
  const onDisconnectRef = useRef(onDisconnect);
  onDisconnectRef.current = onDisconnect;

  const connect = useCallback(() => {
    if (!terminalRef.current || !sessionName) return;

    // Ensure container has dimensions before creating terminal
    const container = terminalRef.current;
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('XTerminal: Container has no size, retrying in 100ms');
      setTimeout(() => connect(), 100);
      return;
    }

    console.log('XTerminal: Creating terminal, container size:', container.clientWidth, 'x', container.clientHeight);

    // Create terminal instance with explicit dimensions
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cols: 120,  // Start with reasonable defaults
      rows: 30,
      theme: {
        background: '#1a1a2e',
        foreground: '#eaeaea',
        cursor: '#eaeaea',
        cursorAccent: '#1a1a2e',
        selectionBackground: '#3a3a5e',
        black: '#1a1a2e',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#6272a4',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2',
        brightBlack: '#6272a4',
        brightRed: '#ff6e6e',
        brightGreen: '#69ff94',
        brightYellow: '#ffffa5',
        brightBlue: '#d6acff',
        brightMagenta: '#ff92df',
        brightCyan: '#a4ffff',
        brightWhite: '#ffffff',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(terminalRef.current);
    fit.fit();

    terminalInstance.current = term;
    fitAddon.current = fit;

    // Connect to WebSocket on backend port (3011)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendPort = '3011';
    const wsUrl = `${protocol}//${window.location.hostname}:${backendPort}/ws/terminal?session=${encodeURIComponent(sessionName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('XTerminal: WebSocket opened');
      // DON'T write anything to terminal - let PTY data come through cleanly
      // The PTY will send alternate screen switch and Claude's TUI

      // Small delay to ensure container is fully laid out, then fit once
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) return;
        fit.fit();
        console.log('XTerminal: After fit, size:', term.cols, 'x', term.rows);
        // Send initial resize - server will handle the rest
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
      }, 100);
    };

    ws.onmessage = (event) => {
      // Write data to terminal
      if (typeof event.data === 'string') {
        term.write(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else if (event.data instanceof Blob) {
        event.data.text().then(text => term.write(text));
      }
    };

    ws.onclose = (_event) => {
      term.writeln('\r\n\x1b[33m● Session disconnected\x1b[0m');
      onDisconnectRef.current?.();
    };

    ws.onerror = (error) => {
      term.writeln('\r\n\x1b[31m● Connection error\x1b[0m');
      console.error('WebSocket error:', error);
    };

    // Forward terminal input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle terminal resize
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    // Handle window resize
    const handleResize = () => {
      if (ws.readyState === WebSocket.OPEN) {
        fit.fit();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [sessionName]);

  useEffect(() => {
    // Track if this effect instance has been cancelled (handles React StrictMode double-invoke)
    let cancelled = false;
    let cleanupFn: (() => void) | undefined;

    // Small delay to avoid StrictMode rapid mount/unmount issues
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        cleanupFn = connect();
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanupFn?.();
    };
  }, [connect]);

  // Re-fit terminal when container size changes
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      // Only fit if WebSocket is open to prevent resize spam during teardown
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        fitAddon.current?.fit();
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={terminalRef}
      className="absolute inset-0"
      style={{
        padding: '8px',
        backgroundColor: '#1a1a2e',
        overflow: 'hidden',
      }}
    />
  );
}
