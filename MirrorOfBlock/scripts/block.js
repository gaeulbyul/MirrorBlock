/* globals fetch, URLSearchParams, location */

// 트위터 서버에 차단 요청을 보냄.
function sendBlockRequest (userId) { // eslint-disable-line no-unused-vars
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
