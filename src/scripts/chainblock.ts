class ChainMirrorBlock {
  private readonly ui = new ChainMirrorBlockUI()
  private get immediatelyBlockMode(): boolean {
    return this.ui.immediatelyBlockModeChecked
  }
  private readonly blockResults: Map<string, BlockResult> = new Map()
  private readonly progress: ChainMirrorBlockProgress = {
    scraped: 0,
    foundUsers: [],
  }
  private isRunning = false
  private shouldStop = false
  constructor(private options: MirrorOfBlockOption) {
    this.prepareUI()
  }
  private cleanup() {
    this.blockResults.clear()
    this.progress.foundUsers.length = 0
  }
  private prepareUI() {
    this.ui.immediatelyBlockModeChecked = this.options.alwaysImmediatelyBlockMode
    window.addEventListener('beforeunload', event => {
      if (!this.isRunning) {
        return
      }
      event.preventDefault()
      const message =
        '[Mirror Of Block] 페이지를 닫거나 다른 페이지로 이동하면 현재 작동중인 체인맞블락은 멈추게 됩니다. 계속 하시겠습니까?'
      event.returnValue = message
      return message
    })
    this.ui.on('ui:close', () => {
      const confirmMessage =
        '체인맞블락이 아직 진행중입니다. 그래도 닫으시겠습니까?'
      if (this.isRunning && window.confirm(confirmMessage)) {
        this.stopAndClose()
      } else if (!this.isRunning) {
        this.stopAndClose()
      }
    })
    this.ui.on('ui:close-without-confirm', () => {
      this.stopAndClose()
    })
    this.ui.on('ui:execute-mutual-block', () => {
      const shouldBlocks = this.progress.foundUsers.filter(
        user => user.state === 'shouldBlock'
      )
      if (shouldBlocks.length > 0) {
        const confirmMessage = '발견한 사용자를 맞차단하시겠습니까?'
        if (!window.confirm(confirmMessage)) {
          return
        }
        this.executeMutualBlock()
      } else {
        window.alert('맞차단할 사용자가 없습니다.')
      }
    })
  }
  public stopAndClose() {
    this.shouldStop = true
    this.cleanup()
    this.ui.close()
  }
  private processImmediatelyBlockMode() {
    if (!this.immediatelyBlockMode) {
      return
    }
    const usersToBlock = this.progress.foundUsers.filter(found => {
      return (
        found.state === 'shouldBlock' &&
        this.blockResults.get(found.user.id_str) === 'notYet'
      )
    })
    usersToBlock.forEach(({ user }) => {
      this.blockResults.set(user.id_str, 'pending')
    })
    const immBlockPromises = usersToBlock.map(({ user }) => {
      return TwitterAPI.blockUser(user)
        .then(blocked => {
          const bresult: BlockResult = blocked ? 'blockSuccess' : 'blockFailed'
          this.blockResults.set(user.id_str, bresult)
          return blocked
        })
        .catch(err => {
          console.error('failed to block:', err)
          this.blockResults.set(user.id_str, 'blockFailed')
          return false
        })
        .then(result => {
          this.ui.updateBlockResult(user, result)
        })
    })
    Promise.all(immBlockPromises)
  }
  public async start(
    targetUser: TwitterUser,
    followType: FollowType,
    prefetched?: PrefetchedFollows
  ) {
    this.isRunning = true
    try {
      const updateProgress = () => {
        this.ui.updateProgress(copyFrozenObject(this.progress))
      }
      const classifyUserState = (user: TwitterUser): UserState => {
        if (user.blocking) {
          return 'alreadyBlocked'
        }
        if (user.muting && !this.options.blockMutedUser) {
          return 'muteSkip'
        }
        if (user.blocked_by) {
          return 'shouldBlock'
        }
        throw new Error(
          `unreachable: invalid user state? (${user.id_str}:@${
            user.screen_name
          })`
        )
      }
      const addUserToFounded = (follower: TwitterUser) => {
        const userState = classifyUserState(follower)
        this.progress.foundUsers.push({
          user: follower,
          state: userState,
        })
        this.blockResults.set(follower.id_str, 'notYet')
        updateProgress()
      }
      const total = getTotalFollows(targetUser, followType)
      this.ui.initProgress(total)
      let delay = 500 + Math.ceil(total / 50)
      const firstCursor = prefetched ? prefetched.cursor : '-1'
      const scraper = TwitterAPI.getAllFollows(targetUser, followType, {
        delay,
        firstCursor,
        includeCursor: false,
      })
      let rateLimited = false
      if (prefetched) {
        this.progress.scraped += prefetched.users.length
        prefetched.users
          .filter(user => user.blocked_by)
          .forEach(addUserToFounded)
      }
      for await (const follower of scraper) {
        if (this.shouldStop) {
          break
        }
        if (follower === 'RateLimitError') {
          rateLimited = true
          TwitterAPI.getFollowsScraperRateLimitStatus(followType).then(
            this.ui.rateLimited
          )
          await sleep(1000 * 60 * 2)
          continue
        }
        if (rateLimited) {
          rateLimited = false
          delay += 50
          this.ui.rateLimitResetted()
        }
        ++this.progress.scraped
        updateProgress()
        if (!follower.blocked_by) {
          continue
        }
        addUserToFounded(follower)
        this.processImmediatelyBlockMode()
      }
      if (!this.shouldStop) {
        this.ui.complete(copyFrozenObject(this.progress))
      }
    } finally {
      this.isRunning = false
      this.shouldStop = false
    }
  }
  public async executeMutualBlock() {
    this.isRunning = true
    try {
      this.ui.startMutualBlock()
      const usersToBlock = this.progress.foundUsers
        .filter(fu => fu.state === 'shouldBlock')
        .map(fu => fu.user)
        .filter(user => this.blockResults.get(user.id_str) === 'notYet')
      const blockPromises = Promise.all(
        usersToBlock.map(user => {
          return TwitterAPI.blockUser(user)
            .then(blocked => {
              const bresult: BlockResult = blocked
                ? 'blockSuccess'
                : 'blockFailed'
              this.blockResults.set(user.id_str, bresult)
              return blocked
            })
            .catch(err => {
              console.error('failed to block:', err)
              this.blockResults.set(user.id_str, 'blockFailed')
              return false
            })
            .then(result => {
              this.ui.updateBlockResult(user, result)
            })
        })
      )
      await blockPromises
      this.ui.completeMutualBlock()
    } finally {
      this.isRunning = false
      this.shouldStop = false
    }
  }
}

