/* globals fetch, location, $, sendBlockRequest, changeButtonToBlocked */

// some code taken from:
// https://github.com/satsukitv/twitter-block-chain
{
  let chainBlockCancel = false

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

  function getTypeOfUserList () {
    if (/\/followers$/.test(location.pathname)) {
      return 'followers'
    } else if (/\/following$/.test(location.pathname)) {
      return 'following'
    } else {
      throw new Error('unsupported page')
    }
  }

  function chainBlock (callbacks) {
    const targets = []
    const skipped = []
    const newTargets = []
    const newSkipped = []
    let totalCount = 0
    const currentList = getTypeOfUserList()

    function scanner (data, callbacks) {
      const {progressCallback, finalCallback} = callbacks
      const templ = document.createElement('template')
      templ.innerHTML = data.items_html
      const nodes = templ.content.cloneNode(true)
      const cards = nodes.querySelectorAll('.ProfileCard')
      cards.forEach(card_ => {
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
          console.log('맞차단 타겟 발견! @%s(%s) - %s', userName, userId, userNickName)
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
          const shouldContinue = progressCallback({
            targets,
            skipped,
            newTargets: newTargets.slice(),
            newSkipped: newSkipped.slice(),
            count: cards.length,
            totalCount
          })
          newTargets.length = newSkipped.length = 0
          if (shouldContinue) {
            scanner(json, callbacks)
          } else {
            console.info('체인맞블락 중단')
          }
        }, 200 + (Math.round(Math.random() * 400)))
      } else if (typeof finalCallback === 'function') {
        const shouldContinue = progressCallback({
          targets,
          skipped,
          newTargets: newTargets.slice(),
          newSkipped: newSkipped.slice(),
          count: cards.length,
          totalCount
        })
        newTargets.length = newSkipped.length = 0
        if (shouldContinue) {
          finalCallback({
            targets,
            skipped,
            totalCount
          })
        } else {
          console.info('체인맞블락 중단')
        }
      }
    }

    const grid = $('.GridTimeline-items')
    scanner({
      items_html: grid.html(),
      min_position: grid.data('min-position'),
      has_more_items: true
    }, callbacks)
  }

  function isChainBlockablePage () {
    try {
      if (location.hostname !== 'twitter.com') {
        return false
      }
      return /^\/@?[\w\d_]+\/(?:followers|following)$/.test(location.pathname)
    } catch (e) {
      return false
    }
  }

  function checkSelfChainBlock () {
    const currentUserId = String($('.ProfileNav').data('user-id'))
    const myUserId = String($('#user-dropdown.me [data-user-id]').data('user-id'))
    const valid = /\d+/.test(currentUserId) && /\d+/.test(myUserId)
    return valid && (currentUserId === myUserId)
  }

  function alreadyRunning () {
    return $('.mobcb-bg').length > 0
  }

  function blockedUser () {
    return $('.BlocksYouTimeline').length > 0
  }

  function doChainBlock (ui) {
    const currentList = getTypeOfUserList()
    const count = Number($(`.ProfileNav-item--${currentList} [data-count]`).eq(0).data('count'))
    if (count > 2000) {
      window.alert('주의! 팔로잉/팔로워 사용자가 지나치게 많은 경우 중간에 체인맞블락의 작동이 정지할 수 있습니다.')
    }

    function makeUser (user) {
      const {userId, userName, userNickName, reason} = user
      let userPrefix = ''
      if (reason === 'already-blocked') {
        userPrefix = '[Blocked] '
      } else if (reason === 'muted') {
        userPrefix = '[Skip] '
      }
      const item = $('<li>')
      const link = $('<a>')
        .attr('data-user-id', userId)
        .attr('href', `https://twitter.com/${userName}`)
        .attr('target', '_blank')
        .text(`${userPrefix} @${userName}: ${userNickName}`)
      item.append(link)
      return item
    }

    chainBlock({
      progressCallback ({targets, skipped, newTargets, newSkipped, totalCount}) {
        if (chainBlockCancel) {
          return false
        }
        ui.find('.mobcb-progress').text(
          `체인맞블락 중간 보고: ${totalCount}명 중 타겟 ${targets.length}명, 스킵 ${skipped.length}명`
        )
        newTargets.forEach(user => {
          const a = makeUser(user)
          ui.find('.mobcb-target-users').append(a)
        })
        newSkipped.forEach(user => {
          const a = makeUser(user)
          ui.find('.mobcb-skipped-users').append(a)
        })
        return true
      },
      finalCallback ({targets, skipped, totalCount}) {
        if (chainBlockCancel) {
          return false
        }
        ui.find('.mobcb-progress').text(
          `체인맞블락 결과 보고: ${totalCount}명 중 타겟 ${targets.length}명, 스킵 ${skipped.length}명`
        )
        ui.find('.mobcb-bottom-message').text(`${targets.length}명 맞차단 가능`)
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
            window.alert('맞차단할 사용자가 없습니다.')
            return
          }
          if (window.confirm('실제로 맞차단하시겠습니까?')) {
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
              ui.find('.mobcb-bottom-message').text(`${successes.length}명 맞차단 완료!`)
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
        return true
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
      .mobcb-users > ul {
        list-style: none;
        line-height: 150%;
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
            <ul class="mobcb-target-users"></ul>
            <ul class="mobcb-skipped-users"></ul>
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
      chainBlockCancel = true
      progressUI.remove()
    })
    return progressUI
  }

  restoreConsole()
  if (!isChainBlockablePage()) {
    window.alert('PC용 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.')
  } else if (checkSelfChainBlock()) {
    window.alert('자기 자신에게 체인맞블락을 할 순 없습니다.')
  } else if (alreadyRunning()) {
    window.alert('현재 체인맞블락이 가동중입니다. 잠시만 기다려주세요.')
  } else if (blockedUser()) {
    window.alert('이미 나를 차단한 사용자의 팔로잉/팔로워가 누군지 알 수 없습니다.')
  } else if (window.confirm('체인맞블락을 위해 나를 차단한 사용자를 찾습니다. 계속하시겠습니까?')) {
    chainBlockCancel = false
    const ui = initUI()
    doChainBlock(ui)
  }
}//
