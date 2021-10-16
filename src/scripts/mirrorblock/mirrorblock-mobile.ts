import * as Utils from '미러블락/scripts/common'
import * as TwitterAPI from '미러블락/scripts/twitter-api'
import { reflectBlock } from './mirrorblock-r'
import { StoreRetriever, StoreUpdater, UserGetter } from './redux-store'
import * as EventNames from '미러블락/scripts/event-names'

function markOutline(elem: Element): void {
  elem.setAttribute('data-mirrorblock-blocks-you', '1')
}

function getElemByDmData(dmData: DMData): HTMLElement | null {
  return document.querySelector(`[data-mirrorblock-conversation-id="${dmData.conversation_id}"]`)
}

async function detectProfile(rootElem: HTMLElement) {
  const helpLinks = rootElem.querySelectorAll<HTMLElement>(
    'a[href="https://support.twitter.com/articles/20172060"]'
  )
  const helpLink = Array.from(Utils.iterateUntouchedElems(helpLinks)).shift()
  if (!helpLink) {
    return
  }
  const userName = Utils.getUserNameFromTweetUrl(location)
  if (!userName) {
    return
  }
  // const user = StoreRetriever.getUserByName(userName)
  const user = await TwitterAPI.getSingleUserByName(userName)
  if (!user) {
    return
  }
  reflectBlock({
    user,
    indicateBlock(badge) {
      badge.appendTo(helpLink.parentElement!)
    },
    indicateReflection(badge) {
      badge.blockReflected()
      StoreUpdater.afterBlockUser(user)
    },
  })
}

function findElementToIndicateQuotedTweetFromBlockedUser(
  tweetElem: HTMLElement,
  quotedTweetUrl: URL
) {
  const article = tweetElem.closest('article[role=article]')!
  const quotedTweetInTimeline = tweetElem.querySelector('[data-testid=tweet] [data-testid=tweet]')
  const quotedTweetInDetail = article.querySelector('article article [data-testid=tweet]')
  const quotedTweet = quotedTweetInTimeline || quotedTweetInDetail
  if (quotedTweet) {
    const quotedTweetInnerMessage = quotedTweet.querySelector('[dir=auto]')
    return quotedTweetInnerMessage || quotedTweet
  } else {
    return article.querySelector(`a[href^="${quotedTweetUrl.pathname}" i]`)!
  }
}

async function handleQuotedTweet(tweet: Tweet, tweetElem: HTMLElement) {
  if (!tweet.is_quote_status) {
    return
  }
  const permalinkObject = tweet.quoted_status_permalink
  if (!permalinkObject) {
    return
  }
  const qUrlString = permalinkObject.expanded
  const qUrl = new URL(qUrlString)
  // 드물게 인용 트윗 주소가 t.co 링크일 경우도 있더라.
  if (qUrl.hostname === 't.co') {
    return
  }
  const quotedUserName = Utils.getUserNameFromTweetUrl(qUrl)!
  const quotedUser = await UserGetter.getUserByName(quotedUserName, true)
  if (!quotedUser) {
    return
  }
  reflectBlock({
    user: quotedUser,
    indicateBlock(badge) {
      const indicateMe = findElementToIndicateQuotedTweetFromBlockedUser(tweetElem, qUrl)
      markOutline(indicateMe)
      badge.attachAfter(indicateMe)
    },
    indicateReflection(badge) {
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
  const article = tweetElem.closest('article[role=article]')!
  const links = Array.from(article.querySelectorAll<HTMLAnchorElement>('a[role=link][href^="/"]'))
  const mentionElemsMap = new Map<string, HTMLAnchorElement[]>(
    mentionedUserEntities
      .map(ent => ent.screen_name.toLowerCase())
      .map((loweredName): [string, HTMLAnchorElement[]] => [
        loweredName,
        links.filter(a => a.pathname.toLowerCase() === `/${loweredName}`),
      ])
  )
  const overflowed = article.querySelector('a[aria-label][href$="/people"]')
  const mentionedUsersMap = await UserGetter.getMultipleUsersById(
    mentionedUserEntities.map(u => u.id_str)
  )
  for (const mUser of mentionedUsersMap.values()) {
    await reflectBlock({
      user: mUser,
      indicateBlock(badge) {
        const loweredName = mUser.screen_name.toLowerCase()
        const mentionElems = mentionElemsMap.get(loweredName)!
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
      indicateReflection(badge) {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(mUser)
      },
    })
  }
}

async function handleUserCells(user: TwitterUser, elem: HTMLElement) {
  reflectBlock({
    user,
    indicateBlock(badge) {
      markOutline(elem)
      const badgeTarget = elem.querySelector('div[dir=ltr]')!
      badge.attachAfter(badgeTarget)
    },
    indicateReflection(badge) {
      badge.blockReflected()
      StoreUpdater.afterBlockUser(user)
    },
  })
}

async function handleDMConversation(convId: string) {
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
    await reflectBlock({
      user: userToBlock,
      indicateBlock(badge) {
        markOutline(elem)
        if (dmData.type === 'GROUP_DM') {
          badge.showUserName()
        }
        badge.appendTo(badgeTarget)
      },
      indicateReflection(badge) {
        badge.blockReflected()
        StoreUpdater.afterBlockUser(userToBlock)
      },
    })
  }
}

function* PromisesQueue() {
  let promise = Promise.resolve()
  while ((promise = promise.then(yield)));
}

const promisesQueue = PromisesQueue()
// the first call of next executes from the start of the function
// until the first yield statement
promisesQueue.next()

function startObserve(reactRoot: HTMLElement): void {
  new MutationObserver(mutations => {
    for (const elem of Utils.getAddedElementsFromMutations(mutations)) {
      detectProfile(elem)
    }
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
  })
  document.addEventListener(EventNames.USERCELL, event => {
    const customEvent = event as CustomEvent
    const elem = customEvent.target as HTMLElement
    const { user } = customEvent.detail
    handleUserCells(user, elem)
  })
  document.addEventListener(EventNames.DM, event => {
    const customEvent = event as CustomEvent<{ convId: string }>
    const { convId } = customEvent.detail
    handleDMConversation(convId)
  })
  document.addEventListener(EventNames.TWEET, event => {
    const customEvent = event as CustomEvent
    const elem = customEvent.target as HTMLElement
    const { tweet } = customEvent.detail
    promisesQueue.next(() => handleMentionsInTweet(tweet, elem))
    promisesQueue.next(() => handleQuotedTweet(tweet, elem))
  })
}

export async function detectOnCurrentTwitter(reactRoot: HTMLElement) {
  const loggedIn = await Utils.checkLogin()
  if (!loggedIn) {
    return
  }
  await Utils.injectScript('bundled/twitter_inject.bun.js')
  startObserve(reactRoot)
}
