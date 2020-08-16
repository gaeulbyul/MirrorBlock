import { dig, getReactEventHandler } from './inject-common'

function handleUserCellsInAside(): NodeListOf<Element> | null {
  const asideElem = document.querySelector(
    'div[data-testid=sidebarColumn] aside[role=complementary]'
  )
  if (!asideElem) {
    return null
  }
  // react내 값으로 id를 가져오려 했는데 계속 일부 사용자의 ID가 누락된다.
  // 일단은 이전 방식을 사용함
  const userCells = asideElem.querySelectorAll('div[data-testid=UserCell]')
  for (const cell of userCells) {
    const ltr = cell.querySelector('a[role=link] div[dir=ltr]')
    const userName = ltr && ltr.textContent
    if (!(userName && /^@[0-9a-z_]{1,15}/i.test(userName))) {
      continue
    }
    const userNameWithoutAtSign = userName.replace(/^@/, '')
    cell.setAttribute('data-mirrorblock-usercell-name', userNameWithoutAtSign)
  }
  return userCells
}

function handleUserCellsInRepliers(): NodeListOf<Element> | null {
  const rootElem = document.querySelector('[aria-modal=true], main[role=main]')
  if (!rootElem) {
    return null
  }
  // 모바일 UI의 경우 main[role=main]을 기준으로 삼는데,
  // 이 땐 header[role=banner]가 안 떠야 한다.
  if (rootElem.matches('main[role=main]')) {
    const prevElem = rootElem.previousElementSibling
    if (prevElem && prevElem.matches('header[role=banner]')) {
      return null
    }
  }
  const cellElems = rootElem.querySelectorAll('[data-testid=UserCell]')
  if (cellElems.length <= 0) {
    return null
  }
  const parent = cellElems[0].parentElement!
  const rEventHandler = getReactEventHandler(parent)!
  const cellDatas = dig(() => {
    return rEventHandler.children.map((c: any) => c.props)
  }) as UserCell[] | null
  if (!cellDatas) {
    return null
  }
  if (cellElems.length !== cellDatas.length) {
    return null
  }
  cellElems.forEach((cell, index) => {
    const { userId } = cellDatas[index]
    if (!userId) {
      return
    }
    cell.setAttribute('data-mirrorblock-usercell-id', userId)
  })
  return cellElems
}

function sendUserCellToExtension() {
  const userCells: Element[] = []
  const cellsInAside = handleUserCellsInAside()
  if (cellsInAside) {
    userCells.push(...Array.from(cellsInAside))
  }
  const cellsInModal = handleUserCellsInRepliers()
  if (cellsInModal) {
    userCells.push(...Array.from(cellsInModal))
  }
  for (const userCell of userCells) {
    const userId = userCell.getAttribute('data-mirrorblock-usercell-id')
    const userName = userCell.getAttribute('data-mirrorblock-usercell-name')
    if (!(userId || userName)) {
      continue
    }
    const customEvent = new CustomEvent('MirrorBlock<-UserCell', {
      detail: { userId, userName },
    })
    document.dispatchEvent(customEvent)
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
    const customEvent = new CustomEvent('MirrorBlock<-DMConversation', {
      detail: { convId },
    })
    document.dispatchEvent(customEvent)
  }
}

function findTweetIdFromElement(elem: HTMLElement): string | null {
  if (!elem.matches('[data-testid=tweet]')) {
    throw new Error('unexpected non-tweet elem?')
  }
  const article = elem.closest('article[role=article]')
  if (!(article && article.parentElement)) {
    throw new Error()
  }
  // tweet-detail
  const parentReh = getReactEventHandler(article.parentElement)
  const maybeTweetId1 = dig(() => parentReh.children.props.entry.entryId)
  if (typeof maybeTweetId1 === 'string') {
    const maybeTweetId1Match = /^tweet-(\d+)$/.exec(maybeTweetId1 || '')
    if (maybeTweetId1Match) {
      return maybeTweetId1Match[1]
    }
  }
  const permalink = elem.querySelector('a[href^="/"][href*="/status/"')
  if (!(permalink instanceof HTMLAnchorElement)) {
    return null
  }
  const maybeTimeElem = permalink.children[0]
  if (maybeTimeElem.tagName === 'TIME') {
    const maybeTweetId2Match = /\/status\/(\d+)$/.exec(permalink.pathname)
    if (maybeTweetId2Match) {
      return maybeTweetId2Match[1]
    }
  }
  // 신고한 트윗이나 안 보이는 트윗 등의 경우, 여기서 트윗 ID를 못 찾는다.
  return null
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

const touchedTweetElems = new WeakSet<HTMLElement>()

function tweetDetector(state: any) {
  const tweetElems = document.querySelectorAll<HTMLElement>('[data-testid=tweet]')
  for (const elem of tweetElems) {
    if (touchedTweetElems.has(elem)) {
      continue
    }
    touchedTweetElems.add(elem)
    const tweet = inspectTweetElement(state, elem)
    if (!tweet) {
      return
    }
    const event = new CustomEvent('MirrorBlock<-Tweet', {
      bubbles: true,
      detail: { tweet },
    })
    elem.dispatchEvent(event)
  }
}

export function observe(reactRoot: Element, reduxStore: ReduxStore): void {
  new MutationObserver(() => {
    const state = reduxStore.getState()
    tweetDetector(state)
    sendUserCellToExtension()
    sendDMConversationsToExtension()
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
    characterData: true,
  })
}
