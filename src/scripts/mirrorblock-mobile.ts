namespace MirrorBlock.Mobile {
  const {
    Utils,
    Badge: { Badge },
    Reflection: { reflectBlock },
    Mobile: {
      Redux: { StoreRetriever, StoreUpdater },
    },
  } = MirrorBlock

  // data-testid 쓸 일이 많아서 만든 shortcut
  const TI_TWEET = '[data-testid="tweet"]'
  const TI_TWEET_DETAIL = '[data-testid="tweetDetail"]'
  const TI_USER_CELL = '[data-testid="UserCell"]'
  const TI_CONVERSATION = '[data-testid="conversation"]'

  const userNamePattern = /^@[0-9a-z_]{1,15}$/i
  // API호출 실패한 사용자이름을 저장하여 API호출을 반복하지 않도록 한다.
  // (예: 지워지거나 정지걸린 계정)
  const failedUserNames = new Set<string>()
  async function getUserFromEitherStoreOrAPI(
    userName: string
  ): Promise<TwitterUser | null> {
    if (failedUserNames.has(userName)) {
      return null
    }
    const userFromStore = StoreRetriever.getUserByName(userName)
    if (userFromStore) {
      console.debug('from store "@%s": %o', userName, userFromStore)
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
        StoreUpdater.insertUserIntoStore(user)
      }
      return user
    }
  }

  function markOutline(elem: Element | null): void {
    if (elem) {
      elem.setAttribute('data-mirrorblock-blocks-you', '1')
    }
  }
  function getUserNameFromTweetUrl(
    extractMe: HTMLAnchorElement | URL | Location
  ): string | null {
    return Utils.getUserNameFromTweetUrl(extractMe)
  }
  namespace TweetLinkDetector {
    function getVisibleTextFromLink(ln: Element): string | null {
      if (!ln.matches('a[dir="ltr"][role="link"][data-focusable]')) {
        return null
      }
      const { lastChild } = ln
      if (!lastChild) {
        return null
      }
      if (!(lastChild instanceof Text)) {
        return null
      }
      return lastChild.textContent
    }
    const tweetLinkObserver = new IntersectionObserver(
      async (entries, observer) => {
        const visibleEntries = entries.filter(e => e.isIntersecting)
        for (const entry of visibleEntries) {
          const link = entry.target as HTMLAnchorElement
          observer.unobserve(link)
          const userName = getUserNameFromTweetUrl(link)
          if (!userName) {
            continue
          }
          const user = await getUserFromEitherStoreOrAPI(userName)
          if (!user) {
            continue
          }
          const badge = new Badge()
          const isUserNameVisible = (
            getVisibleTextFromLink(link) || ''
          ).includes(userName)
          if (/\/status\/\d+$/.test(link.href) && !isUserNameVisible) {
            badge.showUserName(userName)
          }
          await reflectBlock({
            user,
            indicateBlock() {
              markOutline(link)
              badge.attachAfter(link)
            },
            indicateReflection() {
              badge.blockReflected()
              StoreUpdater.afterBlockUser(user)
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
      // Helper.insertNameToTweetDetailRegion에 넣은 값을 바탕으로
      // tweetDetail의 원 트윗작성자에겐 API호출을 하지 않도록 함
      let tweetDetailAuthor = ''
      const region = tweetElem.closest(
        'section[role=region][data-mirrorblock-tweetdetail-author]'
      )
      if (region) {
        tweetDetailAuthor = region.getAttribute(
          'data-mirrorblock-tweetdetail-author'
        )!
      }
      const internalLinks = Array.from(
        // 트윗 내 링크만
        tweetElem.querySelectorAll<HTMLAnchorElement>(
          '#react-root [dir="auto"] a[href^="/"]'
        )
      )
      for (const link of internalLinks) {
        const { pathname, textContent } = link
        const linkUserName = getUserNameFromTweetUrl(link)
        if (linkUserName === tweetDetailAuthor) {
          continue
        }
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
      const filteredTweetElems = Utils.filterElements(tweetElems)
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
              const badge = new Badge()
              reflectBlock({
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
      const filteredUserCellElems = Utils.filterElements(userCellElems)
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
  namespace DMUserListDetector {
    const dmUserItemObserver = new IntersectionObserver(
      async (entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue
          }
          const cell = entry.target as HTMLElement
          observer.unobserve(cell)
          Array.from(cell.querySelectorAll('[dir="ltr"]'))
            .filter(ltr => userNamePattern.test(ltr.textContent || ''))
            .forEach(async ltr => {
              const userName = ltr.textContent!.replace(/^@/, '')
              const user = await getUserFromEitherStoreOrAPI(userName)
              if (!user) {
                return
              }
              const badge = new Badge()
              reflectBlock({
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
    export function detectOnDMUserItem(rootElem: Document | HTMLElement): void {
      const dmUserItems = Array.from(
        rootElem.querySelectorAll<HTMLElement>(TI_CONVERSATION)
      )
      const filteredDmUserItems = Utils.filterElements(dmUserItems)
      for (const cell of filteredDmUserItems) {
        dmUserItemObserver.observe(cell)
      }
    }
  }
  namespace ProfileDetector {
    export async function detectProfile(rootElem: Document | HTMLElement) {
      const helpLinks = rootElem.querySelectorAll<HTMLElement>(
        'a[href="https://support.twitter.com/articles/20172060"]'
      )
      const filteredElems = Utils.filterElements(helpLinks)
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
      const badge = new Badge()
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
  namespace Helper {
    // tweetDetail에 사용자 이름을 넣는다
    export function insertNameToTweetDetailRegion(elem: HTMLElement): void {
      const authorLink = elem.querySelector<HTMLAnchorElement>(
        `${TI_TWEET_DETAIL} > ${TI_USER_CELL} a[href^='/']`
      )
      const region = elem.closest('section[role=region]') as HTMLElement | null
      if (authorLink && region) {
        const name = getUserNameFromTweetUrl(authorLink)
        if (name) {
          region.setAttribute('data-mirrorblock-tweetdetail-author', name)
        }
      }
    }
  }
  function detect(rootElem: Document | HTMLElement): void {
    TweetLinkDetector.detectOnTweetLinks(rootElem)
    UserCellDetector.detectOnUserCell(rootElem)
    ProfileDetector.detectProfile(rootElem)
    DMUserListDetector.detectOnDMUserItem(rootElem)
  }
  export async function initialize() {
    const reactRoot = document.getElementById('react-root')
    if (!reactRoot) {
      return
    }
    await Utils.injectScript('vendor/uuid.js')
    await Utils.injectScript('scripts/twitter-inject.js')
    StoreRetriever.subcribeEvent()
    new MutationObserver(mutations => {
      for (const elem of Utils.getAddedElementsFromMutations(mutations)) {
        const tweetDetail = elem.querySelector<HTMLElement>(TI_TWEET_DETAIL)
        if (tweetDetail) {
          Helper.insertNameToTweetDetailRegion(tweetDetail)
        }
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
