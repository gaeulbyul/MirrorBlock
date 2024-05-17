import { sleep, validateTwitterUserName } from './common'

const BEARER_TOKEN =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA'

// CORB* 로 인해 content scripts에서 api.twitter.com 을 사용할 수 없다.
// https://www.chromestatus.com/feature/5629709824032768
// https://www.chromium.org/Home/chromium-security/corb-for-developers

const isTwitterHostname = location.hostname === 'twitter.com'

const apiPrefix = isTwitterHostname ? 'https://twitter.com/i/api/1.1' : 'https://x.com/i/api/1.1'

const referrer = isTwitterHostname ? 'https://twitter.com/' : 'https://x.com/'

export class APIError extends Error {
  constructor(public readonly response: APIResponse) {
    super('API Error!')
    // from: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export async function blockUser(user: TwitterUser): Promise<boolean> {
  if (user.blocking) {
    return true
  }
  const shouldNotBlock = user.following || user.followed_by || user.follow_request_sent ||
    !user.blocked_by
  if (shouldNotBlock) {
    const fatalErrorMessage = `!!!!!FATAL!!!!!:
attempted to block user that should NOT block!!
(user: ${user.screen_name})`
    throw new Error(fatalErrorMessage)
  }
  return blockUserById(user.id_str)
}

export async function blockUserById(userId: string): Promise<boolean> {
  const response = await sendRequest('post', '/blocks/create.json', {
    user_id: userId,
    include_entities: false,
    skip_status: true,
  })
  return response.ok
}

async function getFollowingsList(
  user: TwitterUser,
  cursor = '-1',
): Promise<FollowsListResponse> {
  const response = await sendRequest('get', '/friends/list.json', {
    user_id: user.id_str,
    count: 200,
    skip_status: true,
    include_user_entities: false,
    cursor,
  })
  if (response.ok) {
    return response.body as FollowsListResponse
  } else {
    throw new APIError(response)
  }
}
async function getFollowersList(
  user: TwitterUser,
  cursor = '-1',
): Promise<FollowsListResponse> {
  const response = await sendRequest('get', '/followers/list.json', {
    user_id: user.id_str,
    // screen_name: userName,
    count: 200,
    skip_status: true,
    include_user_entities: false,
    cursor,
  })
  if (response.ok) {
    return response.body as FollowsListResponse
  } else {
    throw new APIError(response)
  }
}

export async function* getAllFollows(
  user: TwitterUser,
  followKind: FollowKind,
  options: FollowsScraperOptions,
): AsyncIterableIterator<Either<APIError, Readonly<TwitterUser>>> {
  let cursor = '-1'
  while (true) {
    try {
      let json: FollowsListResponse
      switch (followKind) {
        case 'followers':
          json = await getFollowersList(user, cursor)
          break
        case 'following':
          json = await getFollowingsList(user, cursor)
          break
        default:
          throw new Error('unreachable')
      }
      cursor = json.next_cursor_str
      const users = json.users as TwitterUser[]
      yield* users.map(user => ({
        ok: true as const,
        value: user,
      }))
      if (cursor === '0') {
        break
      } else {
        await sleep(options.delay)
        continue
      }
    } catch (error) {
      if (error instanceof APIError) {
        yield {
          ok: false,
          error,
        }
      } else {
        throw error
      }
    }
  }
}

export async function getSingleUserById(userId: string): Promise<TwitterUser> {
  const response = await sendRequest('get', '/users/show.json', {
    user_id: userId,
    skip_status: true,
    include_entities: false,
  })
  if (response.ok) {
    return response.body as TwitterUser
  } else {
    throw new APIError(response)
  }
}

export async function getSingleUserByName(userName: string): Promise<TwitterUser> {
  const isValidUserName = validateTwitterUserName(userName)
  if (!isValidUserName) {
    throw new Error(`Invalid user name "${userName}"!`)
  }
  const response = await sendRequest('get', '/users/show.json', {
    // user_id: user.id_str,
    screen_name: userName,
    skip_status: true,
    include_entities: false,
  })
  if (response.ok) {
    return response.body as TwitterUser
  } else {
    throw new APIError(response)
  }
}

export async function getMultipleUsersById(userIds: string[]): Promise<TwitterUser[]> {
  if (userIds.length === 0) {
    return []
  }
  if (userIds.length > 100) {
    throw new Error('too many users! (> 100)')
  }
  const joinedIds = Array.from(new Set(userIds)).join(',')
  const response = await sendRequest('post', '/users/lookup.json', {
    user_id: joinedIds,
    include_entities: false,
    // screen_name: ...
  })
  if (response.ok) {
    return response.body as TwitterUser[]
  } else {
    throw new APIError(response)
  }
}

export async function getFriendships(users: TwitterUser[]): Promise<FriendshipResponse> {
  const userIds = users.map(user => user.id_str)
  if (userIds.length === 0) {
    return []
  }
  if (userIds.length > 100) {
    throw new Error('too many users! (> 100)')
  }
  const joinedIds = Array.from(new Set(userIds)).join(',')
  const response = await sendRequest('get', '/friendships/lookup.json', {
    user_id: joinedIds,
  })
  if (response.ok) {
    return response.body as FriendshipResponse
  } else {
    throw new Error('response is not ok')
  }
}

export async function getRelationship(
  sourceUser: TwitterUser,
  targetUser: TwitterUser,
): Promise<Relationship> {
  const source_id = sourceUser.id_str
  const target_id = targetUser.id_str
  const response = await sendRequest('get', '/friendships/show.json', {
    source_id,
    target_id,
  })
  if (response.ok) {
    const { relationship } = response.body as {
      relationship: Relationship
    }
    return relationship
  } else {
    throw new Error('response is not ok')
  }
}

export async function getMyself(): Promise<TwitterUser> {
  const response = await sendRequest('get', '/account/verify_credentials.json')
  if (response.ok) {
    return response.body as TwitterUser
  } else {
    throw new APIError(response)
  }
}

export async function getRateLimitStatus(): Promise<LimitStatus> {
  const response = await sendRequest('get', '/application/rate_limit_status.json')
  const { resources } = response.body as {
    resources: LimitStatus
  }
  return resources
}

export async function getFollowsScraperRateLimitStatus(followKind: FollowKind): Promise<Limit> {
  const limitStatus = await getRateLimitStatus()
  if (followKind === 'followers') {
    return limitStatus.followers['/followers/list']
  } else if (followKind === 'following') {
    return limitStatus.friends['/friends/list']
  } else {
    throw new Error('unreachable')
  }
}

function getCsrfTokenFromCookies(): string {
  return /\bct0=([0-9a-f]+)/i.exec(document.cookie)![1]!
}

function generateTwitterAPIOptions(obj: RequestInit): RequestInit {
  const csrfToken = getCsrfTokenFromCookies()
  const headers = new Headers()
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-csrf-token', csrfToken)
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

function setDefaultParams(params: URLSearchParams): void {
  params.set('include_profile_interstitial_type', '1')
  params.set('include_blocking', '1')
  params.set('include_blocked_by', '1')
  params.set('include_followed_by', '1')
  params.set('include_want_retweets', '1')
  params.set('include_mute_edge', '1')
  params.set('include_can_dm', '1')
}

export async function sendRequest(
  method: HTTPMethods,
  path: string,
  paramsObj: URLParamsObj = {},
): Promise<APIResponse> {
  const fetchOptions = generateTwitterAPIOptions({ method })
  const url = new URL(apiPrefix + path)
  let params: URLSearchParams
  if (method === 'get') {
    params = url.searchParams
  } else {
    params = new URLSearchParams()
    fetchOptions.body = params
  }
  setDefaultParams(params)
  for (const [key, value] of Object.entries(paramsObj)) {
    params.set(key, value.toString())
  }
  const response = await fetch(url.toString(), fetchOptions)
  const headers = Array.from(response.headers).reduce(
    (obj, [name, value]) => ((obj[name] = value), obj),
    {} as { [name: string]: string },
  )
  const { ok, status, statusText } = response
  const body = await response.json()
  const apiResponse = {
    ok,
    status,
    statusText,
    headers,
    body,
  }
  return apiResponse
}
