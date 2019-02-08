namespace TwitterAPI {
  const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`
  const USER_NAME_BLACKLIST = [
    '1',
    'about',
    'account',
    'followers',
    'followings',
    'hashtag',
    'i',
    'lists',
    'login',
    'oauth',
    'privacy',
    'search',
    'tos',
    'notifications',
    'messages',
    'explore',
  ]

  export class APIError extends Error {
    constructor(public readonly response: Response) {
      super('Received non-OK response from Twitter API')
      Object.setPrototypeOf(this, new.target.prototype)
    }
  }

  export class RateLimitError extends APIError {
    public async getLimitStatus(): Promise<LimitStatus> {
      return getRateLimitStatus()
    }
  }

  function validateTwitterUserName(userName: string): boolean {
    const unl = userName.length
    const userNameIsValidLength = 1 <= unl && unl <= 15
    if (!userNameIsValidLength) {
      return false
    }
    const lowerCasedUserName = userName.toLowerCase()
    if (USER_NAME_BLACKLIST.includes(lowerCasedUserName)) {
      return false
    }
    return true
  }

  function rateLimited(resp: Response): boolean {
    return resp.status === 429
  }

  function generateTwitterAPIOptions(obj?: RequestInit): RequestInit {
    let csrfToken: string
    const match = /\bct0=([0-9a-f]{32})\b/.exec(document.cookie)
    if (match && match[1]) {
      csrfToken = match[1]
    } else {
      throw new Error('Failed to get CSRF token.')
    }
    const headers = new Headers()
    headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
    headers.set('x-csrf-token', csrfToken)
    headers.set('x-twitter-active-user', 'yes')
    headers.set('x-twitter-auth-type', 'OAuth2Session')
    const result: RequestInit = {
      method: 'get',
      mode: 'cors',
      credentials: 'include',
      referrer: location.href,
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

  async function requestAPI(
    method: HTTPMethods,
    path: string,
    paramsObj: URLParamsObj = {}
  ): Promise<Response> {
    const fetchOptions = generateTwitterAPIOptions({
      method,
    })
    const url = new URL('https://api.twitter.com/1.1' + path)
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
    if (rateLimited(response)) {
      throw new RateLimitError(response)
    }
    return response
  }

  export async function blockUser(user: TwitterUser): Promise<boolean> {
    if (user.blocking) {
      return true
    }
    const shouldNotBlock =
      user.following ||
      user.followed_by ||
      user.follow_request_sent ||
      !user.blocked_by
    if (shouldNotBlock) {
      const fatalErrorMessage = `!!!!! FATAL!!!!!: attempted to block user that should NOT block!!
(user: ${user.screen_name})`
      console.error(fatalErrorMessage)
      throw new Error(fatalErrorMessage)
    }
    return blockUserById(user.id_str)
  }

  export async function blockUserById(userId: string): Promise<boolean> {
    const response = await requestAPI('post', '/blocks/create.json', {
      user_id: userId,
      include_entities: false,
      skip_status: true,
    })
    void response.text()
    return response.ok
  }

  async function getFollowingsList(
    user: TwitterUser,
    cursor: string = '-1'
  ): Promise<FollowsListResponse> {
    const response = await requestAPI('get', '/friends/list.json', {
      user_id: user.id_str,
      count: 200,
      skip_status: true,
      include_user_entities: false,
      cursor,
    })
    if (response.ok) {
      return response.json() as Promise<FollowsListResponse>
    } else {
      throw new APIError(response)
    }
  }

  async function getFollowersList(
    user: TwitterUser,
    cursor: string = '-1'
  ): Promise<FollowsListResponse> {
    const response = await requestAPI('get', '/followers/list.json', {
      user_id: user.id_str,
      // screen_name: userName,
      count: 200,
      skip_status: true,
      include_user_entities: false,
      cursor,
    })
    if (response.ok) {
      return response.json() as Promise<FollowsListResponse>
    } else {
      throw new APIError(response)
    }
  }

  export async function* getAllFollows(
    user: TwitterUser,
    followType: FollowType,
    options: FollowsScraperOptions
  ): AsyncIterableIterator<RateLimited<TwitterUser>> {
    let cursor: string = options.firstCursor || '-1'
    while (true) {
      try {
        let json: FollowsListResponse
        switch (followType) {
          case FollowType.followers:
            json = await getFollowersList(user, cursor)
            break
          case FollowType.following:
            json = await getFollowingsList(user, cursor)
            break
          default:
            throw new Error('unreachable')
        }
        cursor = json.next_cursor_str
        const users = json.users as TwitterUser[]
        if (options.includeCursor) {
          yield* users.map(user => {
            user.$_cursor = cursor
            return user
          })
        } else {
          yield* users
        }
        if (cursor === '0') {
          break
        } else {
          await sleep(options.delay)
          continue
        }
      } catch (e) {
        if (e instanceof RateLimitError) {
          yield 'RateLimitError'
        } else {
          throw e
        }
      }
    }
  }

  export async function getSingleUserById(
    userId: string
  ): Promise<TwitterUser> {
    const response = await requestAPI('get', '/users/show.json', {
      user_id: userId,
      skip_status: true,
      include_entities: false,
    })
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new APIError(response)
    }
  }

  export async function getSingleUserByName(
    userName: string
  ): Promise<TwitterUser> {
    const isValidUserName = validateTwitterUserName(userName)
    if (!isValidUserName) {
      throw new Error(`Invalid user name "${userName}"!`)
    }
    const response = await requestAPI('get', '/users/show.json', {
      // user_id: user.id_str,
      screen_name: userName,
      skip_status: true,
      include_entities: false,
    })
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new APIError(response)
    }
  }

  export async function getMultipleUsersByName(
    userNames: string[]
  ): Promise<TwitterUser[]> {
    if (userNames.length === 0) {
      return []
    }
    if (userNames.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    const joinedNames = Array.from(new Set(userNames)).join(',')
    const everyNamesAreValid = userNames.every(validateTwitterUserName)
    if (!everyNamesAreValid) {
      throw new Error(`Someone's name is invalid! check:[${joinedNames}]`)
    }
    const response = await requestAPI('post', '/users/lookup.json', {
      screen_name: joinedNames,
      include_entities: false,
      // user_id: ...
    })
    if (response.ok) {
      return response.json() as Promise<TwitterUser[]>
    } else {
      throw new APIError(response)
    }
  }

  export async function getMyself(): Promise<TwitterUser> {
    const response = await requestAPI('get', '/account/verify_credentials.json')
    if (response.ok) {
      return response.json() as Promise<TwitterUser>
    } else {
      throw new APIError(response)
    }
  }

  export async function getRateLimitStatus(): Promise<LimitStatus> {
    const response = await requestAPI(
      'get',
      '/application/rate_limit_status.json'
    )
    const resources = (await response.json()).resources as LimitStatus
    return resources
  }

  export async function getFollowsScraperRateLimitStatus(
    followType: FollowType
  ): Promise<Limit> {
    const limitStatus = await TwitterAPI.getRateLimitStatus()
    if (followType === FollowType.followers) {
      return limitStatus.followers['/followers/list']
    } else if (followType === FollowType.following) {
      return limitStatus.friends['/friends/list']
    } else {
      throw new Error('unreachable')
    }
  }
}
