import { User } from '../../AUTH/models/index.js';

type CommentAuthor = {
  authorName: string;
  authorAvatar?: string;
};

const guestAuthorName = (userId: string): string =>
  `Guest ${userId.replace(/^guest_/, '').slice(-4)}`;

export const resolveCommentAuthor = async (userId: string): Promise<CommentAuthor> => {
  if (userId.startsWith('guest_')) {
    return { authorName: guestAuthorName(userId) };
  }

  const user = await User.findById(userId).select('name profileImage').lean();
  const userWithProfile = user as unknown as { profileImage?: string } | null;
  const profileImage =
    userWithProfile && typeof userWithProfile.profileImage === 'string'
      ? userWithProfile.profileImage
      : undefined;

  return {
    authorName: user?.name ?? `User ${userId.slice(-6)}`,
    ...(profileImage ? { authorAvatar: profileImage } : {}),
  };
};

export const enrichCommentsWithAuthors = async <T extends { userId: string }>(
  comments: T[],
): Promise<Array<T & CommentAuthor>> => {
  const uniqueUserIds = [...new Set(comments.map((comment) => comment.userId))];
  const authorByUserId = new Map<string, CommentAuthor>();

  await Promise.all(
    uniqueUserIds.map(async (userId) => {
      authorByUserId.set(userId, await resolveCommentAuthor(userId));
    }),
  );

  return comments.map((comment) => ({
    ...comment,
    ...authorByUserId.get(comment.userId)!,
  }));
};
