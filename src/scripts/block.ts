/* globals
  fetch,
  location,
  URLSearchParams,
  Headers,
  URL,
*/

// 모바일 트위터웹의 main.{hash}.js에 하드코딩되어있는 값
const BEARER_TOKEN = `AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`

// eslint-disable-next-line no-unused-vars
function generateTwitterAPIOptions (obj: RequestInit): RequestInit | null {
  let csrfToken: string
  const match = /\bct0=([0-9a-f]{32})\b/.exec(document.cookie)
  if (match && match[1]) {
    csrfToken = match[1]
  } else {
    console.error('Failed to get CSRF token.')
    return null
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
// eslint-disable-next-line no-unused-vars
async function sendBlockRequest (userId: string) {
  const fetchOptions = generateTwitterAPIOptions({
    method: 'post'
  })
  if (!fetchOptions) {
    throw new Error('Something wrong...')
  }
  const body = new URLSearchParams()
  body.set('user_id', userId)
  body.set('include_entities', 'false')
  body.set('skip_status', 'true')
  fetchOptions.body = body.toString()
  // const url = new URL('https://api.twitter.com/1.1/blocks/create.json')
  const url = 'https://api.twitter.com/1.1/blocks/create.json'
  const response = await fetch(url, fetchOptions)
  return response.text()
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function changeButtonToBlocked (profile: Element) { // eslint-disable-line no-unused-vars
  const actions = profile.querySelector('.user-actions')
  if (actions) {
    actions.classList.remove('not-following')
    actions.classList.add('blocked')
  }
}
