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
function getCSRFToken () {
  const match = /\bct0=([0-9a-f]{32})\b/.exec(document.cookie)
  if (match && match[1]) {
    return match[1]
  } else {
    throw new Error('Failed to get CSRF token.')
  }
}

// eslint-disable-next-line no-unused-vars
function generateTwitterAPIOptions (obj) {
  const csrfToken = getCSRFToken()
  const headers = new Headers()
  headers.set('authorization', `Bearer ${BEARER_TOKEN}`)
  headers.set('x-csrf-token', csrfToken)
  headers.set('x-twitter-active-user', 'yes')
  headers.set('x-twitter-auth-type', 'OAuth2Session')
  const result = {
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
async function sendBlockRequest (userId) {
  const fetchOptions = generateTwitterAPIOptions({
    method: 'post'
  })
  const body = fetchOptions.body = new URLSearchParams()
  body.set('user_id', userId)
  body.set('include_entities', 'false')
  body.set('skip_status', 'true')
  const url = new URL('https://api.twitter.com/1.1/blocks/create.json')
  const response = await fetch(url, fetchOptions)
  return response.text()
}

// 트위터 서버에 차단 요청을 보냄.
function sendBlockRequestViaTwitter (userId) { // eslint-disable-line no-unused-vars
  const authenticityToken = document.getElementById('authenticity_token').value
  const requestBody = new URLSearchParams()
  requestBody.append('authenticity_token', authenticityToken)
  requestBody.append('challenges_passed', 'false')
  requestBody.append('handles_challenges', '1')
  requestBody.append('impression_id', '')
  requestBody.append('user_id', userId)
  // [1]: referrer
  // Chrome에선 referrer속성 없이도 정상적으로 작동하지만
  // Firefox에서 그러면 referer 없이 요청을 보내서 403에러가 난다.
  // 따라서 직접 명시하도록 했음.
  const fetchOptions = {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    referrer: location.href, // [1]
    body: requestBody
  }
  return fetch('https://twitter.com/i/user/block', fetchOptions).then(response => {
    if (response.ok) {
      return response
    } else {
      console.dir(response)
      throw new Error(response)
    }
  })
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function changeButtonToBlocked (profile) { // eslint-disable-line no-unused-vars
  const actions = profile.querySelector('.user-actions')
  actions.classList.remove('not-following')
  actions.classList.add('blocked')
}
