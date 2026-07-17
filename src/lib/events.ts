import { EventEmitter } from 'node:events';
const g = globalThis as unknown as { hsBus?: EventEmitter };
const bus = g.hsBus ?? new EventEmitter();
bus.setMaxListeners(1000);
if (process.env.NODE_ENV !== 'production') g.hsBus = bus;

export function broadcast(event: string, data: unknown) { bus.emit('event', { event, data }); }
export function subscribe(fn: (payload: { event: string; data: unknown }) => void) {
  bus.on('event', fn);
  return () => bus.off('event', fn);
}
