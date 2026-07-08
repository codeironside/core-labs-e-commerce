import { LivestreamSession } from '../models/index.js';
import {
  HIGHLIGHT_MARKER_DEDUPE_SECONDS,
  HIGHLIGHT_MAX_CLIPS_PER_STREAM,
} from '../../../CORE/constants/highlights.js';

export type HighlightMarkerSource = 'capture' | 'auction_won';

export type HighlightMarker = {
  offsetSeconds: number;
  label: string;
  markedAt: string;
  source: HighlightMarkerSource;
  processed: boolean;
};

const readMarkers = (metadata: unknown): HighlightMarker[] => {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }
  const raw = (metadata as { highlightMarkers?: unknown }).highlightMarkers;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is HighlightMarker => {
    return (
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as HighlightMarker).offsetSeconds === 'number'
    );
  });
};

export const recordHighlightMoment = async (input: {
  livestreamId: string;
  source: HighlightMarkerSource;
  label: string;
  onlyWhenActive?: boolean;
}): Promise<boolean> => {
  const filter: Record<string, unknown> = { _id: input.livestreamId };
  if (input.onlyWhenActive ?? true) {
    filter.status = 'active';
  }

  const livestream = await LivestreamSession.findOne(filter).select('createdAt metadata').lean();
  if (!livestream?.createdAt) {
    return false;
  }

  const markers = readMarkers(livestream.metadata);
  if (markers.filter((marker) => !marker.processed).length >= HIGHLIGHT_MAX_CLIPS_PER_STREAM) {
    return false;
  }

  const offsetSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(livestream.createdAt).getTime()) / 1000),
  );

  const recentMarker = [...markers].reverse().find((marker) => !marker.processed);
  if (
    recentMarker
    && Math.abs(recentMarker.offsetSeconds - offsetSeconds) < HIGHLIGHT_MARKER_DEDUPE_SECONDS
  ) {
    return false;
  }

  const marker: HighlightMarker = {
    offsetSeconds,
    label: input.label,
    markedAt: new Date().toISOString(),
    source: input.source,
    processed: false,
  };

  await LivestreamSession.findByIdAndUpdate(input.livestreamId, {
    $push: { 'metadata.highlightMarkers': marker },
  });

  return true;
};

export const listPendingHighlightMarkers = (metadata: unknown): HighlightMarker[] =>
  readMarkers(metadata).filter((marker) => !marker.processed);

export const markHighlightMarkerProcessed = async (
  livestreamId: string,
  markedAt: string,
): Promise<void> => {
  const livestream = await LivestreamSession.findById(livestreamId).select('metadata').lean();
  if (!livestream) {
    return;
  }

  const markers = readMarkers(livestream.metadata).map((marker) =>
    marker.markedAt === markedAt ? { ...marker, processed: true } : marker,
  );

  await LivestreamSession.findByIdAndUpdate(livestreamId, {
    $set: { 'metadata.highlightMarkers': markers },
  });
};

export const markHighlightMarkersProcessed = async (livestreamId: string): Promise<void> => {
  const livestream = await LivestreamSession.findById(livestreamId).select('metadata').lean();
  if (!livestream) {
    return;
  }

  const markers = readMarkers(livestream.metadata).map((marker) => ({
    ...marker,
    processed: true,
  }));

  await LivestreamSession.findByIdAndUpdate(livestreamId, {
    $set: { 'metadata.highlightMarkers': markers },
  });
};
