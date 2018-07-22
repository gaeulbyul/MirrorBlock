/* globals
  browser,
  fetch,
  location,
  $,
  sendBlockRequest,
  changeButtonToBlocked,
  ExtOption,
*/

interface User {
  userId: string,
  userName: string,
  userNickName: string,
  blocksYou: boolean,
  alreadyBlocked: boolean,
  muted: boolean,
  bio?: string,
  shouldSkip?: boolean
}

type FollowType = 'followers' | 'following'

const CHAINBLOCK_UI_HTML = `
  <div class="mobcb-bg modal-container block-dialog" style="display:flex">
    <div class="mobcb-dialog modal modal-content is-autoPosition">
      <div class="mobcb-titlebar">
        <span class="mobcb-title">체인맞블락</span>
        <span class="mobcb-title-extra"></span>
        <span class="mobcb-title-status"></span>
      </div>
      <span class="mobcb-progress"></span>
      <hr class="mobcb-hr">
      <div class="mobcb-users">
        <ul class="mobcb-target-users"></ul>
        <ul class="mobcb-skipped-users"></ul>
      </div>
      <hr class="mobcb-hr">
      <div class="mobcb-extra-options">
        <label title="맞차단할 사용자를 발견하면 ('차단'버튼을 누르지 않아도) 바로 맞차단합니다.">
          <input type="checkbox" id="mobcb-block-immediately">발견 즉시 바로 맞차단하기
        </label>
      </div>
      <div class="mobcb-controls">
        <div class="mobcb-bottom-message"></div>
        <button class="mobcb-close btn normal-btn">닫기</button>
        <button disabled class="mobcb-execute btn caution-btn">차단</button>
      </div>
    </div>
  </div>
`

function sleep (time: number) {
  return new Promise(resolve => {
    window.setTimeout(() => {
      resolve()
    }, time)
  })
}

class EventEmitter {
  private events: {[key: string]: Function[]} = {} // 으음...
  on (eventname: string, handler: Function) {
    if (!(eventname in this.events)) {
      this.events[eventname] = []
    }
    this.events[eventname].push(handler)
    return this
  }
  emit (eventname: string, eparameter?: any) {
    const handlers = this.events[eventname] || []
    handlers.forEach(handler => handler(eparameter))
    return this
  }
}

interface FollowerGathererOptions {
  delay: number,
  delayOnLimitation: number,
  stopOnLimit: boolean,
  filter: (user: User) => boolean
}

