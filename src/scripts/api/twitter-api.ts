import { setDefaultParams, encodedFeatures, encodedFieldToggles } from './api-default-params'
import { type GraphQLQueryData, getQueryDataByOperationName, instructionsPath } from './graphql-querydata'
import {
  extractTweetsFromInstructions,
  extractCursorsFromInstructions,
  extractTwitterUsersFromInstructions,
} from './handle-instructions'
// import { generateCookiesForAltAccountRequest, getAllCookies, getCookie } from './cookie-handler'

const BEARER_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

function getCsrfTokenFromCookies(): string {
  return /\bct0=([0-9a-f]+)/i.exec(document.cookie)![1]!
}

const isTwitterHostname = location.hostname === 'twitter.com'

const apiPrefix = isTwitterHostname ? 'https://twitter.com/i/api/1.1' : 'https://x.com/i/api/1.1'
const referrer = isTwitterHostname ? 'https://twitter.com/' : 'https://x.com/'

export class TwClient {
  // TODO: readonly?
  public prefix = apiPrefix
  // prefix = 'x.com/i/api'
  public constructor() {}

  public async getMyself(): Promise<TwitterUser> {
    return await this.request1('get', '/account/verify_credentials.json')
  }

  public async getRateLimitStatus(): Promise<LimitStatus> {
    const response = await this.request1('get', '/application/rate_limit_status.json')
    return response.resources
  }

