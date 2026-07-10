import { publishLivestreamEvent, type LivestreamRealtimeEvent } from '../realtime/index.js';

type SocketEmitFn = (
  livestreamId: string,
  event: string,
  payload: Record<string, unknown>,
) => void;

const SOCKET_EVENT_BY_TYPE: Partial<Record<LivestreamRealtimeEvent['type'], string>> = {
  'comment.created': 'livestream:comment',
  'bid.placed': 'livestream:bid',
  'auction.created': 'livestream:auction-started',
  'auction.closed': 'livestream:auction-closed',
  'auction.order_ready': 'livestream:auction-order-ready',
  'livestream.ended': 'livestream:ended',
  'livestream.products-updated': 'livestream:products-updated',
  'viewer.count': 'livestream:viewer-count',
  'like.created': 'livestream:like',
};

let socketEmitFn: SocketEmitFn | null = null;

export const registerLivestreamSocketEmitter = (fn: SocketEmitFn): void => {
  socketEmitFn = fn;
};

export const broadcastLivestreamEvent = async (
  livestreamId: string,
  event: LivestreamRealtimeEvent,
): Promise<void> => {
  await publishLivestreamEvent(livestreamId, event);
  const socketEvent = SOCKET_EVENT_BY_TYPE[event.type];
  if (!socketEvent || !socketEmitFn) return;
  socketEmitFn(livestreamId, socketEvent, event as unknown as Record<string, unknown>);
};
