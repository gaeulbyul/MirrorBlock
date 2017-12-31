/* globals location, fetch, URLSearchParams, $ */
// some code taken from:
// https://github.com/satsukitv/twitter-block-chain

function restoreConsole () {
  if (/\[native code]/.test(window.console.log.toString())) {
    return
  }
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  window.console = Object.freeze(iframe.contentWindow.console)
}

function sendBlockRequest (userId) {
  const authenticityToken = $('#authenticity_token').val()
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

function chainBlock (callbacks) {
  const targets = []
  const skipped = []
  let currentList = ''
  if (/\/followers$/.test(location.pathname)) {
    currentList = 'followers'
  } else if (/\/followings$/.test(location.pathname)) {
    currentList = 'followings'
  } else {
    throw new Error('unsupported page')
  }
  function scanner (data, callbacks) {
    const {progressCallback, finalCallback} = callbacks
    const cards = $(data.items_html).find('.ProfileCard')
    Array.from(cards).forEach(card_ => {
      const $card = $(card_)
      const blocksYou = $card.find('.blocks-you').length > 0
      const actions = $($card.find('.user-actions'))
      const userId = String(actions.data('user-id'))
      const userName = actions.data('screen-name')
      const userNickName = $card.find('.fullname').text().trim()
      const alreadyBlocked = $card.find('.blocked').length > 0
      const muted = $card.find('.muting').length > 0
      if (!blocksYou) {
        return
      }
      if (alreadyBlocked) {
        console.log('이미 차단한 사용자! @%s(%s) - %s', userName, userId, userNickName)
        skipped.push({
          userId,
          userName,
          userNickName,
          reason: 'already-blocked'
        })
      } else if (muted) {
        console.log('뮤트한 사용자! @%s(%s) - %s', userName, userId, userNickName)
        skipped.push({
          userId,
          userName,
          userNickName,
          reason: 'muted'
        })
      } else {
        console.log('체인블락 타깃 발견! @%s(%s) - %s', userName, userId, userNickName)
        targets.push({userId, userName, userNickName})
      }
    })
    if (data.has_more_items) {
      const profileUsername = $('.ProfileHeaderCard .username b').text()
      const moreUsersUrl = `https://twitter.com/${profileUsername}/${currentList}/users?include_available_features=1&include_entities=1&reset_error_state=false&max_position=${data.min_position}`
      const fetchOptions = {
        method: 'GET',
        credentials: 'include',
        referrer: location.href
      }
      setTimeout(() => {
        fetch(moreUsersUrl, fetchOptions).then(async response => {
          const json = await response.json()
          progressCallback({targets, skipped})
          scanner(json, callbacks)
        })
      }, 500 + (Math.round(Math.random() * 400)))
    } else if (typeof finalCallback === 'function') {
      finalCallback({targets, skipped})
    }
  }
  const grid = $('.GridTimeline-items')
  scanner({
    items_html: grid.html(),
    min_position: grid.data('min-position'),
    has_more_items: true
  }, callbacks)
}

function doChainBlock () {
  chainBlock({
    progressCallback ({targets, skipped}) {
      console.log(`체인블락 중간 보고: 타겟 ${targets.length}명, 스킵 ${skipped.length}명`)
    },
    async finalCallback ({targets, skipped}) {
      console.group('체인블락 결과 보고:')
      console.log(`타겟 ${targets.length}명, 스킵 ${skipped.length}명`)
      console.dir({targets, skipped})
      console.groupEnd()

      const confirmMessage = `\
${targets.map(({userName, userNickName}) => `${userName}: ${userNickName}\n`)}
-----
Are you sure to Block?`
      if (window.confirm(confirmMessage)) {
        for (const user of targets) {
          const {userId} = user
          await sendBlockRequest(userId)
        }
      }
    }
  })
}

restoreConsole()
if (window.confirm('Are you sure to want Chain-block?')) {
  doChainBlock()
}
