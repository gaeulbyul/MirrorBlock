interface TwitterAPIUser {
  id_str: string,
  screen_name: string,
  name: string,
  blocked_by: boolean,
  blocking: boolean,
  muting: boolean,
  friends_count: number,
  followers_count: number,
  description: string
}

interface FollowsListResponse {
  users: TwitterAPIUser[],
  next_cursor_str: string
}

interface Limit {
  limit: number,
  remaining: number,
  reset: number
}

interface Resources {
  application: {
    '/application/rate_limit_status': Limit
  },
  auth: {
    '/auth/csrf_token': Limit
  },
  blocks: {
    '/blocks/list': Limit,
    '/blocks/ids': Limit
  },
  followers: {
    '/followers/ids': Limit,
    '/followers/list': Limit
  },
  friends: {
    '/friends/following/ids': Limit,
    '/friends/following/list': Limit,
    '/friends/list': Limit,
    '/friends/ids': Limit
  }
}

interface LimitStatus {
  resources: Resources
}
