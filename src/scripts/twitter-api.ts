namespace TwitterAPI {
  const {
    requestAPI: requestAPIDirectly,
    APIError,
    RateLimitError,
  } = MirrorBlock.APICommon
  type RequestAPIMessage = MirrorBlockInject.Messaging.RequestAPIMessage

  export function validateTwitterUserName(userName: string): boolean {
    return MirrorBlock.Utils.validateTwitterUserName(userName)
  }

  async function requestAPI<T>(
    method: HTTPMethods,
    path: string,
    params: URLParamsObj = {}
  ): Promise<APIResponse<T>> {
    if (location.hostname === 'twitter.com') {
      return requestAPIDirectly<T>(method, path, params)
    } else {
      return requestAPIViaProxy<T>(method, path, params)
    }
  }

  async function requestAPIViaProxy<T>(
    method: HTTPMethods,
    path: string,
    params: URLParamsObj = {}
  ): Promise<APIResponse<T>> {
    const nonce = String(Date.now() + Math.random())
    const origin =
      location.hostname === 'mobile.twitter.com'
        ? 'https://mobile.twitter.com'
        : 'https://twitter.com'
    return new Promise((resolve, reject) => {
      let timeout = 0
      const eventName = `TwitterAPI->[nonce:${nonce}]`
      const handleEvent = (ev: Event) => {
        if (timeout) {
          window.clearTimeout(timeout)
        }
        const { response } = (ev as CustomEvent<{
          response: APIResponse<T>
        }>).detail
        console.debug('received %o', [nonce, response])
        resolve(response)
      }
      timeout = window.setTimeout(() => {
        reject('time out!')
        document.removeEventListener(eventName, handleEvent)
      }, 10000)
      document.addEventListener(eventName, handleEvent, {
        once: true,
      })
      const message: RequestAPIMessage = {
        '>_< mirrorblock': 'requestAPI',
        nonce,
        method,
        path,
        params,
      }
      window.postMessage(message, origin)
    })
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
    return response.ok
  }

  async function getFollowingsList(
    user: TwitterUser,
    cursor: string = '-1'
  ): Promise<FollowsListResponse> {
    const response = await requestAPI<FollowsListResponse>(
      'get',
      '/friends/list.json',
      {
        user_id: user.id_str,
        count: 200,
        skip_status: true,
        include_user_entities: false,
        cursor,
      }
    )
    if (response.ok) {
      return response.body
    } else {
      throw new APIError(response)
    }
  }

  async function getFollowersList(
    user: TwitterUser,
    cursor: string = '-1'
  ): Promise<FollowsListResponse> {
    const response = await requestAPI<FollowsListResponse>(
      'get',
      '/followers/list.json',
      {
        user_id: user.id_str,
        // screen_name: userName,
        count: 200,
        skip_status: true,
        include_user_entities: false,
        cursor,
      }
    )
    if (response.ok) {
      return response.body
    } else {
      throw new APIError(response)
    }
  }

  export async function* getAllFollows(
    user: TwitterUser,
    followType: FollowType,
    options: FollowsScraperOptions
  ): AsyncIterableIterator<RateLimited<Readonly<TwitterUser>>> {
    let cursor = '-1'
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
        yield* users.map(u => Object.freeze(u))
        if (cursor === '0') {
          break
        } else {
          await MirrorBlock.Utils.sleep(options.delay)
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
    const response = await requestAPI<TwitterUser>('get', '/users/show.json', {
      user_id: userId,
      skip_status: true,
      include_entities: false,
    })
    if (response.ok) {
      return response.body
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
    const response = await requestAPI<TwitterUser>('get', '/users/show.json', {
      // user_id: user.id_str,
      screen_name: userName,
      skip_status: true,
      include_entities: false,
    })
    if (response.ok) {
      return response.body
    } else {
      throw new APIError(response)
    }
  }

  export async function getMultipleUsersById(
    userIds: string[]
  ): Promise<TwitterUser[]> {
    if (userIds.length === 0) {
      return []
    }
    if (userIds.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    const joinedIds = Array.from(new Set(userIds)).join(',')
    const response = await requestAPI<TwitterUser[]>(
      'post',
      '/users/lookup.json',
      {
        user_id: joinedIds,
        include_entities: false,
        // screen_name: ...
      }
    )
    if (response.ok) {
      return response.body
    } else {
      throw new APIError(response)
    }
  }

  export async function getFriendships(
    users: TwitterUser[]
  ): Promise<FriendshipResponse> {
    const userIds = users.map(user => user.id_str)
    if (userIds.length === 0) {
      return []
    }
    if (userIds.length > 100) {
      throw new Error('too many users! (> 100)')
    }
    const joinedIds = Array.from(new Set(userIds)).join(',')
    const response = await requestAPI<FriendshipResponse>(
      'get',
      '/friendships/lookup.json',
      {
        user_id: joinedIds,
      }
    )
    if (response.ok) {
      return response.body
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getRelationship(
    sourceUser: TwitterUser,
    targetUser: TwitterUser
  ): Promise<Relationship> {
    interface RelationshipResponse {
      relationship: Relationship
    }
    const source_id = sourceUser.id_str
    const target_id = targetUser.id_str
    const response = await requestAPI<RelationshipResponse>(
      'get',
      '/friendships/show.json',
      {
        source_id,
        target_id,
      }
    )
    if (response.ok) {
      return response.body.relationship
    } else {
      throw new Error('response is not ok')
    }
  }

  export async function getMyself(): Promise<TwitterUser> {
    const response = await requestAPI<TwitterUser>(
      'get',
      '/account/verify_credentials.json'
    )
    if (response.ok) {
      return response.body
    } else {
      throw new APIError(response)
    }
  }

  export async function getRateLimitStatus(): Promise<LimitStatus> {
    interface LimitStatusResponse {
      resources: LimitStatus
    }
    const response = await requestAPI<LimitStatusResponse>(
      'get',
      '/application/rate_limit_status.json'
    )
    const resources = response.body.resources
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