class FollwerGatherer extends EventEmitter {
  private options: FollowerGathererOptions
  private stopped: boolean = false
  constructor (options?: object) {
    super()
    this.options = Object.assign({}, {
      // default options
      delay: 500,
      delayOnLimitation: 1000 * 60 * 2,
      stopOnLimit: true,
      filter: () => true
    }, options)
  }
  // @ts-ignore
  static _parseUserProfileCard (card) {
    const $card = $(card)
    const blocksYou = $card.find('.blocks-you').length > 0
    const actions = $($card.find('.user-actions'))
    const userId = String(actions.data('user-id'))
    const userName = actions.data('screen-name')
    const userNickName = $card.find('.fullname').text().trim()
    const alreadyBlocked = $card.find('.blocked').length > 0
    const muted = $card.find('.muting').length > 0
    const bio = $card.find('.ProfileCard-bio').text().trim()
    return {
      userId,
      userName,
      userNickName,
      blocksYou,
      alreadyBlocked,
      muted,
      bio
    }
  }
  stop () {
    this.stopped = true
  }
  async start (username: string, followtype: FollowType) {
    const {
      delay,
      delayOnLimitation,
      filter,
      stopOnLimit
    } = this.options
    this.stopped = false
    let gatheredCount = 0
    let nextPosition: string | null = null
    // 이미 화면상에 렌더링된 프로필이 있으면 이를 먼저 사용한다.
    const renderedTimeline = document.querySelector('.GridTimeline .GridTimeline-items')
    if (renderedTimeline) {
      nextPosition = renderedTimeline.getAttribute('data-min-position')
      const cards = renderedTimeline.querySelectorAll('.ProfileCard')
      gatheredCount += cards.length
      let users = Array.from(cards || [], FollwerGatherer._parseUserProfileCard)
      if (typeof filter === 'function') {
        users = users.filter(filter)
      }
      this.emit('progress', {
        users,
        gatheredCount
      })
    }
    while (true) {
      if (this.stopped) {
        this.emit('end', {
          userStopped: true
        })
        break
      }
      const maxPosition = nextPosition ? `&max_position=${nextPosition}` : ''
      const url = `https://twitter.com/${username}/${followtype}/users?
      include_available_features=1&
      include_entities=1&
      reset_error_state=true
      ${maxPosition}`.replace(/\s+/g, '')
      let response
      while (true) {
        response = await fetch(url, {
          method: 'GET',
          credentials: 'include',
          referrer: location.href
        })
        if (response.ok) {
          break
        }
        if (response.status === 429) {
          this.emit('limit')
          console.info('FollowerGather: limited!')
          if (stopOnLimit) {
            throw new Error('LimitError!')
          } else {
            await sleep(delayOnLimitation)
          }
        } else {
          this.emit('error', response)
          throw new Error('HTTPError!')
        }
      }
      const json = await response.json()
      const templ = document.createElement('template')
      templ.innerHTML = json.items_html
      const node = templ.content.cloneNode(true) as Element
      const cards = node.querySelectorAll('.ProfileCard')
      gatheredCount += cards.length
      let users = Array.from(cards || [], FollwerGatherer._parseUserProfileCard)
      if (typeof filter === 'function') {
        users = users.filter(filter)
      }
      this.emit('progress', {
        users,
        gatheredCount
      })
      if (json.has_more_items) {
        nextPosition = json.min_position
        await sleep(delay)
      } else {
        this.emit('end', {
          userStopped: false
        })
        break
      }
    }
  }
}

type UIUpdateOption = {
  users: User[],
  gatheredCount: number
}

class ChainBlockUI {
  private targets: User[] = []
  private skipped: User[] = []
  private immBlocked: Set<string> = new Set()
  private followersCount: number = 0
  private originalTitle: string = document.title
  private options: MirrorOfBlockOption
  public progressUI: JQuery
  constructor (options: MirrorOfBlockOption) {
    this.options = options
    const ui = this.progressUI = $('<div>')
    ui.html(CHAINBLOCK_UI_HTML)
    ui.appendTo(document.body)
    if (options.chainBlockOver10KMode) {
      ui.find('.mobcb-title-extra').text('(슬로우 모드)')
    }
    ui.on('click', '.mobcb-close', event => {
      event.preventDefault()
      this.close()
    })
  }
  setInitialFollowsCount (count: number) {
    this.followersCount = count
  }
  async blockTargets () {
    const { targets } = this
    const promises = targets
      .filter(user => !this.immBlocked.has(user.userId))
      .map(async user => {
        const { userId } = user
        return sendBlockRequest(userId)
          .then(() => {
            this.immBlocked.add(userId)
            return true
          })
          .catch(() => false)
          .then(result => {
            console.log('즉시차단(%s) = %s', userId, result)
            return result
          })
      })
    return Promise.all(promises)
  }
  update ({ users, gatheredCount }: UIUpdateOption) {
    for (const user of users) {
      const muteSkip = user.muted && !this.options.blockMutedUser
      if (user.alreadyBlocked || muteSkip) {
        user.shouldSkip = true
        this.skipped.push(user)
      } else {
        user.shouldSkip = false
        this.targets.push(user)
      }
    }
    const shouldImmBlock = this.progressUI.find('#mobcb-block-immediately').prop('checked')
    if (shouldImmBlock) {
      void this.blockTargets()
    }
    this.updateUI({ users, gatheredCount })
  }
  updateUI ({ users, gatheredCount }: UIUpdateOption) {
    const { targets,
      originalTitle,
      followersCount,
      progressUI: ui
    } = this
    const percentage = Math.round(gatheredCount / followersCount * 100)
    document.title = `(${percentage}% | ${targets.length}명) 체인맞블락 사용자 수집중\u2026 \u2013 ${originalTitle}`
    this.notifyLimitation(false)
    for (const user of users) {
      const {
        userId,
        userName,
        userNickName,
        alreadyBlocked,
        muted,
        shouldSkip
      } = user
      const muteSkip = muted && !this.options.blockMutedUser
      let userPrefix = ''
      if (alreadyBlocked) {
        userPrefix = '[Blocked] '
      } else if (muteSkip) {
        userPrefix = '[Skip] '
      }
      const item = $('<li>')
      const link = $('<a>')
        .attr('data-user-id', userId)
        .attr('href', `https://twitter.com/${userName}`)
        .attr('target', '_blank')
        .attr('title', `@${userName} (${userNickName})
프로필: ${user.bio}`)
        .text(`${userPrefix} @${userName}: ${userNickName}`)
      item.append(link)
      if (shouldSkip) {
        link.addClass('mobcb-user-skipped')
        ui.find('.mobcb-skipped-users').append(item)
      } else {
        link.addClass('mobcb-user-target')
        ui.find('.mobcb-target-users').append(item)
      }
    }
    for (const blockedUserId of this.immBlocked) {
      const immBlockedUser = ui.find(`a[data-user-id="${blockedUserId}"]`)
      immBlockedUser
        .addClass('mobcb-user-blocked')
        .removeClass('mobcb-user-target')
    }
    ui.find('.mobcb-progress').text(
      `중간 보고: ${gatheredCount}명 중 ${this.count()}`
    )
  }

