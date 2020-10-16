import { dig, getReactEventHandler } from './inject-common'
import * as EventNames from '../../event-names'

const touchedElems = new WeakSet<HTMLElement>()

function findTweetIdFromElement(elem: HTMLElement): string | null {
  if (!elem.matches('[data-testid=tweet]')) {
    throw new Error('unexpected non-tweet elem?')
  }
  const article = elem.closest('article[role=article]')! as HTMLElement
  const permalinks = article.querySelectorAll<HTMLAnchorElement>('a[href^="/"][href*="/status/"')
  for (const plink of permalinks) {
    const tweetIdMatch = /\/status\/(\d+)$/.exec(plink.pathname)
    const tweetId = tweetIdMatch![1]
    const firstChild = plink.firstElementChild
    if (firstChild?.tagName === 'TIME') {
      return tweetId
    }
    const viaLabel = article.querySelector(
      'a[href="https://help.twitter.com/using-twitter/how-to-tweet#source-labels"]'
    )
    if (viaLabel?.parentElement!.contains(plink)) {
      return tweetId
    }
  }
  // 신고한 트윗이나 안 보이는 트윗 등의 경우, 여기서 트윗 ID를 못 찾는다.
  return null
}

function findUserIdFromElement(elem: HTMLElement): string | null {
  if (!elem.matches('[data-testid=UserCell')) {
    throw new Error('unexpected non-usercell elem?')
  }
  const btn = elem.querySelector('[role=button][data-testid]')!
  const userIdMatch = /^(\d+)/.exec(btn.getAttribute('data-testid')!)!
  const userId = userIdMatch[1]
  return userId
}

function getTweetEntityById(state: any, tweetId: string) {
  const entities = state.entities.tweets.entities
  for (const entity_ of Object.values(entities)) {
    const entity = entity_ as any
    if (entity.id_str.toLowerCase() === tweetId) {
      return entity as TweetEntity
    }
  }
  return null
}

function getUserEntityById(state: any, userId: string): TwitterUser | null {
  const entities = state.entities.users.entities
  return entities[userId] || null
}

function inspectTweetElement(state: any, elem: HTMLElement) {
  const tweetId = findTweetIdFromElement(elem)
  if (!tweetId) {
    return null
  }
  const tweetEntity = getTweetEntityById(state, tweetId)
  if (!tweetEntity) {
    return null
  }
  const user = getUserEntityById(state, tweetEntity.user)
  if (!user) {
    return null
  }
  let quotedTweet: Tweet | null = null
  if (tweetEntity.is_quote_status) {
    const quotedTweetEntity = getTweetEntityById(state, tweetEntity.quoted_status!)
    if (quotedTweetEntity) {
      const user = getUserEntityById(state, quotedTweetEntity.user)
      if (user) {
        quotedTweet = Object.assign({}, quotedTweetEntity, {
          user,
        })
      }
    }
  }
  const tweet: Tweet = Object.assign({}, tweetEntity, {
    user,
    quoted_status: quotedTweet,
  })
  return tweet
}

function inspectUserCellElement(state: any, elem: HTMLElement) {
  const userId = findUserIdFromElement(elem)
  if (!userId) {
    return null
  }
  const user = getUserEntityById(state, userId)
  if (!user) {
    return null
  }
  return user
}

function userCellDetector(state: any) {
  const userCells = document.querySelectorAll<HTMLElement>('[data-testid=UserCell]')
  for (const elem of userCells) {
    if (touchedElems.has(elem)) {
      continue
    }
    touchedElems.add(elem)
    const user = inspectUserCellElement(state, elem)
    if (!user) {
      continue
    }
    const event = new CustomEvent(EventNames.USERCELL, {
      bubbles: true,
      detail: { user },
    })
    const intObserver = new IntersectionObserver((entries, observer) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) {
          continue
        }
        observer.unobserve(ent.target)
        requestIdleCallback(() => elem.dispatchEvent(event), {
          timeout: 1000,
        })
      }
    })
    intObserver.observe(elem)
  }
}

function sendDMConversationsToExtension() {
  const convElems = document.querySelectorAll('[data-testid=conversation]')
  for (const elem of convElems) {
    const parent = elem.parentElement!
    const rEventHandler = getReactEventHandler(parent)!
    const convId = dig(() => rEventHandler.children[0].props.conversationId)
    if (typeof convId !== 'string') {
      throw new Error('failed to get conv. id')
    }
    elem.setAttribute('data-mirrorblock-conversation-id', convId)
    const customEvent = new CustomEvent(EventNames.DM, {
      detail: { convId },
    })
    document.dispatchEvent(customEvent)
  }
}

function tweetDetector(state: any) {
  const tweetElems = document.querySelectorAll<HTMLElement>('[data-testid=tweet]')
  for (const elem of tweetElems) {
    // Tree-UI 등에서, 트윗을 접었다 펴면 붙었던 뱃지가 사라져 다시 붙여야 함
    // 그냥 중복처리를 허용하기로?
    // if (touchedElems.has(elem)) {
    //   continue
    // }
    // touchedElems.add(elem)
    const tweet = inspectTweetElement(state, elem)
    if (!tweet) {
      continue
    }
    const event = new CustomEvent(EventNames.TWEET, {
      bubbles: true,
      detail: { tweet },
    })
    const intObserver = new IntersectionObserver((entries, observer) => {
      for (const ent of entries) {
        if (!ent.isIntersecting) {
          continue
        }
        observer.unobserve(ent.target)
        requestIdleCallback(() => elem.dispatchEvent(event), {
          timeout: 1000,
        })
      }
    })
    intObserver.observe(elem)
  }
}

export function observe(reactRoot: Element, reduxStore: ReduxStore): void {
  new MutationObserver(() => {
    const state = reduxStore.getState()
    tweetDetector(state)
    userCellDetector(state)
    sendDMConversationsToExtension()
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
    // characterData: true,
  })
}
