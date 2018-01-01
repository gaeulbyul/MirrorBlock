/* globals fetch, location, $, sendBlockRequest, changeButtonToBlocked */

// some code taken from:
// https://github.com/satsukitv/twitter-block-chain

function restoreConsole () {
  if (/\[native code]/.test(window.console.log.toString())) {
    return
  }
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  window.console = new Proxy(iframe.contentWindow.console, {
    set () {
      return true
    }
  })
}

function chainBlock (callbacks) {
  const targets = []
  const skipped = []
  const newTargets = []
  const newSkipped = []
  let totalCount = 0
  let currentList = ''
  if (/\/followers$/.test(location.pathname)) {
    currentList = 'followers'
  } else if (/\/following$/.test(location.pathname)) {
    currentList = 'following'
  } else {
    throw new Error('unsupported page')
  }
  function scanner (data, callbacks) {
    const {progressCallback, finalCallback} = callbacks
    const cards = $(data.items_html).find('.ProfileCard')
    cards.each((index, card_) => {
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
        const user = {
          userId,
          userName,
          userNickName,
          reason: 'already-blocked'
        }
        skipped.push(user)
        newSkipped.push(user)
      } else if (muted) {
        console.log('뮤트한 사용자! @%s(%s) - %s', userName, userId, userNickName)
        const user = {
          userId,
          userName,
          userNickName,
          reason: 'muted'
        }
        skipped.push(user)
        newSkipped.push(user)
      } else {
        console.log('체인블락 타겟 발견! @%s(%s) - %s', userName, userId, userNickName)
        const user = {
          userId,
          userName,
          userNickName,
          reason: null
        }
        targets.push(user)
        newTargets.push(user)
      }
    })
    totalCount += cards.length
    if (data.has_more_items) {
      const profileUsername = $('.ProfileHeaderCard .username b').text()
      const moreUsersUrl = `https://twitter.com/${profileUsername}/${currentList}/users?include_available_features=1&include_entities=1&reset_error_state=false&max_position=${data.min_position}`
      const fetchOptions = {
        method: 'GET',
        credentials: 'include',
        referrer: location.href
      }
      setTimeout(async () => {
        const response = await fetch(moreUsersUrl, fetchOptions)
        const json = await response.json()
        progressCallback({
          targets,
          skipped,
          newTargets: newTargets.slice(),
          newSkipped: newSkipped.slice(),
          count: cards.length,
          totalCount
        })
        newTargets.length = newSkipped.length = 0
        scanner(json, callbacks)
      }, 200 + (Math.round(Math.random() * 400)))
    } else if (typeof finalCallback === 'function') {
      progressCallback({
        targets,
        skipped,
        newTargets: newTargets.slice(),
        newSkipped: newSkipped.slice(),
        count: cards.length,
        totalCount
      })
      newTargets.length = newSkipped.length = 0
      finalCallback({
        targets,
        skipped,
        totalCount
      })
    }
  }
  const grid = $('.GridTimeline-items')
  scanner({
    items_html: grid.html(),
    min_position: grid.data('min-position'),
    has_more_items: true
  }, callbacks)
}