  count () {
    const [ts, is, ss] = [this.targets.length, this.immBlocked.size, this.skipped.length]
    return `타겟 ${ts}명(${is}명 즉시차단), 스킵 ${ss}명`
  }

  notifyLimitation (limited: boolean) {
    const bottomMessage = this.progressUI.find('.mobcb-bottom-message')
    const message = (limited
      ? `팔로워를 너무 많이 가져와 일시적인 제한이 걸렸습니다. 약 20분 뒤에 다시 시도합니다.`
      : '')
    bottomMessage.text(message)
  }

  finalize ({ userStopped }: { userStopped: boolean }) {
    this.finalizeUI({ userStopped })
  }

  finalizeUI ({ userStopped }: { userStopped: boolean }) {
    const {
      targets,
      skipped,
      originalTitle,
      followersCount,
      progressUI: ui
    } = this
    const blockableTargets = targets.filter(user => !this.immBlocked.has(user.userId))
    if (!userStopped) {
      document.title = `체인맞블락 수집완료! \u2013 ${originalTitle}`
    } else {
      document.title = this.originalTitle
      return
    }
    ui.find('.mobcb-title-status').text('(수집완료)')
    ui.find('.mobcb-progress').text(
      `결과 보고: ${followersCount}명 중 ${this.count()}`
    )
    if (targets.length === 0 && skipped.length === 0) {
      window.alert('여기에선 아무도 나를 차단하지 않았습니다.')
      this.close()
      return
    } else if (blockableTargets.length > 0) {
      ui.find('.mobcb-controls .btn').prop('disabled', false)
    } else if (blockableTargets.length === 0) {
      ui.find('.mobcb-bottom-message').text('맞차단할 사용자가 없거나 이미 맞차단을 했습니다.')
    }
    ui.find('.mobcb-execute').click(event => {
      event.preventDefault()
      if (blockableTargets.length === 0) {
        window.alert('맞차단할 사용자가 없습니다.')
        return
      }
      if (window.confirm('실제로 맞차단하시겠습니까?')) {
        document.title = `체인맞블락 차단중\u2026 \u2013 ${originalTitle}`
        ui.find('.mobcb-title-status').text('(차단중)')
        const promises = targets.map(user => {
          const { userId } = user
          const userItem = ui.find(`.mobcb-target-users a[data-user-id="${userId}"]`)
          if (this.immBlocked.has(userId)) {
            return Promise.resolve({
              user,
              ok: true
            })
          } else {
            return sendBlockRequest(userId)
              .then(() => true, () => false)
              .then(result => {
                const prefix = 'mobcb-user-'
                const className = prefix + (result ? 'blocked' : 'blockfailed')
                userItem.addClass(className)
                if (result) {
                  userItem.removeClass('mobcb-user-target')
                }
                return {
                  user,
                  ok: result
                }
              })
          }
        })
        Promise.all(promises).then(results => {
          const successes = results.filter(x => x.ok)
          ui.find('.mobcb-execute').prop('disabled', true)
          document.title = `체인맞블락 차단완료! \u2013 ${originalTitle}`
          ui.find('.mobcb-title-status').text('(차단완료)')
          for (const result of successes) {
            const { userId } = result.user
            const profileCard = $(`.ProfileCard[data-user-id="${userId}"]`)
            profileCard.each((_, card) => changeButtonToBlocked(card))
          }
          targets.length = 0
        })
      }
    })
    console.dir({ targets, skipped })
  }
  close () {
    document.title = this.originalTitle
    this.progressUI.remove()
    // TODO: prevent use-after-close?
  }
}

