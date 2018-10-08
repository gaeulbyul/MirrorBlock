// 모바일 트위터웹의 main.{hash}.js에 하드코딩되어있는 값
const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

class RateLimitError extends Error {}
class HTTPError extends Error {}

function generateTwitterAPIOptions (obj?: RequestInit): RequestInit {
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
    headers
  }
  Object.assign(result, obj)
  return result
}

// 트위터의 API를 통해 사용자차단을 요청
async function sendBlockRequest (userId: string): Promise<boolean> {
  const fetchOptions = generateTwitterAPIOptions({
    method: 'post'
  })
  const body = new URLSearchParams()
  body.set('user_id', userId)
  body.set('include_entities', 'false')
  body.set('skip_status', 'true')
  fetchOptions.body = body
  const url = 'https://api.twitter.com/1.1/blocks/create.json'
  const response = await fetch(url, fetchOptions)
  return response.ok
}

interface FollowsListResponse {
  users: TwitterAPIUser[],
  next_cursor_str: string
}

async function getFollowsList (followType: FollowType, userName: string, cursor: string = '-1'): Promise<FollowsListResponse> {
  const fetchOptions = generateTwitterAPIOptions()
  const path = followType === FollowType.following ? 'friends' : 'followers'
  const url = new URL(`https://api.twitter.com/1.1/${path}/list.json`)
  // url.searchParams.set('user_id', userId)
  url.searchParams.set('screen_name', userName)
  url.searchParams.set('count', '200')
  url.searchParams.set('skip_status', 'true')
  url.searchParams.set('include_user_entities', 'false')
  // private area
  url.searchParams.set('include_profile_interstitial_type', '1')
  url.searchParams.set('include_blocking', '1')
  url.searchParams.set('include_blocked_by', '1')
  url.searchParams.set('include_followed_by', '1')
  url.searchParams.set('include_want_retweets', '1')
  url.searchParams.set('include_mute_edge', '1')
  url.searchParams.set('include_can_dm', '1')
  url.searchParams.set('cursor', cursor)
  const response = await fetch(url.toString(), fetchOptions)
  if (response.ok) {
    return response.json()
  } else {
    if (response.status === 429) {
      throw new RateLimitError('LimitError!')
    } else {
      throw new HTTPError('HTTPError!')
    }
  }
}

async function getSingleUserByName (userName: string): Promise<TwitterAPIUser> {
  const fetchOptions = generateTwitterAPIOptions()
  const url = new URL('https://api.twitter.com/1.1/users/show.json')
  // url.searchParams.set('user_id', userId)
  url.searchParams.set('screen_name', userName)
  url.searchParams.set('count', '200')
  url.searchParams.set('skip_status', 'true')
  url.searchParams.set('include_entities', 'false')
  url.searchParams.set('include_profile_interstitial_type', '1')
  url.searchParams.set('include_blocking', '1')
  url.searchParams.set('include_blocked_by', '1')
  url.searchParams.set('include_followed_by', '1')
  url.searchParams.set('include_want_retweets', '1')
  url.searchParams.set('include_mute_edge', '1')
  url.searchParams.set('include_can_dm', '1')
  const response = await fetch(url.toString(), fetchOptions)
  if (response.ok) {
    return response.json()
  } else {
    if (response.status === 429) {
      throw new RateLimitError('LimitError!')
    } else {
      throw new HTTPError('HTTPError!')
    }
  }
}
