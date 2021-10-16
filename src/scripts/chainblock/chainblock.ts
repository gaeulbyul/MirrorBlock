import * as Options from '미러블락/extoption'
import { Action, sleep, copyFrozenObject, checkLogin } from '미러블락/scripts/common'
import ChainMirrorBlockUI from './chainblock-ui'
import * as TwitterAPI from '미러블락/scripts/twitter-api'
import * as i18n from '미러블락/scripts/i18n'

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
  private beforeUnloadHandler: (event: BeforeUnloadEvent) => void
  constructor(private options: MirrorBlockOption) {
    this.prepareUI()
    this.beforeUnloadHandler = ((event: BeforeUnloadEvent) => {
      if (!this.isRunning) {
        return
      }
      event.preventDefault()
      const message = `[Mirror Block] ${i18n.getMessage('warning_before_close')}`
      event.returnValue = message
      return message
    }).bind(this)
  }
  private cleanup() {
    this.blockResults.clear()
    this.progress.foundUsers.length = 0
    window.removeEventListener('beforeunload', this.beforeUnloadHandler)
  }
  private prepareUI() {
    this.ui.immediatelyBlockModeChecked = this.options.alwaysImmediatelyBlockMode
    window.addEventListener('beforeunload', this.beforeUnloadHandler)
    this.ui.on('ui:close', () => {
      const confirmMessage = i18n.getMessage('chainblock_still_running')
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
      const shouldBlocks = this.progress.foundUsers.filter(user => user.state === 'shouldBlock')
      if (shouldBlocks.length > 0) {
        const confirmMessage = i18n.getMessage('confirm_mutual_block', shouldBlocks.length)
        if (!window.confirm(confirmMessage)) {
          return
        }
        this.executeMutualBlock()
      } else {
        window.alert(i18n.getMessage('no_users_to_mutual_block'))
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
      return found.state === 'shouldBlock' && this.blockResults.get(found.user.id_str) === 'notYet'
    })
    usersToBlock.forEach(({ user }) => {
      this.blockResults.set(user.id_str, 'pending')
    })
    const immBlockPromises = usersToBlock.map(async ({ user }) => {
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
  public async start(targetUser: TwitterUser, followKind: FollowKind) {
    this.isRunning = true
    try {
      if (targetUser.blocked_by) {
        window.alert(i18n.getMessage('cant_chainblock_they_blocks_you', targetUser.screen_name))
        this.stopAndClose()
        return
      }
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
        throw new Error(`unreachable: invalid user state? (${user.id_str}:@${user.screen_name})`)
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
      const total = getTotalFollows(targetUser, followKind)
      this.ui.initProgress(total)
      const delay = total > 1e4 ? 950 : 300
      const scraper = TwitterAPI.getAllFollows(targetUser, followKind, {
        delay,
      })
      let rateLimited = false
      for await (const maybeFollower of scraper) {
        if (this.shouldStop) {
          break
        }
        if (!maybeFollower.ok) {
          const { error } = maybeFollower
          if (error.response.status === 429) {
            rateLimited = true
            TwitterAPI.getFollowsScraperRateLimitStatus(followKind).then(this.ui.rateLimited)
            await sleep(1000 * 60 * 2)
            continue
          } else {
            console.error(error)
            break
          }
        }
        const follower = maybeFollower.value
        if (rateLimited) {
          rateLimited = false
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
      )
      await blockPromises
      this.ui.completeMutualBlock()
    } finally {
      this.isRunning = false
      this.shouldStop = false
    }
  }
}

function getTotalFollows(user: TwitterUser, followKind: FollowKind): number {
  if (followKind === 'followers') {
    return user.followers_count
  } else if (followKind === 'following') {
    return user.friends_count
  } else {
    throw new Error('unreachable')
  }
}

export async function startChainBlock(targetUserName: string, followKind: FollowKind) {
  const alreadyRunning = document.querySelector('.mobcg-bg')
  if (alreadyRunning) {
    window.alert(i18n.getMessage('chainblock_already_running'))
    return
  }
  const loggedIn = await checkLogin()
  if (!loggedIn) {
    window.alert(i18n.getMessage('please_check_login_before_chainblock'))
    return
  }
  const targetUser = await TwitterAPI.getSingleUserByName(targetUserName).catch(err => {
    if (err instanceof TwitterAPI.APIError) {
      const json = err.response.body
      const jsonstr = JSON.stringify(json, null, 2)
      window.alert(`${i18n.getMessage('error_occured_from_twitter_server')}\n${jsonstr}`)
    } else if (err instanceof Error) {
      window.alert(`${i18n.getMessage('error_occured')}\n${err.message}`)
    }
    return null
  })
  if (!targetUser) {
    return
  }
  const followsCount = getTotalFollows(targetUser, followKind)
  if (followsCount <= 0) {
    window.alert(i18n.getMessage('nobody_follows_them'))
    return
  }
  if (targetUser.protected && !targetUser.following) {
    window.alert(i18n.getMessage('cant_chainblock_they_protected', targetUserName))
    return
  }
  let confirmMessage: string
  switch (followKind) {
    case 'followers':
      confirmMessage = i18n.getMessage('confirm_chainblock_to_followers', targetUser.screen_name)
      break
    case 'following':
      confirmMessage = i18n.getMessage('confirm_chainblock_to_following', targetUser.screen_name)
      break
  }
  let confirmed = window.confirm(confirmMessage)
  if (followsCount > 200000) {
    confirmed = window.confirm(i18n.getMessage('warning_too_many_followers'))
  }
  if (confirmed) {
    const options = await Options.load()
    const chainblocker = new ChainMirrorBlock(options)
    chainblocker.start(targetUser, followKind)
  }
}

browser.runtime.onMessage.addListener((msg: object) => {
  const message = msg as MBMessage
  if (message.action === Action.StartChainBlock) {
    startChainBlock(message.userName, message.followKind)
  } else if (message.action === Action.Alert) {
    const msg = message.message
    window.alert(msg)
  }
})
