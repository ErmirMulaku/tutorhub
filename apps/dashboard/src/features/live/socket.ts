import { io, type Socket } from 'socket.io-client';
import { API_URL } from '../../env';

/**
 * Connect to the API's Socket.IO gateway.
 *
 * Transports are ordered `polling` first, then `websocket`: Socket.IO opens on
 * HTTP long-polling and upgrades to a WebSocket only if the handshake succeeds.
 * Forcing `['websocket']` breaks wherever the upgrade is refused — AWS App
 * Runner rejects `Upgrade: websocket` at its ingress with a 403, so the gateway
 * is unreachable there and no live events arrive at all. Long-polling still
 * works, so this degrades instead of failing.
 *
 * Long-polling spreads one session over many requests, so it needs every request
 * to land on the same instance. Until the API sits behind a load balancer with
 * sticky sessions, it is only correct at a single instance.
 */
export function connectLiveSocket(): Socket {
  return io(API_URL, { transports: ['polling', 'websocket'] });
}
