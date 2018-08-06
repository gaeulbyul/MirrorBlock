/* globals
  browser,
  fetch,
  location,
  $,
  sendBlockRequest,
  changeButtonToBlocked,
  ExtOption,
*/

interface FollowerScraperOptions {
  delay: number,
  delayOnLimitation: number,
  stopOnLimit: boolean,
  filter: (user: TwitterAPIUser) => boolean
}

interface FollowerScraperOptionsInput {
  delay?: number,
  delayOnLimitation?: number,
  stopOnLimit?: boolean,
  filter?: (user: TwitterAPIUser) => boolean
}

interface UIUpdateOption {
  users: TwitterAPIUser[],
  gatheredCount: number
}

interface UserStopped {
  userStopped: boolean
}

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

class FollowsScraper extends EventEmitter {
  private readonly options: FollowerScraperOptions
  private stopped: boolean = false
  constructor (options?: FollowerScraperOptionsInput) {
    super()
    this.options = {
      // default options
      delay: 500,
      delayOnLimitation: 1000 * 60 * 2,
      stopOnLimit: true,
      filter: () => true
    }
    Object.assign(this.options, options)
  }
  stop () {
    this.stopped = true
  }
  async start (followType: FollowType, userName: string) {
    const {
      delay,
      delayOnLimitation,
      filter,
      stopOnLimit
    } = this.options
    this.stopped = false
    let gatheredCount = 0
    let cursor: string = '-1'
    while (true) {
      if (this.stopped) {
        this.emit<UserStopped>('end', {
          userStopped: true
        })
        break
      }
      let response: FollowsListResponse
      while (true) {
        try {
          response = await getFollowsList(followType, userName, cursor)
          break
        } catch (ex) {
          if (ex instanceof RateLimitError) {
            this.emit<void>('limit')
            console.info('FollowerGather: limited!')
            if (stopOnLimit) {
              throw ex
            } else {
              await sleep(delayOnLimitation)
              // continue
            }
          } else {
            this.emit('error')
            throw ex
          }
        }
      }
      gatheredCount += response.users.length
      const users: TwitterAPIUser[] = response.users.filter(filter)
      this.emit<UIUpdateOption>('progress', {
        users,
        gatheredCount
      })
      if (response.next_cursor_str !== '0') {
        cursor = response.next_cursor_str
        await sleep(delay)
      } else {
        this.emit<UserStopped>('end', {
          userStopped: false
        })
        break
      }
    }
  }
}

