import mongoose, { Schema, type Model } from 'mongoose';

type StoryEngagementDoc = Record<string, unknown> & {
  storyId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
};

const storyCommentSchema = new Schema<StoryEngagementDoc>(
  {
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: 'storycomments', strict: false },
);

const storyReactionSchema = new Schema<StoryEngagementDoc>(
  {
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: 'storyreactions', strict: false },
);

const storyBookmarkSchema = new Schema<StoryEngagementDoc>(
  {
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: 'storybookmarks', strict: false },
);

export const StoryCommentModel: Model<StoryEngagementDoc> =
  mongoose.models.StoryComment ?? mongoose.model('StoryComment', storyCommentSchema);
export const StoryReactionModel: Model<StoryEngagementDoc> =
  mongoose.models.StoryReaction ?? mongoose.model('StoryReaction', storyReactionSchema);
export const StoryBookmarkModel: Model<StoryEngagementDoc> =
  mongoose.models.StoryBookmark ?? mongoose.model('StoryBookmark', storyBookmarkSchema);