// already declared on popup.js
// @ts-ignore: TS2393
function isChainBlockablePage (): boolean {
  try {
    if (location.hostname !== 'twitter.com') {
      return false
    }
    return /^\/@?[\w\d_]+\/(?:followers|following)$/.test(location.pathname)
  } catch (e) {
    return false
  }
}

function checkSelfChainBlock (): boolean {
  if (location.pathname === '/followers' || location.pathname === '/following') {
    return true
  }
  const currentUserId = String($('.ProfileNav').data('user-id'))
  const myUserId = String($('#current-user-id').val())
  const valid = /\d+/.test(currentUserId) && /\d+/.test(myUserId)
  return valid && (currentUserId === myUserId)
}

function alreadyRunning (): boolean {
  return $('.mobcb-bg').length > 0
}

function blockedUser (): boolean {
  return $('.BlocksYouTimeline').length > 0
}

async function chainBlock () {
  if (!isChainBlockablePage()) {
    window.alert('PC용 트위터(twitter.com)의 팔로잉 혹은 팔로워 페이지에서만 작동합니다.')
  } else if (checkSelfChainBlock()) {
    window.alert('자기 자신에게 체인맞블락을 할 순 없습니다.')
  } else if (alreadyRunning()) {
    window.alert('현재 체인맞블락이 가동중입니다. 잠시만 기다려주세요.')
  } else if (blockedUser()) {
    window.alert('이미 나를 차단한 사용자의 팔로잉/팔로워가 누군지 알 수 없습니다.')
  } else if (window.confirm('체인맞블락을 위해 나를 차단한 사용자를 찾습니다. 계속하시겠습니까?')) {
    const options = await ExtOption.load()
    Object.freeze(options)
    const currentList = (path => {
      if (/\/followers$/.test(path)) {
        return 'followers'
      } else if (/\/following$/.test(path)) {
        return 'following'
      } else {
        throw new Error('unsupported page')
      }
    })(location.pathname)
    const ui = new ChainBlockUI(options)
    {
      const selector = `.ProfileNav-item--${currentList} [data-count]`
      ui.setInitialFollowsCount(Number($(selector).eq(0).data('count')))
    }
    const gatherer = new FollwerGatherer({
      filter: (user: User) => user.blocksYou,
      stopOnLimit: false,
      delay: options.chainBlockOver10KMode ? 2500 : 250
    })
    ui.progressUI.on('click', '.mobcb-close', () => {
      gatherer.stop()
    })
    gatherer.on('progress', ({ users, gatheredCount }: UIUpdateOption) => {
      console.log('progress', users)
      ui.update({ users, gatheredCount })
    })
    gatherer.on('limit', () => {
      ui.notifyLimitation(true)
    })
    gatherer.on('error', () => {
      window.alert('사용자 목록을 가져오는 도중 오류가 발생했습니다. 체인맞블락을 중단합니다.')
      gatherer.stop()
    })
    gatherer.on('end', ({ userStopped }: { userStopped: boolean }) => {
      ui.finalize({ userStopped })
    })
    const profileUsername = $('.ProfileHeaderCard .username b').text()
    void gatherer.start(profileUsername, currentList)
  }
}

browser.runtime.onMessage.addListener((msg: any) => {
  if (msg.action === 'MirrorOfBlock/start-chainblock') {
    chainBlock()
  }
})
