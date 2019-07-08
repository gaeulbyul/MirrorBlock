namespace MirrorBlockInject.Mobile {
  interface ReduxStore {
    getState(): any
    dispatch(payload: { type: string; [key: string]: any }): any
    subscribe(callback: () => void): void
    // replaceReducer(): any
  }
  function dig<T>(obj: () => T): T | null {
    try {
      return obj()
    } catch (err) {
      if (err instanceof TypeError) {
        return null
      } else {
        throw err
      }
    }
  }
  function getReactEventHandler(target: Element): any {
    const key = Object.keys(target)
      .filter((k: string) => k.startsWith('__reactEventHandlers'))
      .pop()
    return key ? (target as any)[key] : null
  }
  function isReduxStore(something: any): something is ReduxStore {
    if (!something) {
      return false
    }
    if (typeof something !== 'object') {
      return false
    }
    if (typeof something.getState !== 'function') {
      return false
    }
    if (typeof something.dispatch !== 'function') {
      return false
    }
    if (typeof something.subscribe !== 'function') {
      return false
    }
    return true
  }
  function findReduxStore(reactRoot: Element): ReduxStore | null {
    {
      const reactRoot1 = reactRoot as any
      const store1 = dig(
        () =>
          reactRoot1._reactRootContainer._internalRoot.current.memoizedState
            .element.props.store
      )
      if (isReduxStore(store1)) {
        return store1
      }
    }
    // 2019-04-08: store 위치 바뀐 듯
    // do-while: 유사 GOTO문
    // $.__reactEventHandlers$???????????.children.props.store
    do {
      const reactRoot2 = document.querySelector('[data-reactroot]')!.children[0]
      const rEventHandler = getReactEventHandler(reactRoot2)
      if (!rEventHandler) {
        break
      }
      const store2 = dig(() => rEventHandler.children.props.store)
      if (isReduxStore(store2)) {
        return store2
      }
    } while (0)
    console.warn(
      '[Mirror Block] WARNING: failed to find redux store! Block-reflection on new UI is disabled!'
    )
    return null
  }
  namespace ReduxSubscriber {
    function sendEntitiesToExtension(state: any) {
      const users = dig(() => state.entities.users.entities)
      const tweets = dig(() => state.entities.tweets.entities)
      const conversations = dig(() => state.directMessages.conversations)
      if (!(users && tweets)) {
        return
      }
      const detail: SubscribedEntities = {
        users,
        tweets,
        conversations,
      }
      if (!conversations) {
        delete detail.conversations
      }
      document.dispatchEvent(
        new CustomEvent<SubscribedEntities>('MirrorBlock<-subscribe', {
          detail,
        })
      )
    }
    export function subscribe(reduxStore: ReduxStore): void {
      reduxStore.subscribe(() => {
        const state = reduxStore.getState()
        sendEntitiesToExtension(state)
      })
    }
  }
  namespace ReduxDispatcher {
    function addEvent(
      name: ReduxStoreEventNames,
      callback: (event: CustomEvent) => void
    ): void {
      document.addEventListener(`MirrorBlock->${name}`, event => {
        const customEvent = event as CustomEvent
        callback(customEvent)
      })
    }
    export function listenEvent(reduxStore: ReduxStore): void {
      addEvent('insertSingleUserIntoStore', event => {
        const user: TwitterUser = event.detail.user
        reduxStore.dispatch({
          type: 'rweb/entities/ADD_ENTITIES',
          payload: {
            users: {
              [user.id_str]: user,
            },
          },
        })
      })
      addEvent('insertMultipleUsersIntoStore', event => {
        const users: TwitterUserEntities = event.detail.users
        reduxStore.dispatch({
          type: 'rweb/entities/ADD_ENTITIES',
          payload: {
            users,
          },
        })
      })
      addEvent('afterBlockUser', event => {
        const { user } = event.detail
        const userId = user.id_str
        const uniqId = uuid.v1()
        reduxStore.dispatch({
          type: 'rweb/blockedUsers/BLOCK_REQUEST',
          optimist: {
            id: uniqId,
            type: 'BEGIN',
          },
          meta: {
            userId,
          },
        })
      })
      addEvent('toastMessage', event => {
        const { text } = event.detail
        reduxStore.dispatch({
          type: 'rweb/toasts/ADD_TOAST',
          payload: { text },
        })
      })
    }
  }
  namespace DOMEventDispatcher {
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
    function sendEntryToExtension() {
      const sections = document.querySelectorAll('section[role=region]')
      for (const section of sections) {
        // 설정 창의 왼쪽 사이드바 부분
        // 사용자가 뜨는 부분이 아니므로 스킵한다.
        if (section.matches('section[aria-labelledby="master-header"]')) {
          continue
        }
        const children = dig(
          () => section.children[1].children[0].children[0].children
        )
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
            item.setAttribute('data-mirrorblock-entryid', entry.entryId)
            const customEvent = new CustomEvent('MirrorBlock<-entry', {
              detail: entry,
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
        cell.setAttribute(
          'data-mirrorblock-usercell-name',
          userNameWithoutAtSign
        )
      }
      return userCells
    }
    function handleUserCellsInRepliers(): NodeListOf<Element> | null {
      const rootElem = document.querySelector(
        '[aria-modal=true], main[role=main]'
      )
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
      const cellDatas = dig<UserCell[]>(() => {
        return rEventHandler.children.map((c: any) => c.props)
      })
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
        const convId = dig<string>(
          () => rEventHandler.children[0].props.conversationId
        )
        if (!convId) {
          throw new Error('failed to get conv. id')
        }
        elem.setAttribute('data-mirrorblock-conversation-id', convId)
        const customEvent = new CustomEvent('MirrorBlock<-DMConversation', {
          detail: { convId },
        })
        document.dispatchEvent(customEvent)
      }
    }
    export function observe(reactRoot: Element): void {
      new MutationObserver(() => {
        sendEntryToExtension()
        sendUserCellToExtension()
        sendDMConversationsToExtension()
      }).observe(reactRoot, {
        subtree: true,
        childList: true,
        characterData: true,
      })
    }
  }
  function inject(): void {
    const reactRoot = document.getElementById('react-root')!
    const reduxStore = findReduxStore(reactRoot)
    if (!reduxStore) {
      return
    }
    ReduxSubscriber.subscribe(reduxStore)
    ReduxDispatcher.listenEvent(reduxStore)
    DOMEventDispatcher.observe(reactRoot)
    // XXX debug
    // Object.assign(window, {
    //   $$store: reduxStore,
    // })
  }
  export function initialize() {
    const reactRoot = document.getElementById('react-root')!
    if ('_reactRootContainer' in reactRoot) {
      console.debug('inject!!!')
      inject()
    } else {
      console.debug('waiting...')
      setTimeout(initialize, 500)
    }
  }
}

{
  const { initialize } = MirrorBlockInject.Mobile
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initialize, {
      timeout: 3000,
    })
  } else {
    console.warn('requestIdleCallback not found. fallback')
    initialize()
  }
}
