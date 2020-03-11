import * as Options from '../../extoption'
import { APIError } from '../twitter-api-ct'
import { Action, sleep, copyFrozenObject } from '../common'
import ChainMirrorBlockUI from './chainblock-ui'
import * as TwitterAPI from '../twitter-api-ct'

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
  constructor(private options: MirrorBlockOption) {
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
        '[Mirror Block] 페이지를 닫거나 다른 페이지로 이동하면 현재 작동중인 체인맞블락은 멈추게 됩니다. 계속 하시겠습니까?'
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
        const confirmMessage = `발견한 사용자 ${shouldBlocks.length}명을 맞차단하시겠습니까?`
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
  public async start(targetUser: TwitterUser, followType: FollowType) {
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
          `unreachable: invalid user state? (${user.id_str}:@${user.screen_name})`
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
      const delay = total > 1e4 ? 950 : 300
      const scraper = TwitterAPI.getAllFollows(targetUser, followType, {
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
            TwitterAPI.getFollowsScraperRateLimitStatus(followType).then(
              this.ui.rateLimited
            )
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
  if (followType === 'followers') {
    return user.followers_count
  } else if (followType === 'following') {
    return user.friends_count
  } else {
    throw new Error('unreachable')
  }
}

export async function startChainBlock(
  targetUserName: string,
  followType: FollowType
) {
  const alreadyRunning = document.querySelector('.mobcg-bg')
  if (alreadyRunning) {
    window.alert('이미 체인맞블락이 실행중입니다.')
    return
  }
  const myself = await TwitterAPI.getMyself() //.catch(() => null)
  if (!myself) {
    window.alert('로그인을 해주세요.')
    return
  }
  const targetUser = await TwitterAPI.getSingleUserByName(targetUserName).catch(
    err => {
      if (err instanceof APIError) {
        const json = err.response.body
        const jsonstr = JSON.stringify(json, null, 2)
        window.alert(`트위터 서버에서 오류가 발생했습니다.:\n${jsonstr}`)
      } else if (err instanceof Error) {
        window.alert(`오류가 발생했습니다.:\n${err.message}`)
      }
      return null
    }
  )
  if (!targetUser) {
    return
  }
  const followsCount = getTotalFollows(targetUser, followType)
  if (followsCount <= 0) {
    window.alert('팔로잉/팔로워가 0명이므로 아무것도 하지 않았습니다.')
    return
  }
  if (targetUser.blocked_by) {
    window.alert(
      `@${targetUserName}님에게 차단당하여 체인맞블락을 진행할 수 없습니다.`
    )
    return
  }
  if (targetUser.protected) {
    const relationship = await TwitterAPI.getRelationship(myself, targetUser)
    const { following } = relationship.source
    if (!following) {
      window.alert(
        `@${targetUserName}님은 프로텍트가 걸려있어서 체인맞블락을 진행할 수 없습니다.`
      )
      return
    }
  }
  const followTypeKor = followType === 'followers' ? '팔로워' : '팔로잉'
  let confirmed = window.confirm(
    `@${targetUserName}님의 ${followTypeKor} 목록에서 체인맞블락을 실행하시겠습니까?`
  )
  if (followsCount > 200000) {
    const a =
      '주의!: 팔로잉/팔로워가 너무 많으면 체인맞블락 도중 리밋 등 계정 사용에 제한이 걸릴 수 있습니다.'
    const b = '정말로 진행하시겠습니까?'
    confirmed = window.confirm(`${a} ${b}`)
  }
  if (confirmed) {
    const options = await Options.load()
    const chainblocker = new ChainMirrorBlock(options)
    chainblocker.start(targetUser, followType)
  }
}

browser.runtime.onMessage.addListener((msg: object) => {
  const message = msg as MBMessage
  if (message.action === Action.StartChainBlock) {
    startChainBlock(message.userName, message.followType)
  } else if (message.action === Action.Alert) {
    const msg = message.message
    window.alert(msg)
  }
})
