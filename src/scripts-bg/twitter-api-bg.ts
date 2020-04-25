const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

interface MultiAccountCookies {
  [userId: string]: string
}

async function getCsrfTokenFromCookies(): Promise<string> {
  const csrfTokenCookie = await browser.cookies.get({
    url: 'https://twitter.com',
    name: 'ct0',
  })
  if (!csrfTokenCookie) {
    throw new Error('failed to get csrf token!')
  }
  return csrfTokenCookie.value
}

async function getMultiAccountCookies(): Promise<MultiAccountCookies> {
  const url = 'https://twitter.com'
  const authMultiCookie = await browser.cookies.get({
    url,
    name: 'auth_multi',
  })
  if (!authMultiCookie) {
    return {}
  }
  return parseAuthMultiCookie(authMultiCookie.value)
}

function parseAuthMultiCookie(authMulti: string): MultiAccountCookies {
  // "{userid}:{token}|{userid}:{token}|..."
  const userTokenPairs = authMulti
    .replace(/^"|"$/g, '')
    .split('|')
    .map(pair => pair.split(':') as [string, string])
  return Object.fromEntries(userTokenPairs)
}

async function generateTwitterAPIOptions(obj: RequestInit, actAsUserId = ''): Promise<RequestInit> {
  const csrfToken = await getCsrfTokenFromCookies()
  const headers = new Headers()
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-csrf-token', csrfToken)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  if (actAsUserId) {
    const multiCookies = await getMultiAccountCookies()
    const token = multiCookies[actAsUserId]
    headers.set('x-act-as-user-id', actAsUserId)
    headers.set('x-act-as-user-token', token)
  }
  const result: RequestInit = {
    method: 'get',
    mode: 'cors',
    credentials: 'include',
    referrer: 'https://twitter.com/',
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

export async function requestAPI(
  method: HTTPMethods,
  path: string,
  paramsObj: URLParamsObj = {},
  actAsUserId = ''
): Promise<APIResponse> {
  const fetchOptions = await generateTwitterAPIOptions(
    {
      method,
    },
    actAsUserId
  )
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
  const headers = Array.from(response.headers).reduce(
    (obj, [name, value]) => ((obj[name] = value), obj),
    {} as { [name: string]: string }
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

async function getSingleUserByIdAsActor(
  userId: string,
  actAsUserId: string
): Promise<TwitterUser | null> {
  const response = await requestAPI(
    'get',
    '/users/show.json',
    {
      user_id: userId,
      skip_status: true,
      include_entities: false,
    },
    actAsUserId
  )
  if (response.ok) {
    return response.body as TwitterUser
  } else {
    return null
  }
}

export async function examineChainBlockableActor(targetUserId: string): Promise<string | null> {
  const multiCookies = await getMultiAccountCookies()
  const actorUserIds = Object.keys(multiCookies)
  for (const actorId of actorUserIds) {
    const target = await getSingleUserByIdAsActor(targetUserId, actorId)
    if (target && !target.blocked_by) {
      return actorId
    }
  }
  return null
}