  public async safelyBlockUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.blocking) {
      return user
    }
    const shouldNotBlock = user.following || user.followed_by || user.follow_request_sent ||
      !user.blocked_by
    if (shouldNotBlock) {
      const fatalErrorMessage = `!!!!!FATAL!!!!!:
  attempted to block user that should NOT block!!
  (user: ${user.screen_name})`
      throw new Error(fatalErrorMessage)
    }
    return this.blockUserById(user.id_str)
  }

  public async blockUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.blocking) {
      return user
    }
    return this.blockUserById(user.id_str)
  }

  public async unblockUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.blocking) {
      return user
    }
    return this.unblockUserById(user.id_str)
  }

  public async muteUser(user: TwitterUser): Promise<TwitterUser> {
    if (user.muting) {
      return user
    }
    return await this.request1('post', '/mutes/users/create.json', {
      user_id: user.id_str,
    })
  }

  public async unmuteUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.muting) {
      return user
    }
    return await this.request1('post', '/mutes/users/destroy.json', {
      user_id: user.id_str,
    })
  }

  public async unfollowUser(user: TwitterUser): Promise<TwitterUser> {
    if (!user.following) {
      return user
    }
    return await this.request1('post', '/friendships/destroy.json', {
      user_id: user.id_str,
    })
  }

  public async blockUserById(userId: string): Promise<TwitterUser> {
    return await this.request1('post', '/blocks/create.json', {
      user_id: userId,
      include_entities: false,
      skip_status: true,
    })
  }

  public async unblockUserById(userId: string): Promise<TwitterUser> {
    return await this.request1('post', '/blocks/destroy.json', {
      user_id: userId,
      include_entities: false,
      skip_status: true,
    })
  }

  public async getTweetById(tweetId: string): Promise<Tweet> {
    const queryData = await getQueryDataByOperationName('TweetDetail')
    const response = await this.requestGraphQL(queryData, {
      focalTweetId: tweetId,
      includePromotedContent: false,
      withBirdwatchNotes: true,
      withCommunity: true,
      withV2Timeline: true,
      withVoice: false,
      withQuickPromoteEligibilityTweetFields: false,
      with_rux_injections: false,
    })
    const instructions = instructionsPath.TweetDetail(response)
    const tweets = extractTweetsFromInstructions(instructions)
    const tweet = tweets.find(t => t.id_str === tweetId)
    if (!tweet) {
      throw new Error('failed to get tweet by id: ' + tweetId)
    }
    return tweet
  }

  public async getFollowsIds(
    followKind: FollowKind,
    user: TwitterUser,
    cursor = '-1',
  ): Promise<UserIdsResponse> {
    return await this.request1('get', `/${followKind}/ids.json`, {
      user_id: user.id_str,
      stringify_ids: true,
      count: 5000,
      cursor,
    })
  }

  public async getFollowers(user: TwitterUser, cursor?: string | null): Promise<UserInstructionsResponse> {
    const queryData = await getQueryDataByOperationName('Followers')
    const response = await this.requestGraphQL(queryData, {
      userId: user.id_str,
      count: 100,
      cursor,
      includePromotedContent: false,
    })
    const instructions = instructionsPath.Followers(response)
    const followers = extractTwitterUsersFromInstructions(instructions)
    const { cursorBottom } = extractCursorsFromInstructions(instructions)
    return {
      stopOnEmptyResponse: true,
      cursorBottom,
      users: followers,
    }
  }

  public async getFollowing(user: TwitterUser, cursor?: string | null): Promise<UserInstructionsResponse> {
    const queryData = await getQueryDataByOperationName('Following')
    const response = await this.requestGraphQL(queryData, {
      userId: user.id_str,
      count: 100,
      cursor,
      includePromotedContent: false,
    })
    const instructions = instructionsPath.Following(response)
    const followings = extractTwitterUsersFromInstructions(instructions)
    const { cursorBottom } = extractCursorsFromInstructions(instructions)
    return {
      stopOnEmptyResponse: true,
      cursorBottom,
      users: followings,
    }
  }

  public async getMultipleUsers(options: GetMultipleUsersOption): Promise<TwitterUser[]> {
    const user_id = 'user_id' in options ? options.user_id : []
    const screen_name = 'screen_name' in options ? options.screen_name : []
    if (user_id.length <= 0 && screen_name.length <= 0) {
      console.warn('warning: empty user_id/screen_name')
      return []
    }
    if (user_id.length > 100 || screen_name.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    const requestParams: URLParamsObj = {}
    if (user_id.length > 0) {
      requestParams.user_id = user_id
    } else if (screen_name.length > 0) {
      requestParams.screen_name = screen_name
    } else {
      throw new Error('unreachable')
    }
    return await this.request1('get', '/users/lookup.json', requestParams)
  }

  public async getSingleUserById(user_id: string): Promise<TwitterUser> {
    throw new Error('not implemented')
  }
  public async getSingleUserByName(screen_name: string): Promise<TwitterUser> {
    throw new Error('not implemented')
  }

  // TODO: no longer works.
  public async getSingleUser(options: GetSingleUserOption): Promise<TwitterUser> {
    const requestParams: URLParamsObj = {
      skip_status: true,
      include_entities: false,
    }
    if ('user_id' in options) {
      requestParams.user_id = options.user_id
    } else if ('screen_name' in options) {
      requestParams.screen_name = options.screen_name
    }
    return await this.request1('get', '/users/show.json', requestParams)
  }

  public async getRetweeters(tweet: Tweet, cursor?: string | null): Promise<UserInstructionsResponse> {
    const queryData = await getQueryDataByOperationName('Retweeters')
    const response = await this.requestGraphQL(queryData, {
      tweetId: tweet.id_str,
      count: 100,
      cursor,
      includePromotedContent: false,
    })
    const instructions = instructionsPath.Retweeters(response)
    const retweeters = extractTwitterUsersFromInstructions(instructions)
    const { cursorBottom } = extractCursorsFromInstructions(instructions)
    return {
      stopOnEmptyResponse: true,
      cursorBottom,
      users: retweeters,
    }
  }

  public async getBlockedUsersIds(cursor = '-1'): Promise<UserIdsResponse> {
    return await this.request1('get', '/blocks/ids.json', {
      stringify_ids: true,
      cursor,
    })
  }

  public async removeFollower(user: TwitterUser) {
    const queryData = await getQueryDataByOperationName('RemoveFollower')
    return await this.requestGraphQL(queryData, {
      target_user_id: user.id_str,
    })
  }

  private async sendRequest(request: RequestInit, url: URL) {
    let maxRetryCount = 1
    while (maxRetryCount-- > 0) {
      const response = await fetch(url.toString(), request)
      const responseJson = await response.json()
      if (response.ok) {
        return responseJson
      }
    }
  }

  private async request1(method: HTTPMethods, path: string, paramsObj: URLParamsObj = {}) {
    const fetchOptions = await prepareTwitterRequest({ method })
    const url = new URL(`https://${this.prefix}/1.1${path}`)
    let params: URLSearchParams
    if (method === 'get') {
      params = url.searchParams
    } else {
      params = new URLSearchParams()
      fetchOptions.body = params
    }
    prepareParams(params, paramsObj)
    return this.sendRequest(fetchOptions, url)
  }

  private async requestGraphQL(
    { queryId, operationName, operationType }: GraphQLQueryData,
    variables: URLParamsObj = {},
  ) {
    const method = operationType === 'query' ? 'get' : 'post'
    const fetchOptions = await prepareTwitterRequest({ method })
    const url = new URL(`https://${this.prefix}/graphql/${queryId}/${operationName}`)
    if (variables.cursor == null) {
      delete variables.cursor
    }
    const encodedVariables = JSON.stringify(variables)
    if (method === 'get') {
      url.searchParams.set('variables', encodedVariables)
      url.searchParams.set('features', encodedFeatures)
      url.searchParams.set('fieldToggles', encodedFieldToggles)
    } else {
      const headers = fetchOptions.headers as Headers
      headers.set('content-type', 'application/json')
      fetchOptions.body = JSON.stringify({
        queryId,
        variables: encodedVariables,
      })
    }
    return this.sendRequest(fetchOptions, url)
  }
}

async function prepareTwitterRequest(
  obj: RequestInit,
): Promise<RequestInit> {
  const headers = new Headers()
  const ct0 = getCsrfTokenFromCookies()
  headers.set('x-csrf-token', ct0)
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  const result: RequestInit = {
    method: 'get',
    mode: 'cors',
    credentials: 'include',
    referrer,
    headers,
  }
  Object.assign(result, obj)
  return result
}

