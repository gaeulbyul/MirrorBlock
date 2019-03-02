declare function cloneInto<T>(detail: T, view: Window | null): T
const userNamePattern = /^@[0-9a-z_]{1,15}$/i
namespace MirrorBlock.Mobile {
  class ReduxedStore {
    // 파이어폭스에서 CustomEvent의 detail 개체 전달용
    private cloneDetail<T>(detail: T): T {
      if (typeof detail !== 'object') {
        return detail
      }
      if (typeof cloneInto === 'function') {
        return cloneInto(detail, document.defaultView)
      } else {
        return detail
      }
    }
    private async triggerPageEvent(
      eventName: string,
      eventDetail?: object
    ): Promise<any> {
      const nonce = Math.random()
      const detail = this.cloneDetail(
        Object.assign({}, eventDetail, {
          nonce,
        })
      )
      const requestEvent = new CustomEvent(`MirrorBlock->${eventName}`, {
        detail,
      })
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject('timeouted!')
        }, 10000)
        document.addEventListener(
          `MirrorBlock<-${eventName}.${nonce}`,
          event => {
            window.clearTimeout(timeout)
            const customEvent = event as CustomEvent
            resolve(customEvent.detail)
          },
          { once: true }
        )
        document.dispatchEvent(requestEvent)
      })
    }
    public async getUserByName(userName: string): Promise<TwitterUser | null> {
      const result = await this.triggerPageEvent('getUserByName', {
        userName,
      })
      if (MirrorBlock.Utils.isTwitterUser(result)) {
        return result
      } else {
        return null
      }
    }
    public async insertUserIntoStore(user: TwitterUser): Promise<void> {
      this.triggerPageEvent('insertUserIntoStore', {
        user,
      })
    }
    public async afterBlockUser(user: TwitterUser): Promise<void> {
      this.triggerPageEvent('afterBlockUser', {
        user,
      })
      const clonedUser = Object.assign({}, user)
      clonedUser.blocking = true
      this.insertUserIntoStore(clonedUser)
    }
  }
  const reduxedStore = new ReduxedStore()
  // API호출 실패한 사용자이름을 저장하여 API호출을 반복하지 않도록 한다.
  // (예: 지워지거나 정지걸린 계정)
  const failedUserNames = new Set<string>()
  async function getUserFromEitherStoreOrAPI(
    userName: string
  ): Promise<TwitterUser | null> {
    if (failedUserNames.has(userName)) {
      return null
    }
    const userFromStore = await reduxedStore.getUserByName(userName)
    if (userFromStore) {
      return userFromStore
    } else {
      console.debug('request api "@%s"', userName)
      const user = await TwitterAPI.getSingleUserByName(userName).catch(err => {
        failedUserNames.add(userName)
        if (err instanceof Response) {
          console.error(err)
        }
        return null
      })
      if (user) {
        reduxedStore.insertUserIntoStore(user)
      }
      return user
    }
  }
  // data-testid 쓸 일이 많아서 만든 shortcut
  const TI_TWEET = '[data-testid="tweet"]'
  const TI_TWEET_DETAIL = '[data-testid="tweetDetail"]'
  const TI_USER_CELL = '[data-testid="UserCell"]'
  function markOutline(elem: Element | null): void {
    if (elem) {
      elem.setAttribute('data-mirrorblock-blocks-you', '1')
    }
  }
  function getUserNameFromTweetUrl(
    extractMe: HTMLAnchorElement | URL | Location
  ): string | null {
    const pathname = extractMe.pathname
    const matches = /^\/([0-9a-z_]{1,15})/i.exec(pathname)
    return matches ? matches[1] : null
  }
  namespace TweetLinkDetector {
    const tweetLinkObserver = new IntersectionObserver(
      async (entries, observer) => {
        const userMap = new Map<string, TwitterUser>()
        const visibleEntries = entries.filter(e => e.isIntersecting)
        for (const entry of visibleEntries) {
          const link = entry.target as HTMLAnchorElement
          observer.unobserve(link)
          const userName = getUserNameFromTweetUrl(link)
          if (!userName) {
            continue
          }
          let user = userMap.get(userName) || null
          if (!user) {
            user = await getUserFromEitherStoreOrAPI(userName)
          }
          if (!user) {
            continue
          }
          userMap.set(userName, user)
          const badge = new MirrorBlock.BadgeV2.Badge()
          if (/\/status\/\d+$/.test(link.href)) {
            badge.showUserName(userName)
          }
          await MirrorBlock.Reflection.reflectBlock({
            user,
            indicateBlock() {
              markOutline(link)
              if (!MirrorBlock.BadgeV2.alreadyExists(link)) {
                badge.attachAfter(link)
              }
            },
            indicateReflection() {
              badge.blockReflected()
              reduxedStore.afterBlockUser(user!)
            },
          })
        }
      },
      {
        rootMargin: '10px',
      }
    )
    function findLinks(tweetElem: HTMLElement): HTMLAnchorElement[] {
      const result: HTMLAnchorElement[] = []
      const internalLinks = Array.from(
        // 트윗 내 링크만
        tweetElem.querySelectorAll<HTMLAnchorElement>(
          '#react-root [dir="auto"] a[href^="/"]'
        )
      )
      for (const link of internalLinks) {
        const { pathname, textContent } = link
        if (/^\/[0-9a-z_]{1,15}\/status\/\d+/i.test(pathname)) {
          result.push(link)
          continue
        }
        if (textContent && userNamePattern.test(textContent)) {
          result.push(link)
          continue
        }
      }
      return result
    }
    export function detectOnTweetLinks(rootElem: Document | HTMLElement): void {
      const tweetElems = rootElem.querySelectorAll<HTMLElement>(
        `${TI_TWEET}, ${TI_TWEET_DETAIL}`
      )
      const filteredTweetElems = MirrorBlock.Utils.filterElements(tweetElems)
      for (const tweet of filteredTweetElems) {
        for (const link of findLinks(tweet)) {
          tweetLinkObserver.observe(link)
        }
      }
    }
  }
  namespace UserCellDetector {
    const userCellObserver = new IntersectionObserver(
      async (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          const cell = entry.target as HTMLElement
          observer.unobserve(cell)
          Array.from(cell.querySelectorAll('[dir="ltr"]'))
            .filter(ltr => userNamePattern.test(ltr.textContent || ''))
            // tagName이 a인 경우, 자기소개 속 닉네임 멘션으로 본다.
            .filter(ltr => ltr.tagName === 'DIV')
            .forEach(async ltr => {
              const userName = ltr.textContent!.replace(/^@/, '')
              const user = await getUserFromEitherStoreOrAPI(userName)
              if (!user) {
                return
              }
              const badge = new MirrorBlock.BadgeV2.Badge()
              MirrorBlock.Reflection.reflectBlock({
                user,
                indicateBlock() {
                  markOutline(cell)
                  badge.attachAfter(ltr)
                },
                indicateReflection() {
                  badge.blockReflected()
                },
              })
            })
        }
      },
      {
        rootMargin: '10px',
      }
    )
    export function detectOnUserCell(rootElem: Document | HTMLElement): void {
      const userCellElems = Array.from(
        rootElem.querySelectorAll<HTMLElement>(TI_USER_CELL)
      )
      const isUserCell = (e: HTMLElement) => e.matches(TI_USER_CELL)
      const onTweetDetailHeader = (e: HTMLElement) =>
        e.matches(`${TI_TWEET_DETAIL} ${TI_USER_CELL}`)
      if (rootElem instanceof HTMLElement && isUserCell(rootElem)) {
        // UserCell이 나중에 로딩된 경우,
        // rootElem에 (UserCell이 자식요소로 들어간 요소가 아닌) UserCell 자체가 들어온다.
        userCellElems.push(rootElem)
      }
      const filteredUserCellElems = MirrorBlock.Utils.filterElements(
        userCellElems
      )
      for (const cell of filteredUserCellElems) {
        // 트윗 헤더(사용자이름)부분에 들어간 거 말고*
        // 트윗 내용에 들어있는 거만
        // (*: 날 차단하면 트윗이 보일 수 없기 때문)
        if (!onTweetDetailHeader(cell)) {
          userCellObserver.observe(cell)
        }
      }
    }
  }
  namespace ProfileDetector {
    export async function detectProfile(rootElem: Document | HTMLElement) {
      const helpLinks = rootElem.querySelectorAll<HTMLElement>(
        'a[href="https://support.twitter.com/articles/20172060"]'
      )
      const filteredElems = MirrorBlock.Utils.filterElements(helpLinks)
      if (filteredElems.length <= 0) {
        return
      }
      const helpLink = filteredElems[0]
      const userName = getUserNameFromTweetUrl(location)
      if (!userName) {
        return
      }
      const user = await getUserFromEitherStoreOrAPI(userName)
      if (!user) {
        return
      }
      const badge = new MirrorBlock.BadgeV2.Badge()
      MirrorBlock.Reflection.reflectBlock({
        user,
        indicateBlock() {
          badge.appendTo(helpLink.parentElement!)
        },
        indicateReflection() {
          badge.blockReflected()
          reduxedStore.afterBlockUser(user)
        },
      })
    }
  }
  function detect(rootElem: Document | HTMLElement): void {
    TweetLinkDetector.detectOnTweetLinks(rootElem)
    UserCellDetector.detectOnUserCell(rootElem)
    ProfileDetector.detectProfile(rootElem)
  }
  export async function initialize() {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    await MirrorBlock.Utils.injectScript('vendor/uuid.js')
    await MirrorBlock.Utils.injectScript('scripts/twitter-inject.js')
    new MutationObserver(mutations => {
      for (const elem of MirrorBlock.Utils.getAddedElementsFromMutations(
        mutations
      )) {
        detect(elem)
      }
    }).observe(reactRoot, {
      subtree: true,
      childList: true,
    })
    detect(document)
  }
}

MirrorBlock.Mobile.initialize()
