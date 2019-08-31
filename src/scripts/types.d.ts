type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = { [key: string]: string | number | boolean }

// ------------------------------
// Twitter API
// ------------------------------
interface TwitterUser {
  id_str: string
  screen_name: string
  name: string
  blocked_by?: boolean
  blocking?: boolean
  muting?: boolean
  followed_by?: boolean
  following?: boolean
  follow_request_sent?: boolean
  friends_count: number
  followers_count: number
  protected?: boolean
  verified?: boolean
  created_at: string // datetime example: 'Sun Jun 29 05:52:09 +0000 2014'
  description: string
}

interface TwitterUserEntities {
  [userId: string]: TwitterUser
}

interface Tweet {
  id_str: string
  // conversation_id_str: string
  user: string
  text: string
  full_text: string
  lang: string
  source: string
  source_name: string
  source_url: string
  // possibly_sensitive_editable: boolean
  // user_id_str: string
  created_at: string
  reply_count: number
  retweet_count: number
  favorite_count: number
  favorited: boolean
  retweeted: boolean
  isReported?: boolean // 넌 왜 camelCase냐!
  is_quote_status: boolean
  in_reply_to_status_id_str?: string
  in_reply_to_user_id_str?: string
  in_reply_to_screen_name?: string
  $userObj?: TwitterUser
  entities: {
    user_mentions?: MentionedUser[]
    urls?: UrlEntityInTweet[]
  }
}

interface MentionedUser {
  id_str: string
  screen_name: string
  name: string
}

interface UrlEntityInTweet {
  url: string
  display_url: string
  expanded_url: string
}

interface TweetWithQuote extends Tweet {
  is_quote_status: true
  quoted_status?: string
  quoted_status_permalink?: UrlEntity
}

interface UrlEntity {
  url: string
  display: string
  expanded: string
}

interface FollowsListResponse {
  next_cursor_str: string
  users: TwitterUser[]
}

interface FollowsIdsResponse {
  next_cursor_str: string
  ids: string[]
}

interface FollowsScraperOptions {
  delay: number
}

type ConnectionType =
  | 'following'
  | 'following_requested'
  | 'followed_by'
  | 'blocking'
  | 'blocked_by'
  | 'muting'
  | 'none'

interface Friendship {
  name: string
  screen_name: string
  id_str: string
  connections: ConnectionType[]
}

type FriendshipResponse = Friendship[]

interface Relationship {
  source: {
    id_str: string
    screen_name: string
    following: boolean
    followed_by: boolean
    live_following: boolean
    following_received: boolean
    following_requested: boolean
    notifications_enabled: boolean
    can_dm: boolean
    can_media_tag: boolean
    blocking: boolean
    blocked_by: boolean
    muting: boolean
    want_retweets: boolean
    all_replies: boolean
    marked_spam: boolean
  }
  target: {
    id_str: string
    screen_name: string
    following: boolean
    followed_by: boolean
    following_received: boolean
    following_requested: boolean
  }
}

interface Limit {
  limit: number
  remaining: number
  reset: number
}

interface LimitStatus {
  application: {
    '/application/rate_limit_status': Limit
  }
  auth: {
    '/auth/csrf_token': Limit
  }
  blocks: {
    '/blocks/list': Limit
    '/blocks/ids': Limit
  }
  followers: {
    '/followers/ids': Limit
    '/followers/list': Limit
  }
  friends: {
    '/friends/following/ids': Limit
    '/friends/following/list': Limit
    '/friends/list': Limit
    '/friends/ids': Limit
  }
}

// ------------------------------
// Twitter Redux store entries
// ------------------------------

interface TweetEntities {
  [tweetId: string]: Tweet
}

interface DMParticipant {
  user_id: string
}

interface DMData {
  conversation_id: string
  participants: DMParticipant[]
  type: 'ONE_TO_ONE' | 'GROUP_DM'
  read_only: boolean
}

interface DMDataWrapped {
  data: DMData
}

interface DMEntities {
  [convId: string]: DMDataWrapped
}

interface SubscribedEntities {
  users: TwitterUserEntities
  tweets: TweetEntities
  conversations?: DMEntities
}

interface BaseEntry {
  entryId: string
  sortIndex: string
  type: string
}

interface BaseEntryContent {
  id?: string
  displayType: string
}

interface TweetEntry extends BaseEntry {
  type: 'tweet'
  content: TweetEntryContent | FocalTweetEntryContent
}

interface TweetEntryContent extends BaseEntryContent {
  id: string
  displayType: 'tweet'
}