class ChainBlockUI {
  private targets: TwitterAPIUser[] = []
  private skipped: TwitterAPIUser[] = []
  private immBlocked: Set<string> = new Set()
  private totalFollowsCount: number = 0
  private gatheredCount: number = 0
  private originalTitle: string = document.title
  private readonly options: MirrorOfBlockOption
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
    this.totalFollowsCount = count
  }
  async blockTargets () {
    const { targets } = this
    const promises = targets
      .filter(user => !this.immBlocked.has(user.id_str))
      .map(async user => {
        const { id_str: userId } = user
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
  shouldSkipUser (user: TwitterAPIUser): boolean {
    const { blockMutedUser } = this.options
    const { blocking } = user
    const muteSkip = user.muting && !blockMutedUser
    return blocking || muteSkip
  }
  update ({ users, gatheredCount }: UIUpdateOption) {
    for (const user of users) {
      const shouldSkip = this.shouldSkipUser(user)
      if (shouldSkip) {
        this.skipped.push(user)
      } else {
        this.targets.push(user)
      }
    }
    const shouldImmBlock = this.progressUI.find('#mobcb-block-immediately').prop('checked')
    if (shouldImmBlock) {
      void this.blockTargets()
    }
    this.gatheredCount = gatheredCount
    this.updateUI({ users, gatheredCount })
  }
  updateUI ({ users, gatheredCount }: UIUpdateOption) {
    const {
      targets,
      originalTitle,
      totalFollowsCount,
      progressUI: ui
    } = this
    const percentage = Math.round(gatheredCount / totalFollowsCount * 100)
    document.title = `(${percentage}% | ${targets.length}명) 체인맞블락 사용자 수집중\u2026 \u2013 ${originalTitle}`
    this.notifyLimitation(false)
    for (const user of users) {
      const {
        id_str: userId,
        screen_name: userName,
        name: userNickName,
        blocking: alreadyBlocked,
        muting: muted
      } = user
      const shouldSkip = this.shouldSkipUser(user)
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
프로필: ${user.description}`)
        .addClass('mobcb-user')
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

  count (): string {
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

  finalize ({ userStopped }: UserStopped) {
    this.finalizeUI({ userStopped })
  }

  finalizeUI ({ userStopped }: UserStopped) {
    const {
      targets,
      skipped,
      originalTitle,
      totalFollowsCount,
      progressUI: ui
    } = this
    const blockableTargets = targets.filter((user: TwitterAPIUser) => !this.immBlocked.has(user.id_str))
    if (!userStopped) {
      document.title = `체인맞블락 수집완료! \u2013 ${originalTitle}`
    } else {
      document.title = this.originalTitle
      return
    }
    ui.find('.mobcb-title-status').text('(수집완료)')
    ui.find('.mobcb-progress').text(
      `결과 보고: ${totalFollowsCount}명 중 ${this.count()}`
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
    ui.find('.mobcb-execute').on('click', event => {
      event.preventDefault()
      if (blockableTargets.length === 0) {
        window.alert('맞차단할 사용자가 없습니다.')
        return
      }
      if (window.confirm('실제로 맞차단하시겠습니까?')) {
        this.executeMutualBlock()
      }
    })
    console.dir({ targets, skipped })
  }
  executeMutualBlock () {
    const {
      originalTitle,
      targets,
      progressUI: ui
    } = this
    document.title = `체인맞블락 차단중\u2026 \u2013 ${originalTitle}`
    ui.find('.mobcb-title-status').text('(차단중)')
    const promises = targets.map(user => {
      const { id_str: userId } = user
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
        const { id_str: userId } = result.user
        const profileCard = $(`.ProfileCard[data-user-id="${userId}"]`)
        profileCard.each((_, card) => changeButtonToBlocked(card))
      }
      targets.length = 0
    })
  }
  close () {
    document.title = this.originalTitle
    this.progressUI.remove()
    // TODO: prevent use-after-close?
  }
}

function checkSelfChainBlock (): boolean {
  if (location.pathname === '/followers' || location.pathname === '/following') {
    return true
  }
  if (document.getElementById('react-root')) {
    // FIXME: 셀프-체인맞블락을 감지할 것
    return false
  } else {
    const currentUserId = String($('.ProfileNav').data('user-id'))
    const myUserId = String($('#current-user-id').val())
    const valid = /\d+/.test(currentUserId) && /\d+/.test(myUserId)
    return valid && (currentUserId === myUserId)
  }
}

function alreadyRunning (): boolean {
  return $('.mobcb-bg').length > 0
}

function formatConfirmMessage (followType: FollowType, userName: string): string {
  const krFollowType = followType === 'following' ? '팔로잉' : '팔로워'
  return `체인맞블락을 위해 나를 차단한 사용자를 찾습니다. 계속하시겠습니까?
(대상: @${userName}님의 ${krFollowType})`
}

async function chainBlock (followType: FollowType, userName: string) {
  if (checkSelfChainBlock()) {
    window.alert('자기 자신에게 체인맞블락을 할 순 없습니다.')
  } else if (alreadyRunning()) {
    window.alert('현재 체인맞블락이 가동중입니다. 잠시만 기다려주세요.')
  } else if (window.confirm(formatConfirmMessage(followType, userName))) {
    void browser.runtime.sendMessage({
      action: 'MirrorOfBlock/confirmed-chainblock'
    })
    const options = await ExtOption.load()
    Object.freeze(options)
    const ui = new ChainBlockUI(options)
    try {
      let count = 0
      const currentUser = await getSingleUserByName(userName)
      if (followType === 'following') {
        count = currentUser.friends_count
      } else if (followType === 'followers') {
        count = currentUser.followers_count
      }
      ui.setInitialFollowsCount(count)
    } catch (err) {
      window.alert('사용자목록을 가져오지 못했습니다.')
      // console.error(err)
      throw err
    }
    const gatherer = new FollowsScraper({
      filter: (user: TwitterAPIUser) => user.blocked_by,
      stopOnLimit: false,
      delay: options.chainBlockOver10KMode ? 2500 : 250
    })
    ui.progressUI.on('click', '.mobcb-close', () => {
      gatherer.stop()
    })
    gatherer.on<UIUpdateOption>('progress', (update: UIUpdateOption) => {
      console.log('progress', update.users)
      ui.update(update)
    })
    gatherer.on('limit', () => {
      ui.notifyLimitation(true)
    })
    gatherer.on('error', () => {
      window.alert('사용자 목록을 가져오는 도중 오류가 발생했습니다. 체인맞블락을 중단합니다.')
      gatherer.stop()
    })
    gatherer.on<UserStopped>('end', (userStopped: UserStopped) => {
      ui.finalize(userStopped)
    })
    void gatherer.start(followType, userName)
  }
}

browser.runtime.onMessage.addListener((msg: any) => {
  if (msg.action === 'MirrorOfBlock/start-chainblock') {
    void chainBlock(validFollowType(msg.followType), msg.userName)
  }
})