function doChainBlock (ui) {
  function makeUser (user) {
    const {userId, userName, userNickName, reason} = user
    let userPrefix = ''
    if (reason === 'already-blocked') {
      userPrefix = '[Blocked] '
    } else if (reason === 'muted') {
      userPrefix = '[Skip] '
    }
    return $('<a>')
      .css('display', 'block')
      .attr('data-user-id', userId)
      .attr('href', `https://twitter.com/${userName}`)
      .text(`${userPrefix} @${userName}: ${userNickName}`)
  }
  chainBlock({
    progressCallback ({targets, skipped, newTargets, newSkipped, totalCount}) {
      ui.find('.mobcb-progress').text(
        `체인블락 중간 보고: ${totalCount}명 중 타겟 ${targets.length}명, 스킵 ${skipped.length}명`
      )
      newTargets.forEach(user => {
        const a = makeUser(user)
        ui.find('.mobcb-target-users').append(a)
      })
      newSkipped.forEach(user => {
        const a = makeUser(user)
        ui.find('.mobcb-skipped-users').append(a)
      })
    },
    finalCallback ({targets, skipped, totalCount}) {
      ui.find('.mobcb-progress').text(
        `체인블락 결과 보고: ${totalCount}명 중 타겟 ${targets.length}명, 스킵 ${skipped.length}명`
      )
      ui.find('.mobcb-bottom-message').text(`${targets.length}명 차단 가능`)
      if (targets.length === 0 && skipped.length === 0) {
        window.alert('여기에선 아무도 나를 차단하지 않았습니다.')
        ui.remove()
        return
      } else if (targets.length > 0) {
        ui.find('.mobcb-controls .btn').prop('disabled', false)
      }
      ui.find('.mobcb-execute').click(event => {
        event.preventDefault()
        if (targets.length === 0) {
          window.alert('차단할 사용자가 없습니다.')
          return
        }
        if (window.confirm('실제로 차단하시겠습니까?')) {
          const promises = targets.map(user => {
            const {userId} = user
            return sendBlockRequest(userId)
              .then(() => ' \u2714', () => ' \u274C')
              .then(result => {
                const text = document.createTextNode(result)
                ui.find(`.mobcb-target-users a[data-user-id="${userId}"]`).prepend(text)
                return {
                  user,
                  ok: result === ' \u2714'
                }
              })
          })
          Promise.all(promises).then(results => {
            const successes = results.filter(x => x.ok)
            ui.find('.mobcb-execute').prop('disabled', true)
            ui.find('.mobcb-bottom-message').text(`${successes.length}명 차단 완료!`)
            for (const result of successes) {
              const {userId} = result.user
              const profileCard = $(`.ProfileCard[data-user-id="${userId}"]`)
              profileCard.each((_, card) => changeButtonToBlocked(card))
            }
            targets.length = 0
          })
        }
      })
      console.dir({targets, skipped})
    }
  })
}

function initUI () {
  const CHAINBLOCK_CSS = `
    .mobcb-bg {
      position: fixed;
      display: flex;
      justify-content: center;
      align-items: center;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      overflow: hidden;
      background-color: rgba(0, 0, 0, .6);
    }
    hr.mobcb-hr {
      margin: 3px 0;
    }
    .mobcb-dialog {
      padding: 15px;
      display: flex;
      flex-direction: column;
      width: 450px;
      max-height: 80vh;
    }
    .mobcb-users {
      min-width: 60px;
      overflow-y: scroll;
    }
    .mobcb-controls {
      margin-top: 5px;
    }
    .mobcb-bottom-message {
      float: left;
      padding: 10px 0;
    }
    .mobcb-controls .btn ~ .btn {
      margin: 0 5px;
    }
  `
  $('<div>').html(`&shy;<style>${CHAINBLOCK_CSS}</style>`).appendTo(document.body)
  const progressUI = $('<div>')
  progressUI.html(`
    <div class="mobcb-bg modal-container block-dialog">
      <div class="mobcb-dialog modal modal-content is-autoPosition">
        <span class="mobcb-progress"></span>
        <hr class="mobcb-hr">
        <div class="mobcb-users">
          <div class="mobcb-target-users"></div>
          <div class="mobcb-skipped-users"></div>
        </div>
        <div class="mobcb-controls">
          <div class="mobcb-bottom-message"></div>
          <button class="mobcb-close btn">닫기</button>
          <button disabled class="mobcb-execute btn caution-btn">차단</button>
        </div>
      </div>
    </div>
  `)
  progressUI.appendTo(document.body)
  progressUI.on('click', '.mobcb-close', event => {
    event.preventDefault()
    progressUI.remove()
  })
  return progressUI
}

restoreConsole()
if (window.confirm('체인블락을 위해 나를 차단한 사용자를 찾습니다. 계속하시겠습니까?')) {
  const ui = initUI()
  doChainBlock(ui)
}