interface FocalTweetEntryContent extends BaseEntryContent {
  id: string
  displayType: 'FocalTweet'
  focal: {
    contextTweetId: string
  }
}

interface TombstoneEntry extends BaseEntry {
  type: 'tombstone'
  content: TombstoneEntryContent
}

interface TombstoneEntryContent extends BaseEntryContent {
  id: undefined
  displayType: 'TweetUnavailable' | 'Inline'
  // epitaph: 내가 차단한 경우는 이 속성이 없더라.
  epitaph?: 'BlockedBy' | 'Protected'
  tombstoneInfo: {
    text: string
    richText: {
      text: string
    }
    richRevealText?: {
      text: string
    }
  }
  tweet?: TweetEntryContent
}

interface UserEntry extends BaseEntry {
  type: 'user'
  content: UserEntryContent
}

interface UserEntryContent extends BaseEntryContent {
  displayType: 'UserDetailed'
  id: string
}

type Entry = TweetEntry | TombstoneEntry | UserEntry

interface TweetEntryWithData {
  entry: TweetEntry
  entryData: Tweet
}

interface UserEntryWithData {
  entry: UserEntry
  entryData: TwitterUser
}

interface TombstoneEntryWithData {
  entry: TombstoneEntry
  entryData: Tweet | null
}

interface UnknownEntryWithData {
  entry: Entry
  entryData: null
}

type EntryWithData =
  | TweetEntryWithData
  | UserEntryWithData
  | TombstoneEntryWithData
  | UnknownEntryWithData

interface UserCell {
  displayMode: string
  promotedItemType: string
  userId: string
  withFollowsYou: boolean
}

type ReduxStoreEventNames =
  | 'insertSingleUserIntoStore'
  | 'insertMultipleUsersIntoStore'
  | 'afterBlockUser'
  | 'toastMessage'
  | 'getMultipleUsersByIds'
  | 'getUserByName'
  | 'getDMData'

interface UserCellIdentifier {
  userId: string | null
  userName: string | null
}

interface FollowsScraperOptions {
  delay: number
}

interface EventStore {
  [eventName: string]: Function[]
}

interface MBStartChainBlockMessage {
  action: Action.StartChainBlock
  userName: string
  followType: FollowType
}

interface MBStopChainBlockMessage {
  action: Action.StopChainBlock
}

interface MBRequestAPIMessage {
  action: Action.RequestAPI
  method: HTTPMethods
  path: string
  paramsObj: URLParamsObj
}

interface MBResponseAPIMessage {
  action: Action.ResponseAPI
  response: APIResponse
}

type MBMessage =
  | MBStartChainBlockMessage
  | MBStopChainBlockMessage
  | MBRequestAPIMessage
  | MBResponseAPIMessage

type UserState = 'shouldBlock' | 'alreadyBlocked' | 'muteSkip'

type BlockResult = 'notYet' | 'pending' | 'blockSuccess' | 'blockFailed'

type BlockResultsMap = Map<TwitterUser, BlockResult>

interface FoundUser {
  user: TwitterUser
  state: UserState
}

interface ChainMirrorBlockProgress {
  scraped: number
  foundUsers: FoundUser[]
}

interface MirrorBlockOption {
  outlineBlockUser: boolean
  enableBlockReflection: boolean
  blockMutedUser: boolean
  alwaysImmediatelyBlockMode: boolean
  noDelay: boolean
}

interface APIResponse {
  ok: boolean
  status: number
  statusText: string
  headers: { [name: string]: string }
  body: object
}

interface EitherRight<T> {
  ok: true
  value: T
}

interface EitherLeft<E> {
  ok: false
  error: E
}

type Either<E, T> = EitherLeft<E> | EitherRight<T>

declare function cloneInto<T>(detail: T, view: Window | null): T

// r.i.c
// copied from https://github.com/Microsoft/TypeScript/issues/21309#issuecomment-376338415
type RequestIdleCallbackHandle = any
type RequestIdleCallbackOptions = {
  timeout: number
}
type RequestIdleCallbackDeadline = {
  readonly didTimeout: boolean
  timeRemaining: () => number
}

declare function requestIdleCallback(
  callback: (deadline: RequestIdleCallbackDeadline) => void,
  opts?: RequestIdleCallbackOptions
): RequestIdleCallbackHandle
declare function cancelIdleCallback(handle: RequestIdleCallbackHandle): void
// .end

declare namespace browser {
  export import contextMenus = browser.menus
}

declare namespace uuid {
  function v1(): string
}
