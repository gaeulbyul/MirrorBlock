import Badge from './mirrorblock-badge'
import * as Utils from '../common'
import * as TwitterAPI from '../twitter-api-ct'
import { reflectBlock, reflectBlockOnVisible } from './mirrorblock-r'
import { StoreRetriever, StoreUpdater, UserGetter } from './redux-store'

type DOMQueryable = HTMLElement | Document

function markOutline(elem: Element | null): void {
  if (elem) {
    elem.setAttribute('data-mirrorblock-blocks-you', '1')
  }
}
function getElemByEntry(entry: Entry): HTMLElement | null {
  return document.querySelector(`[data-mirrorblock-entryid="${entry.entryId}"]`)
}
function getElemsByUserCell(idOrName: UserCellIdentifier): HTMLElement[] {
  const { userId, userName } = idOrName
  let selectors: string[] = []
  if (userId) {
    selectors.push(`[data-mirrorblock-usercell-id="${userId}"]`)
  }
  if (userName) {
    selectors.push(`[data-mirrorblock-usercell-name="${userName}"]`)
  }
  const elems = document.querySelectorAll<HTMLElement>(selectors.join(','))
  return Utils.filterElements(elems)
}
function getElemByDmData(dmData: DMData): HTMLElement | null {
  return document.querySelector(
    `[data-mirrorblock-conversation-id="${dmData.conversation_id}"]`
  )
}
namespace ProfileDetector {
  export async function detectProfile(rootElem: DOMQueryable) {
    const helpLinks = rootElem.querySelectorAll<HTMLElement>(
      'a[href="https://support.twitter.com/articles/20172060"]'
    )
    const filteredElems = Utils.filterElements(helpLinks)
    if (filteredElems.length <= 0) {
      return
    }
    const helpLink = filteredElems[0]
    const userName = Utils.getUserNameFromTweetUrl(location)
    if (!userName) {
      return
    }
    // const user = StoreRetriever.getUserByName(userName)
    const user = await TwitterAPI.getSingleUserByName(userName)
    if (!user) {
      return
    }
    const badge = new Badge(user)
    reflectBlock({
      user,
      indicateBlock() {
        badge.appendTo(helpLink.parentElement!)
      },
      indicateReflection() {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(user)
      },
    })
  }
}
namespace EntryHandler {
  async function handleQuotedTweet(
    tweet: TweetWithQuote,
    tweetElem: HTMLElement
  ) {
    if (!tweet.quoted_status_permalink) {
      return
    }
    const qUrlString = tweet.quoted_status_permalink.expanded
    const qUrl = new URL(qUrlString)
    // 드물게 인용 트윗 주소가 t.co 링크일 경우도 있더라.
    if (qUrl.hostname === 't.co') {
      return
    }
    const quotedUserName = Utils.getUserNameFromTweetUrl(qUrl)!
    const quotedUser = await UserGetter.getUserByName(quotedUserName, true)
    if (!quotedUser || !quotedUser.blocked_by) {
      return
    }
    const badge = new Badge(quotedUser)
    // 가끔 날 차단한 사람의 인용트윗이 보인다.
    // 이 때 보이는 인용트윗은 div[role=blockquote]다.
    // 안 보일 땐 트윗의 링크가 뜨는 데 그건 quoteLink
    const quoteLink = tweetElem.querySelector(`a[href^="${qUrl.pathname}" i]`)
    const quotedTweet = tweetElem.querySelector('div[role=blockquote]')
    const indicateMe = quoteLink || quotedTweet || tweetElem
    reflectBlockOnVisible(tweetElem, {
      user: quotedUser,
      indicateBlock() {
        markOutline(indicateMe)
        badge.attachAfter(indicateMe)
      },
      indicateReflection() {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(quotedUser)
      },
    })
  }
  async function handleMentionsInTweet(tweet: Tweet, tweetElem: HTMLElement) {
    const mentionedUserEntities = tweet.entities.user_mentions || []
    if (mentionedUserEntities.length <= 0) {
      return
    }
    const links = Array.from(
      tweetElem.querySelectorAll<HTMLAnchorElement>('a[role=link][href^="/"]')
    )
    const mentionElemsMap = new Map<string, HTMLAnchorElement[]>(
      mentionedUserEntities
        .map(ent => ent.screen_name.toLowerCase())
        .map((loweredName): [string, HTMLAnchorElement[]] => [
          loweredName,
          links.filter(a => a.pathname.toLowerCase() === `/${loweredName}`),
        ])
    )
    const overflowed = tweetElem.querySelector('a[aria-label][href$="/people"]')
    const mentionedUsersMap = await UserGetter.getMultipleUsersById(
      mentionedUserEntities.map(u => u.id_str)
    ).catch(() => null)
    if (!mentionedUsersMap) {
      return
    }
    for (const mUser of mentionedUsersMap.values()) {
      if (!mUser.blocked_by) {
        continue
      }
      const loweredName = mUser.screen_name.toLowerCase()
      const mentionElems = mentionElemsMap.get(loweredName)!
      const badge = new Badge(mUser)
      reflectBlockOnVisible(tweetElem, {
        user: mUser,
        indicateBlock() {
          if (mentionElems.length > 0) {
            mentionElems.forEach(el => {
              markOutline(el)
              badge.attachAfter(el)
            })
          } else if (overflowed) {
            markOutline(overflowed)
            badge.showUserName()
            badge.attachAfter(overflowed)
          }
        },
        indicateReflection() {
          badge.blockReflected()
          StoreUpdater.afterBlockUser(mUser)
        },
      })
    }
  }
  export async function handleTweet(tweetEntry: TweetEntry, tweet: Tweet) {
    if (!tweet) {
      return
    }
    const tweetElem = getElemByEntry(tweetEntry)
    if (!tweetElem) {
      return
    }
    if (tweet.is_quote_status) {
      const qtweet = tweet as TweetWithQuote
      handleQuotedTweet(qtweet, tweetElem)
    }
    await handleMentionsInTweet(tweet, tweetElem)
    // 대화트리 UI에서, 다른 트윗을 선택하면 차단표시된 게 지워지는 현상이 있다.
    // 따라서, 처리 완료 후 attr을 지워서 다시 처리할 수 있도록 함.
    tweetElem.removeAttribute('data-mirrorblock-entryid')
  }
  export async function handleUser(userEntry: UserEntry, user: TwitterUser) {
    if (!(user && user.blocked_by)) {
      return
    }
    const elem = getElemByEntry(userEntry)!
    const badge = new Badge(user)
    const badgeTarget = elem.querySelector(
      `a[role=link][href^="/${user.screen_name}" i] [dir=ltr]`
    )
    if (!badgeTarget) {
      throw new Error('unreachable')
    }
    reflectBlockOnVisible(elem, {
      user,
      indicateBlock() {
        markOutline(elem)
        badge.attachAfter(badgeTarget)
      },
      indicateReflection() {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(user)
      },
    })
  }
  export async function handleTombstone(
    tombstoneEntry: TombstoneEntry,
    tweet: Tweet | null
  ) {
    if (!tweet) {
      return
    }
    const user = await UserGetter.getUserById(tweet.user, true)
    if (!user || !user.blocked_by) {
      return
    }
    const elem = getElemByEntry(tombstoneEntry)!
    const badge = new Badge(user)
    badge.showUserName()
    const badgeTarget = elem.querySelector('span[dir]')!
    const outlineTarget = badgeTarget.closest('div[dir=auto]')!.parentElement!
    reflectBlockOnVisible(elem, {
      user,
      indicateBlock() {
        markOutline(outlineTarget)
        badge.appendTo(badgeTarget)
      },
      indicateReflection() {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(user)
      },
    })
  }
}
namespace UserCellHandler {
  async function getUser(
    idOrName: UserCellIdentifier
  ): Promise<TwitterUser | null> {
    const { userId, userName } = idOrName
    if (userId) {
      return UserGetter.getUserById(userId, false)
    } else if (userName) {
      return UserGetter.getUserByName(userName, false)
    } else {
      throw new Error('unreachable')
    }
  }
  export async function handleUserCells(idOrName: UserCellIdentifier) {
    const userCellElems = getElemsByUserCell(idOrName)
    if (userCellElems.length <= 0) {
      return
    }
    const user = await getUser(idOrName)
    if (!user || !user.blocked_by) {
      return
    }
    const badgesPool: Badge[] = []
    reflectBlock({
      user,
      indicateBlock() {
        const badge = new Badge(user)
        badgesPool.push(badge)
        for (const elem of userCellElems) {
          markOutline(elem)
          const badgeTarget = elem.querySelector('div[dir=ltr]')!
          badge.attachAfter(badgeTarget)
        }
      },
      indicateReflection() {
        badgesPool.forEach(b => b.blockReflected())
        StoreUpdater.afterBlockUser(user)
      },
    })
  }
}
namespace DMHandler {
  export async function handleDMConversation(convId: string) {
    const dmData = await StoreRetriever.getDMData(convId)
    if (!dmData) {
      throw new Error('unreachable')
    }
    if (!dmData.read_only) {
      return
    }
    const elem = getElemByDmData(dmData)!
    const badgeTarget = elem.querySelector('div[dir=ltr]')!
    const participants = await UserGetter.getMultipleUsersById(
      dmData.participants.map(par => par.user_id)
    )
    const blockedMe = participants.filter(user => !!user.blocked_by)
    if (blockedMe.size <= 0) {
      return
    }
    for (const userToBlock of blockedMe.values()) {
      const badge = new Badge(userToBlock)
      if (dmData.type === 'GROUP_DM') {
        badge.showUserName()
      }
      await reflectBlock({
        user: userToBlock,
        indicateBlock() {
          markOutline(elem)
          badge.appendTo(badgeTarget)
        },
        indicateReflection() {
          badge.blockReflected()
          StoreUpdater.afterBlockUser(userToBlock)
        },
      })
    }
  }
}
const entryQueue = new (class {
  private promise = Promise.resolve()
  private async handleEntry(entryWithData: EntryWithData): Promise<void> {
    const { entry, entryData } = entryWithData
    switch (entry.type) {
      case 'tweet': {
        const tweet = entryData as Tweet
        return EntryHandler.handleTweet(entry, tweet)
      }
      case 'user': {
        const user = entryData as TwitterUser
        return EntryHandler.handleUser(entry, user)
      }
      case 'tombstone': {
        const tweet = entryData as (Tweet | null)
        return EntryHandler.handleTombstone(entry, tweet)
      }
    }
  }
  public push(entryWithData: EntryWithData) {
    this.promise = this.promise.then(() => this.handleEntry(entryWithData))
  }
})()
function startObserve(reactRoot: HTMLElement): void {
  new MutationObserver(mutations => {
    for (const elem of Utils.getAddedElementsFromMutations(mutations)) {
      ProfileDetector.detectProfile(elem)
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
  document.addEventListener('MirrorBlock<-entry', event => {
    const customEvent = event as CustomEvent<EntryWithData>
    const entryWithData = customEvent.detail
    entryQueue.push(entryWithData)
  })
  document.addEventListener('MirrorBlock<-UserCell', event => {
    const customEvent = event as CustomEvent<UserCellIdentifier>
    const { userId, userName } = customEvent.detail
    UserCellHandler.handleUserCells({ userId, userName })
  })
  document.addEventListener('MirrorBlock<-DMConversation', event => {
    const customEvent = event as CustomEvent<{ convId: string }>
    const { convId } = customEvent.detail
    DMHandler.handleDMConversation(convId)
  })
}
async function isLoggedIn(): Promise<boolean> {
  try {
    const scripts = Array.from(document.querySelectorAll('script:not([src])'))
    const result = scripts
      .map(script => /"isLoggedIn":(true|false)/.exec(script.innerHTML))
      .filter(n => !!n)
      .pop()!
      .pop()
    return result === 'true'
  } catch (err) {
    console.warn('warning. login-check logic should update.')
    console.warn('error: %o', err)
    const checkViaAPI = await TwitterAPI.getMyself().catch(() => null)
    return !!checkViaAPI
  }
}

export async function detectOnCurrentTwitter(reactRoot: HTMLElement) {
  const loggedIn = await isLoggedIn()
  if (!loggedIn) {
    return
  }
  await Utils.injectScript('bundled/twitter_inject.bun.js')
  startObserve(reactRoot)
}
