import mongoose, { Schema } from 'mongoose';
const storyCommentSchema = new Schema({
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
}, { collection: 'storycomments', strict: false });
const storyReactionSchema = new Schema({
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
}, { collection: 'storyreactions', strict: false });
const storyBookmarkSchema = new Schema({
    storyId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
}, { collection: 'storybookmarks', strict: false });
export const StoryCommentModel = mongoose.models.StoryComment ?? mongoose.model('StoryComment', storyCommentSchema);
export const StoryReactionModel = mongoose.models.StoryReaction ?? mongoose.model('StoryReaction', storyReactionSchema);
export const StoryBookmarkModel = mongoose.models.StoryBookmark ?? mongoose.model('StoryBookmark', storyBookmarkSchema);