function prepareParams(params: URLSearchParams, additional: URLParamsObj = {}): void {
  setDefaultParams(params)
  for (const [key, value] of Object.entries(additional)) {
    if (value == null) {
      continue
    }
    params.set(key, value.toString())
  }
}

export class RateLimitError extends Error {
  public constructor(message: string, public readonly response?: Response) {
    super(message)
  }
}

export function isTwitterErrorMessage(obj: any): obj is ErrorResponse {
  if (obj == null || typeof obj !== 'object') {
    return false
  }
  if (!('errors' in obj && Array.isArray(obj.errors))) {
    return false
  }
  return true
}

export function errorToString(error: unknown): string {
  console.error(error)
  if (isTwitterErrorMessage(error)) {
    return error.errors[0]?.message || '?'
  } else if (error instanceof Error) {
    return `${error.name}: ${error.message}`
  } else {
    return String(error)
  }
}

type HTTPMethods = 'get' | 'delete' | 'post' | 'put'
type URLParamsObj = {
  [key: string]: string | number | boolean | null | undefined | string[] | number[]
}

export type FollowKind = 'followers' | 'following'

export interface TwitterUser {
  id_str: string
  screen_name: string
  name: string
  blocked_by: boolean
  blocking: boolean
  muting: boolean
  // GraphQL로 가져온 응답에서, false 대신 그 값이 그냥 없더라...
  following?: boolean
  followed_by?: boolean
  follow_request_sent: boolean
  friends_count: number
  followers_count: number
  protected: boolean
  verified: boolean
  created_at: string // datetime example: 'Sun Jun 29 05:52:09 +0000 2014'
  description: string
  profile_image_url_https: string
  location: string
  status?: Tweet
}

export type TwitterUserEntities = Record<string, TwitterUser>

export interface UserListResponse {
  next_cursor_str: string
  users: TwitterUser[]
}

export interface UserIdsResponse {
  next_cursor_str: string
  ids: string[]
}

interface UserInstructionsResponse {
  stopOnEmptyResponse: boolean
  cursorBottom: string | null
  users: TwitterUser[]
}

export interface Tweet {
  id_str: string
  // conversation_id_str: string
  user: TwitterUser
  // 트윗이 140자 넘으면 얘가 undefined로 나오더라.
  // text: string
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
  display_text_range: [number, number]
  quote_count: number
  is_quote_status: boolean
  quoted_status?: Tweet
  quoted_status_permalink?: {
    // url, display
    expanded: string
  }
  in_reply_to_status_id_str?: string
  in_reply_to_user_id_str?: string
  in_reply_to_screen_name?: string
  entities: {
    user_mentions?: UserMentionEntity[]
    urls?: UrlEntity[]
  }
  collaborators?: string[] // id_str의 배열
}

interface UserMentionEntity {
  id_str: string
  name: string
  screen_name: string
}

interface UrlEntity {
  expanded_url: string
}

export interface AudioSpace {
  metadata: {
    rest_id: string
    state: 'Running' | 'Ended' | 'NotStarted'
    title: string
    created_at: number // timestamp (ex. 1621037312345)
    started_at: number
    updated_at: number
    scheduled_start: number
    is_locked: boolean
  }
  participants: {
    total: number
    admins: AudioSpaceParticipant[]
    speakers: AudioSpaceParticipant[]
    listeners: AudioSpaceParticipant[]
  }
}

interface AudioSpaceParticipant {
  twitter_screen_name: string
  display_name: string
  avatar_url: string
}

export interface Limit {
  limit: number
  remaining: number
  reset: number
}

export interface LimitStatus {
  application: {
    '/application/rate_limit_status': Limit
  }
  blocks: {
    // ...차단해도 안 줄어드는 데??
    '/blocks/create&POST': Limit
    '/blocks/list': Limit
    '/blocks/ids': Limit
  }
  followers: {
    '/followers/ids': Limit
    '/followers/list': Limit
  }
  friends: {
    '/friends/list': Limit
    '/friends/ids': Limit
  }
  mutes: {
    '/mutes/users/ids': Limit
    '/mutes/users/list': Limit
  }
  statuses: {
    '/statuses/retweeted_by': Limit
    '/statuses/retweeters/ids': Limit
    '/statuses/retweets/:id': Limit
  }
  users: {
    '/users/lookup': Limit
  }
  search: {
    '/search/adaptive': Limit
  }
}

export interface TweetThreadResponse {
  tweets: Tweet[]
  scrollCursor: string | null
  showMoreCursor: string | null
}

interface ErrorResponseItem {
  code: number
  message: string
}

export interface ErrorResponse {
  errors: ErrorResponseItem[]
}

interface DMParticipant {
  user_id: string
}

export interface DMData {
  conversation_id: string
  participants: DMParticipant[]
  type: 'ONE_TO_ONE' | 'GROUP_DM'
  read_only: boolean
}

type GetMultipleUsersOption = { user_id: string[] } | { screen_name: string[] }
type GetSingleUserOption = { user_id: string } | { screen_name: string }
