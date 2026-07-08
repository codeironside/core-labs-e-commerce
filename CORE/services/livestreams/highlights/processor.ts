import { cloudinary } from '../../storage/index.js';
import { config } from '../../../config/index.js';
import { logger } from '../../logger/index.js';
import { LivestreamSession } from '../../../../API/LIVESTREAMS/models/index.js';
import {
  listPendingHighlightMarkers,
  markHighlightMarkerProcessed,
} from '../../../../API/LIVESTREAMS/utils/highlightMoments.js';
import {
  HIGHLIGHT_CLIP_DURATION_SECONDS,
  HIGHLIGHT_CLIP_PRE_ROLL_SECONDS,
  HIGHLIGHT_MAX_CLIPS_PER_STREAM,
} from '../../../constants/highlights.js';

const isCloudinaryConfigured = (): boolean =>
  Boolean(config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret);

const clipWithCloudinary = async (input: {
  recordingUrl: string;
  livestreamId: string;
  startSeconds: number;
  durationSeconds: number;
  label: string;
}): Promise<{ url: string; publicId: string } | null> => {
  if (!isCloudinaryConfigured()) {
    return null;
  }

  const publicId = `livestreams/${input.livestreamId}/highlights/${Date.now()}-${input.startSeconds}`;

  try {
    const result = await cloudinary.uploader.upload(input.recordingUrl, {
      resource_type: 'video',
      public_id: publicId,
      start_offset: input.startSeconds,
      duration: input.durationSeconds,
      format: 'mp4',
      overwrite: true,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    logger.error({ error, livestreamId: input.livestreamId }, 'Cloudinary highlight clip failed');
    return null;
  }
};

export const processLivestreamHighlightClips = async (
  livestreamId: string,
  recordingUrl: string,
): Promise<number> => {
  const livestream = await LivestreamSession.findById(livestreamId)
    .select('metadata highlights')
    .lean();

  if (!livestream) {
    return 0;
  }

  const pendingMarkers = listPendingHighlightMarkers(livestream.metadata).slice(
    0,
    HIGHLIGHT_MAX_CLIPS_PER_STREAM,
  );

  if (pendingMarkers.length === 0) {
    return 0;
  }

  let createdCount = 0;

  for (const marker of pendingMarkers) {
    const startSeconds = Math.max(0, marker.offsetSeconds - HIGHLIGHT_CLIP_PRE_ROLL_SECONDS);
    const endSeconds = startSeconds + HIGHLIGHT_CLIP_DURATION_SECONDS;

    const clip = await clipWithCloudinary({
      recordingUrl,
      livestreamId,
      startSeconds,
      durationSeconds: HIGHLIGHT_CLIP_DURATION_SECONDS,
      label: marker.label,
    });

    if (!clip) {
      continue;
    }

    await LivestreamSession.findByIdAndUpdate(livestreamId, {
      $push: {
        highlights: {
          url: clip.url,
          publicId: clip.publicId,
          label: marker.label,
          isPublic: false,
          startSeconds,
          endSeconds,
          source: marker.source === 'auction_won' ? 'auto' : 'capture',
          createdAt: new Date(),
        },
      },
    });

    await markHighlightMarkerProcessed(livestreamId, marker.markedAt);
    createdCount += 1;
  }

  logger.info({ livestreamId, createdCount }, 'Livestream highlight clips processed');

  return createdCount;
};
