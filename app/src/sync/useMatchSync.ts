import { useEffect, useRef, useState } from 'react';

import type { ClientMessage, MatchState, PendingAction, Seat, ServerMessage } from '../../../shared/protocol';

const RECONNECT_DELAY_MS = 2000;

export type MatchMode =
  | { kind: 'solo' }
  | { kind: 'host'; relay: string }
  | { kind: 'guest'; relay: string; matchId: string };

export type ConnectionStatus = 'connecting' | 'connected' | 'offline';

export type MatchSync = {
  status: ConnectionStatus;
  /** Last error sent by the relay, if any. */
  error?: string;
  matchId?: string;
  /** The seat of this phone, or null until the relay has seated it. */
  seat: Seat | null;
  opponentConnected: boolean;
  /** Confirmed point winners: the score is derived from this list. */
  points: Seat[];
  pending: PendingAction | null;
  proposePoint: (winner: Seat) => void;
  proposeUndo: () => void;
  confirm: () => void;
  dispute: () => void;
  cancel: () => void;
};

/**
 * Keeps this phone in sync with the relay. In solo mode there is no relay: actions apply at once.
 * Online, actions only become points once the other phone confirms them (see server/src/room.ts).
 */
export function useMatchSync(mode: MatchMode): MatchSync {
  const [status, setStatus] = useState<ConnectionStatus>(mode.kind === 'solo' ? 'connected' : 'connecting');
  const [error, setError] = useState<string | undefined>();
  const [seat, setSeat] = useState<Seat | null>(mode.kind === 'solo' ? 0 : null);
  const [state, setState] = useState<MatchState | null>(null);
  const [soloPoints, setSoloPoints] = useState<Seat[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  const relay = mode.kind === 'solo' ? null : mode.relay;
  const guestMatchId = mode.kind === 'guest' ? mode.matchId : undefined;

  useEffect(() => {
    if (relay == null) return;
    // Remembered across reconnections, so the phone gets its match and seat back.
    let matchId = guestMatchId;
    let mySeat: Seat | undefined;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      setStatus('connecting');
      const socket = new WebSocket(relay);
      socketRef.current = socket;
      const send = (message: ClientMessage) => socket.send(JSON.stringify(message));

      socket.onopen = () => {
        setStatus('connected');
        if (matchId) send({ type: 'join', matchId, seat: mySeat });
        else send({ type: 'create' });
      };
      socket.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(String(event.data));
        if (message.type === 'joined') {
          matchId = message.matchId;
          mySeat = message.seat;
          setSeat(message.seat);
          setError(undefined);
        } else if (message.type === 'state') {
          setState(message.state);
        } else {
          setError(message.message);
        }
      };
      socket.onclose = () => {
        socketRef.current = null;
        if (closed) return;
        setStatus('offline');
        retry = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socketRef.current?.close();
    };
  }, [relay, guestMatchId]);

  if (mode.kind === 'solo') {
    return {
      status,
      seat,
      opponentConnected: true,
      points: soloPoints,
      pending: null,
      proposePoint: (winner) => setSoloPoints((p) => [...p, winner]),
      proposeUndo: () => setSoloPoints((p) => p.slice(0, -1)),
      confirm: () => {},
      dispute: () => {},
      cancel: () => {},
    };
  }

  const send = (message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const pending = state?.pending ?? null;
  const answer = (type: 'confirm' | 'dispute' | 'cancel') => {
    if (pending) send({ type, actionId: pending.id });
  };

  return {
    status,
    error,
    matchId: state?.matchId,
    seat,
    opponentConnected: seat != null && state != null && state.connected[seat === 0 ? 1 : 0],
    points: state?.points ?? [],
    pending,
    proposePoint: (winner) => send({ type: 'propose-point', winner }),
    proposeUndo: () => send({ type: 'propose-undo' }),
    confirm: () => answer('confirm'),
    dispute: () => answer('dispute'),
    cancel: () => answer('cancel'),
  };
}