function getTotalFollows(user: TwitterUser, followType: FollowType): number {
  if (followType === FollowType.followers) {
    return user.followers_count
  } else if (followType === FollowType.following) {
    return user.friends_count
  } else {
    throw new Error('unreachable')
  }
}

function checkLogin(): boolean {
  // legacy(jquery-based) desktop site
  if (document.body.classList.contains('logged-in')) {
    return true
  }
  if (document.body.classList.contains('logged-out')) {
    return false
  }
  // react-based mobile(responsive) site
  // const isMobile = document.getElementById('react-root') !== null
  const loggedInUserLink =
    document.querySelector('[data-testid="loggedInUserLink"]') !== null
  if (loggedInUserLink) {
    return true
  }
  return false
}

async function doChainBlock(targetUserName: string, followType: FollowType) {
  if (!checkLogin()) {
    window.alert('로그인을 해주세요')
    return
  }
  const targetUser = await TwitterAPI.getSingleUserByName(targetUserName).catch(
    async err => {
      if (err instanceof TwitterAPI.APIError) {
        const json = await err.response.json()
        const jsonstr = JSON.stringify(json, null, 2)
        window.alert(`트위터 서버에서 오류가 발생했습니다:\n${jsonstr}`)
      } else if (err instanceof Error) {
        window.alert(`오류가 발생했습니다:\n${err.message}`)
      }
      return null
    }
  )
  if (!targetUser) {
    return
  }
  const followsCount = getTotalFollows(targetUser, followType)
  if (followsCount <= 0) {
    window.alert('팔로워가 0명입니다.')
    return
  }
  let prefetchStop = false
  const prefetch = async (): Promise<PrefetchedFollows> => {
    const result = {
      users: [],
      cursor: '-1',
    } as PrefetchedFollows
    const limit = await TwitterAPI.getFollowsScraperRateLimitStatus(followType)
    if (limit.remaining <= 100) {
      return result
    }
    const options = {
      delay: 300,
      firstCursor: '-1',
      includeCursor: true,
    }
    for await (const user of TwitterAPI.getAllFollows(
      targetUser,
      followType,
      options
    )) {
      if (user === 'RateLimitError' || prefetchStop) {
        break
      }
      result.users.push(user)
      if (user.$_cursor) {
        result.cursor = user.$_cursor
      }
    }
    return result
  }
  const options = await ExtOption.load()
  const shouldPrefetch = options.prefetchChainMirrorBlock
  if (shouldPrefetch) {
    console.debug('DBG: prefetch 모드 활성화')
  }
  const prefetched = shouldPrefetch ? prefetch() : undefined
  const confirmMessage = `@${targetUserName}님에게 체인맞블락을 실행하시겠습니까?`
  const confirmed = shouldPrefetch
    ? await mobConfirm(confirmMessage)
    : window.confirm(confirmMessage)
  prefetchStop = true
  if (confirmed) {
    const chainblocker = new ChainMirrorBlock(options)
    chainblocker.start(targetUser, followType, await prefetched)
  }
}

browser.runtime.onMessage.addListener((msg: object) => {
  const message = msg as MOBMessage
  if (message.action === Action.StartChainBlock) {
    doChainBlock(message.userName, message.followType)
  }
})
