
export type MediaAsset = {
  id: string;
  ownerId: string;
  url: string;
  provider: "local" | "cloudinary" | "s3";
  filename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
};

export type MessagePermission = "everyone" | "friends" | "none";

export type UserSettings = {
  defaultPostVisibility: PostVisibility;
  allowMessagesFrom: MessagePermission;
  profileDiscoverable: boolean;
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyFollows: boolean;
  notifyFriendRequests: boolean;
  notifyMessages: boolean;
  notifyMentions: boolean;
  digestFrequency: "off" | "daily" | "weekly";
};

export type Role = "user" | "moderator" | "admin" | "owner";

export type User = {
  id: string;
  name: string;
  username: string;
  email: string;
  emailVerified: boolean;
  passwordHash: string;
  bio: string;
  niche: string;
  website?: string;
  avatar: string;
  banner: string;
  followers: string[];
  following: string[];
  friends: string[];
  blockedUsers: string[];
  mutedUsers: string[];
  isAdmin: boolean;
  roles: Role[];
  suspended: boolean;
  referralCode: string;
  savedPosts: string[];
  settings: UserSettings;
  createdAt: string;
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  parentId?: string;
  likes: string[];
  createdAt: string;
};

export type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";
export type Reactions = Partial<Record<ReactionType, string[]>>;
export type PostVisibility = "public" | "followers" | "friends" | "only_me";


export type PollOption = {
  id: string;
  text: string;
  votes: string[];
};

export type Poll = {
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  closesAt?: string;
};

export type Post = {
  id: string;
  authorId: string;
  groupId?: string;
  eventId?: string;
  body: string;
  imageUrl?: string;
  poll?: Poll;
  tags: string[];
  visibility: PostVisibility;
  likes: string[];
  reactions: Reactions;
  shares: number;
  comments: Comment[];
  createdAt: string;
};

export type SafeUser = Omit<User, "passwordHash">;


export type NotificationDigest = {
  id: string;
  userId: string;
  frequency: "daily" | "weekly";
  subject: string;
  itemCount: number;
  status: "pending" | "sent" | "failed";
  error?: string;
  sentAt?: string;
  createdAt: string;
};

export type NotificationType = "like" | "comment" | "follow" | "friend_request" | "friend_accept" | "message" | "mention";

export type Notification = {
  id: string;
  recipientId: string;
  actorId: string;
  type: NotificationType;
  postId?: string;
  commentId?: string;
  read: boolean;
  createdAt: string;
};

export type Message = {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  read: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  participantIds: string[];
  messages: Message[];
  updatedAt: string;
  createdAt: string;
};

export type Story = {
  id: string;
  authorId: string;
  groupId?: string;
  eventId?: string;
  body: string;
  imageUrl?: string;
  views: string[];
  createdAt: string;
  expiresAt: string;
};

export type Group = {
  id: string;
  name: string;
  description: string;
  cover: string;
  ownerId: string;
  memberIds: string[];
  createdAt: string;
};

export type Event = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  hostId: string;
  attendeeIds: string[];
  cover: string;
  createdAt: string;
};

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export type FriendRequest = {
  id: string;
  senderId: string;
  recipientId: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt?: string;
};




export type Referral = {
  id: string;
  inviterId: string;
  invitedUserId: string;
  code: string;
  createdAt: string;
};

export type MarketplaceListingType = "service" | "digital_product" | "collaboration";

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  type: MarketplaceListingType;
  category: string;
  price: number;
  currency: string;
  imageUrl?: string;
  poll?: Poll;
  tags: string[];
  saves: string[];
  active: boolean;
  createdAt: string;
};

export type MarketplaceInquiry = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  message: string;
  status: "open" | "replied" | "closed";
  createdAt: string;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  theme: string;
  prize: string;
  startsAt: string;
  endsAt: string;
  hostId: string;
  createdAt: string;
};

export type ChallengeEntry = {
  id: string;
  challengeId: string;
  authorId: string;
  title: string;
  body: string;
  imageUrl?: string;
  votes: string[];
  createdAt: string;
};

export type ReportStatus = "open" | "reviewed" | "dismissed";
export type ReportReason = "spam" | "harassment" | "nudity" | "hate" | "other";

export type Report = {
  id: string;
  reporterId: string;
  targetType: "post" | "user";
  targetId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  createdAt: string;
};




export type ModerationAction = "flag" | "block";
export type ModerationRule = {
  id: string;
  phrase: string;
  targetTypes: string[];
  action: ModerationAction;
  active: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};
export type ModerationFlag = {
  id: string;
  ruleId?: string;
  targetType: string;
  targetId: string;
  actorId?: string;
  excerpt: string;
  status: "open" | "reviewed" | "dismissed";
  createdAt: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  description?: string;
  updatedBy?: string;
  updatedAt: string;
  createdAt: string;
};

export type AuthTokenType = "email_verification" | "password_reset";

export type AuthToken = {
  id: string;
  userId: string;
  type: AuthTokenType;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

export type Database = {
  users: User[];
  posts: Post[];
  notifications: Notification[];
  conversations: Conversation[];
  reports: Report[];
  stories: Story[];
  groups: Group[];
  events: Event[];
  friendRequests: FriendRequest[];
  challenges: Challenge[];
  challengeEntries: ChallengeEntry[];
  marketplaceListings: MarketplaceListing[];
  marketplaceInquiries: MarketplaceInquiry[];
  referrals: Referral[];
  mediaAssets: MediaAsset[];
  authTokens: AuthToken[];
  featureFlags: FeatureFlag[];
  moderationRules: ModerationRule[];
  moderationFlags: ModerationFlag[];
  notificationDigests: NotificationDigest[];
};
