import { dig, getReactEventHandler } from './inject-common'

function isEntry(obj: any): obj is Entry {
  if (!(obj && typeof obj === 'object')) {
    return false
  }
  if (typeof obj.entryId !== 'string') {
    return false
  }
  return true
}
function isUserCell(obj: any): obj is UserCell {
  if (!(obj && typeof obj === 'object')) {
    return false
  }
  if (obj.displayMode !== 'UserDetailed') {
    return false
  }
  return true
}
function getDataFromEntry(entry: Entry, state: any) {
  switch (entry.type) {
    case 'user': {
      const userId = entry.content.id
      const userData = dig(() => state.entities.users.entities[userId])
      return userData
    }
    case 'tweet': {
      const tweetId = entry.content.id
      const tweetData = dig(() => state.entities.tweets.entities[tweetId])
      return tweetData
    }
    case 'tombstone': {
      const tweetId = dig(() => entry.content.tweet!.id)
      if (tweetId) {
        const tweetData = dig(() => state.entities.tweets.entities[tweetId])
        return tweetData
      }
      return null
    }
  }
}
function sendEntryToExtension(state: any) {
  const sections = document.querySelectorAll('section[role=region]')
  for (const section of sections) {
    // 설정 창의 왼쪽 사이드바 부분
    // 사용자가 뜨는 부분이 아니므로 스킵한다.
    if (section.matches('section[aria-labelledby="master-header"]')) {
      continue
    }
    // [2020-05-29] 좀 더 나은 방법 생각해보자...
    // const children = dig(() => section.children[1].children[0].children)
    const children = dig(() => section.children[1].children[0].children[0].children)
    if (!children) {
      return
    }
    for (const item of children) {
      if (item.hasAttribute('data-mirrorblock-entryid')) {
        continue
      }
      const rEventHandler = getReactEventHandler(item)!
      const props = dig(() => rEventHandler.children.props.children.props)
      if (!props) {
        continue
      }
      const entry = dig(() => props.entry)
      if (isEntry(entry)) {
        // console.debug('%o %o', item, entry)
        const entryData = getDataFromEntry(entry, state)
        if (!entryData) {
          continue
        }
        item.setAttribute('data-mirrorblock-entryid', entry.entryId)
        // 개체에 함수가 섞여있으면 contents_script에 이벤트로 전달할 수 없다.
        // (보안문제로)
        // 여기에서 함수를 뺀 새 개체를 만들어낸다.
        const entryJson = JSON.parse(
          JSON.stringify(entry, (_key, value) => (typeof value === 'function' ? null : value), 0)
        )
        const detail = {
          entry: entryJson,
          entryData,
        }
        const customEvent = new CustomEvent('MirrorBlock<-entry', {
          detail,
        })
        document.dispatchEvent(customEvent)
        continue
      }
      if (isUserCell(props)) {
        const userId = props.userId
        item.setAttribute('data-mirrorblock-usercell-id', userId)
        const customEvent = new CustomEvent('MirrorBlock<-UserCell', {
          detail: { userId, userName: null },
        })
        document.dispatchEvent(customEvent)
      }
    }
  }
}
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
    if (userCell.closest('[data-mirrorblock-entryid]')) {
      continue
    }
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
export function observe(reactRoot: Element, reduxStore: ReduxStore): void {
  new MutationObserver(() => {
    const state = reduxStore.getState()
    sendEntryToExtension(state)
    sendUserCellToExtension()
    sendDMConversationsToExtension()
  }).observe(reactRoot, {
    subtree: true,
    childList: true,
    characterData: true,
  })
}
