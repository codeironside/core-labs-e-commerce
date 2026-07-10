import mongoose, { type Document, type Model } from 'mongoose';


export interface ILivestreamHighlight {
    url: string;
    publicId?: string;
    label?: string;
    isPublic: boolean;
    startSeconds?: number;
    endSeconds?: number;
    source?: 'capture' | 'auto' | 'upload' | 'clip';
    createdAt: Date;
}

export interface ILivestreamSession {
    vendorId: mongoose.Types.ObjectId;
    storeId?: mongoose.Types.ObjectId;
    hostUserId?: mongoose.Types.ObjectId;
    productId?: mongoose.Types.ObjectId;
    listedProductIds: mongoose.Types.ObjectId[];
    bannedUserIds: mongoose.Types.ObjectId[];
    title: string;
    description?: string;
    agoraChannelName: string;
    agoraAppId: string;
    hostToken: string;
    hostTokenExpiresAt: number;
    agoraHostUid?: number;
    streamProvider?: 'agora' | 'cloudflare';
    playbackUrl?: string;
    ingestUrl?: string;
    status?: string;
    recordingEnabled: boolean;
    recordingUrl?: string;
    recordingPublic: boolean;
    adminRecordingOverride?: 'force_hidden' | 'deleted';
    highlights: ILivestreamHighlight[];
    likeCount: number;
    endedAt?: Date;
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILivestreamSessionDocument extends ILivestreamSession, Document { }
export interface ILivestreamParticipantDocument extends Document {
    livestreamId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface ILivestreamAuctionDocument extends Document {
    livestreamId: mongoose.Types.ObjectId;
    productId: mongoose.Types.ObjectId;
    vendorId: mongoose.Types.ObjectId;
    status: 'open' | 'closed' | 'cancelled';
    startingBid: number;
    minimumIncrement: number;
    highestBidAmount?: number;
    highestBidderId?: mongoose.Types.ObjectId;
    winnerBidId?: mongoose.Types.ObjectId;
    bidInactivitySeconds: number;
    endsAt: Date;
    closedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface ILivestreamBidDocument extends Document {
    auctionId: mongoose.Types.ObjectId;
    livestreamId: mongoose.Types.ObjectId;
    bidderId: mongoose.Types.ObjectId;
    amount: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface ILivestreamCommentDocument extends Document {
    livestreamId: mongoose.Types.ObjectId;
    userId: string;
    message: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ILivestreamLikeDocument extends Document {
    livestreamId: mongoose.Types.ObjectId;
    viewerKey: string;
    isGuest: boolean;
    createdAt: Date;
    updatedAt: Date;
}



const livestreamSessionSchema = new mongoose.Schema<ILivestreamSessionDocument>(
    {
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'VendorStore', index: true },
        hostUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        listedProductIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Product', default: [] },
        bannedUserIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'User', default: [] },
        title: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        agoraChannelName: { type: String, required: true, unique: true, index: true },
        agoraAppId: { type: String, required: true },
        hostToken: { type: String, required: true },
        hostTokenExpiresAt: { type: Number, required: true },
        agoraHostUid: { type: Number },
        streamProvider: { type: String, enum: ['agora', 'cloudflare'], default: 'agora' },
        playbackUrl: { type: String, trim: true },
        ingestUrl: { type: String, trim: true },
        status: { type: String, trim: true },
        recordingEnabled: { type: Boolean, required: true, default: true },
        recordingUrl: { type: String, trim: true },
        recordingPublic: { type: Boolean, default: false },
        adminRecordingOverride: { type: String, enum: ['force_hidden', 'deleted'] },
        likeCount: { type: Number, default: 0, min: 0 },
        highlights: {
            type: [
                new mongoose.Schema<ILivestreamHighlight>(
                    {
                        url: { type: String, required: true },
                        publicId: { type: String },
                        label: { type: String, trim: true },
                        isPublic: { type: Boolean, default: false },
                        startSeconds: { type: Number },
                        endSeconds: { type: Number },
                        source: { type: String, enum: ['capture', 'auto', 'upload', 'clip'] },
                        createdAt: { type: Date, default: Date.now },
                    },
                    { _id: true },
                ),
            ],
            default: [],
        },
        endedAt: { type: Date },
        metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true },
);

livestreamSessionSchema.index({ vendorId: 1, createdAt: -1 });
livestreamSessionSchema.index({ productId: 1, createdAt: -1 });

export const LivestreamSession: Model<ILivestreamSessionDocument> =
    mongoose.models.LivestreamSession ??
    mongoose.model<ILivestreamSessionDocument>('LivestreamSession', livestreamSessionSchema);

const livestreamParticipantSchema = new mongoose.Schema<ILivestreamParticipantDocument>(
    {
        livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession', required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        joinedAt: { type: Date, required: true, default: Date.now },
    },
    { timestamps: true },
);

livestreamParticipantSchema.index({ livestreamId: 1, userId: 1 }, { unique: true });

const livestreamAuctionSchema = new mongoose.Schema<ILivestreamAuctionDocument>(
    {
        livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession', required: true, index: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
        vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        status: { type: String, enum: ['open', 'closed', 'cancelled'], required: true, default: 'open' },
        startingBid: { type: Number, required: true, min: 0 },
        minimumIncrement: { type: Number, required: true, min: 1 },
        highestBidAmount: { type: Number, min: 0 },
        highestBidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        winnerBidId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamBid' },
        bidInactivitySeconds: { type: Number, required: true, default: 45, min: 10, max: 300 },
        endsAt: { type: Date, required: true, index: true },
        closedAt: { type: Date },
    },
    { timestamps: true },
);

const livestreamBidSchema = new mongoose.Schema<ILivestreamBidDocument>(
    {
        auctionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamAuction', required: true, index: true },
        livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession', required: true, index: true },
        bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true, min: 0 },
    },
    { timestamps: true },
);

livestreamBidSchema.index({ auctionId: 1, amount: -1, createdAt: 1 });

const livestreamCommentSchema = new mongoose.Schema<ILivestreamCommentDocument>(
    {
        livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession', required: true, index: true },
        userId: { type: String, required: true, index: true },
        message: { type: String, required: true, trim: true, maxlength: 1000 },
    },
    { timestamps: true },
);

livestreamCommentSchema.index({ livestreamId: 1, createdAt: -1 });

const livestreamLikeSchema = new mongoose.Schema<ILivestreamLikeDocument>(
    {
        livestreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'LivestreamSession', required: true, index: true },
        viewerKey: { type: String, required: true, index: true },
        isGuest: { type: Boolean, default: false },
    },
    { timestamps: true },
);

livestreamLikeSchema.index({ livestreamId: 1, createdAt: -1 });

export const LivestreamParticipant: Model<ILivestreamParticipantDocument> =
    mongoose.models.LivestreamParticipant ??
    mongoose.model<ILivestreamParticipantDocument>('LivestreamParticipant', livestreamParticipantSchema);

export const LivestreamAuction: Model<ILivestreamAuctionDocument> =
    mongoose.models.LivestreamAuction ??
    mongoose.model<ILivestreamAuctionDocument>('LivestreamAuction', livestreamAuctionSchema);

export const LivestreamBid: Model<ILivestreamBidDocument> =
    mongoose.models.LivestreamBid ??
    mongoose.model<ILivestreamBidDocument>('LivestreamBid', livestreamBidSchema);

export const LivestreamComment: Model<ILivestreamCommentDocument> =
    mongoose.models.LivestreamComment ??
    mongoose.model<ILivestreamCommentDocument>('LivestreamComment', livestreamCommentSchema);

export const LivestreamLike: Model<ILivestreamLikeDocument> =
    mongoose.models.LivestreamLike ??
    mongoose.model<ILivestreamLikeDocument>('LivestreamLike', livestreamLikeSchema);
