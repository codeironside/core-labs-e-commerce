import { StoryBookmarkModel, StoryCommentModel, StoryReactionModel, } from './models.js';
export const fetchEngagementAnalytics = async () => {
    const [commentCount, reactionCount, bookmarkCount, topStories] = await Promise.all([
        StoryCommentModel.countDocuments({}),
        StoryReactionModel.countDocuments({}),
        StoryBookmarkModel.countDocuments({}),
        StoryCommentModel.aggregate([
            { $group: { _id: '$storyId', commentCount: { $sum: 1 } } },
            { $sort: { commentCount: -1 } },
            { $limit: 10 },
        ]),
    ]);
    const topStoryIds = topStories.map((row) => row._id);
    const reactionByStory = await StoryReactionModel.aggregate([
        { $match: { storyId: { $in: topStoryIds } } },
        { $group: { _id: '$storyId', reactionCount: { $sum: 1 } } },
    ]);
    const reactionMap = new Map(reactionByStory.map((row) => [String(row._id), row.reactionCount]));
    return {
        totals: {
            comments: commentCount,
            reactions: reactionCount,
            bookmarks: bookmarkCount,
        },
        topStories: topStories.map((row) => ({
            storyId: String(row._id),
            commentCount: row.commentCount,
            reactionCount: reactionMap.get(String(row._id)) ?? 0,
        })),
    };
};
