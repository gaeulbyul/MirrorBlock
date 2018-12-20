/// <reference path="./twitter-api.ts" />

function generateBlocksYouBadge(afterText: string = ''): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'mob-badge mob-BlockStatus'
  badge.textContent = `나를 차단함 ${afterText}`.trim()
  return badge
}
function generateBlockReflectedBadge(): HTMLElement {
  const badge = document.createElement('span')
  badge.className = 'mob-badge mob-BlockReflectedStatus'
  badge.textContent = '차단반사 발동!'
  return badge
}

{
  interface IFoundTarget {
    selector: string
    elem: HTMLElement
    alreadyBlocked: boolean
    blocksYou: boolean
    muted: boolean
    userId: string
    appendBadge: (badgeElem: HTMLElement) => void
    addOutlineClassName: () => void
    afterBlockReflect?: () => void
  }

  interface FoundTargetJAU extends IFoundTarget {
    selector: '.js-actionable-user'
  }

  interface FoundTargetProfile extends IFoundTarget {
    selector: '.ProfileNav'
  }

  type FoundTarget = FoundTargetJAU | FoundTargetProfile

  function transformJAU(elem: HTMLElement): FoundTargetJAU {
    return {
      selector: '.js-actionable-user',
      elem,
      alreadyBlocked: elem.querySelector('.blocked') !== null,
      muted: elem.querySelector('.muting') !== null,
      blocksYou: elem.querySelector('.blocks-you') !== null,
      userId: elem.getAttribute('data-user-id')!,
      appendBadge(badgeElem: HTMLElement) {
        // 팔로우 페이지의 프로필카드
        const cardUserName = elem.querySelector<HTMLElement>(
          '.ProfileCard-screenname'
        )
        // 리스트나 차단/뮤트목록의 항목
        const itemContent = elem.querySelector<HTMLElement>('.content')
        if (cardUserName) {
          cardUserName.appendChild(badgeElem)
        }
        if (itemContent) {
          itemContent.appendChild(badgeElem)
        }
      },
      addOutlineClassName() {
        elem.classList.add('mob-blocks-you-outline')
      },
      afterBlockReflect() {
        const actions = elem.querySelector('.user-actions')
        if (actions) {
          actions.classList.remove('not-following')
          actions.classList.add('blocked')
        }
      },
    }
  }

  function transformProfile(elem: HTMLElement): FoundTargetProfile {
    return {
      selector: '.ProfileNav',
      elem,
      alreadyBlocked: elem.querySelector('.blocked') !== null,
      muted: elem.querySelector('.muting') !== null,
      blocksYou: elem.querySelector('.blocks-you') !== null,
      userId: elem.getAttribute('data-user-id')!,
      appendBadge(badgeElem: HTMLElement) {
        // elem.querySelector('.ProfileCard-screenname')!.appendChild(badgeElem)
        document
          .querySelector('.ProfileHeaderCard-screenname')!
          .appendChild(badgeElem)
      },
      addOutlineClassName() {
        const avatar = document.querySelector('.ProfileAvatar')
        if (avatar) {
          avatar.classList.add('mob-blocks-you-outline')
        }
      },
      afterBlockReflect() {
        const actions = elem.querySelector('.user-actions')
        if (actions) {
          actions.classList.remove('not-following')
          actions.classList.add('blocked')
        }
        const profileActionsElem = elem.querySelector(
          '.ProfileNav-item--userActions'
        )
        if (profileActionsElem) {
          profileActionsElem.classList.add('profile-blocks-you')
        }
      },
    }
  }

  async function blockReflection(ft: FoundTarget) {
    const result = await TwitterAPI.blockUserById(ft.userId)
    if (result) {
      ft.appendBadge(generateBlockReflectedBadge())
      if (typeof ft.afterBlockReflect === 'function') {
        ft.afterBlockReflect()
      }
    }
  }
  // 보이지 않는 인용트윗은 트위터에서 내부적으로 Tombstone이란 클래스네임이 붙는다.
  async function tombstoneHandler(ts: HTMLElement): Promise<void> {
    const parent = ts.parentElement
    if (!parent) {
      return
    }
    const options = await ExtOption.load()
    const links = parent.querySelectorAll<HTMLAnchorElement>(
      'a[data-expanded-url^="https://twitter.com/"]'
    )
    for (const link of links) {
      const realUrl = new URL(link.getAttribute('data-expanded-url')!)
      const userName = realUrl.pathname.split('/')[1]
      console.log('found tombstone with username %s', userName)
      const targetUser = await TwitterAPI.getSingleUserByName(userName).catch(
        () => null
      )
      if (!targetUser) {
        return
      }
      if (!targetUser.blocked_by) {
        return
      }
      ts.appendChild(generateBlocksYouBadge(`(@${targetUser.screen_name})`))
      ts.classList.add('mob-blocks-you-outline')
      const muteSkip = targetUser.muting && !options.blockMutedUser
      const shouldBlock =
        options.enableBlockReflection && !targetUser.blocking && !muteSkip
      if (shouldBlock) {
        const result = await TwitterAPI.blockUser(targetUser)
        if (result) {
          ts.appendChild(generateBlockReflectedBadge())
        }
      }
    }
  }

  async function foundTargetHandler(ft: FoundTarget): Promise<void> {
    ft.addOutlineClassName()
    ft.appendBadge(generateBlocksYouBadge())
    const options = await ExtOption.load()
    const muteSkip = ft.muted && !options.blockMutedUser
    const shouldBlock =
      options.enableBlockReflection && !ft.alreadyBlocked && !muteSkip
    if (shouldBlock) {
      blockReflection(ft)
    }
  }

  function extractJAUElems(node: Document | HTMLElement): FoundTargetJAU[] {
    const nodelist = node.querySelectorAll<HTMLElement>('.js-actionable-user')
    const result = Array.from(nodelist).map(transformJAU)
    if (node instanceof HTMLElement && node.matches('.js-actionable-user')) {
      result.push(transformJAU(node))
    }
    return result
  }

  function checkTargetElems(fts: FoundTarget[]): FoundTarget[] {
    return fts
      .filter(ft => !ft.elem.classList.contains('mob-checked'))
      .map(ft => (ft.elem.classList.add('mob-checked'), ft))
      .filter(ft => ft.blocksYou)
      .map(ft => (ft.elem.classList.add('mob-blocks-you'), ft))
  }

  function extractTargetElems(node: Document | HTMLElement): FoundTarget[] {
    const foundTargetElems: FoundTarget[] = []
    foundTargetElems.push(...extractJAUElems(node))
    const profileNav = document.querySelector<HTMLElement>('.ProfileNav')
    if (profileNav) {
      foundTargetElems.push(transformProfile(profileNav))
    }
    return checkTargetElems(foundTargetElems)
  }

  function applyToRendered() {
    extractTargetElems(document).forEach(foundTargetHandler)
    document
      .querySelectorAll<HTMLElement>('.Tombstone')
      .forEach(tombstoneHandler)
  }

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) {
          continue
        }
        extractTargetElems(node).forEach(foundTargetHandler)
        node
          .querySelectorAll<HTMLElement>('.Tombstone')
          .forEach(tombstoneHandler)
      }
    }
  })
  if (document.getElementById('react-root')) {
    console.debug('차단반사 미지원 페이지!')
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })
    applyToRendered()

    browser.storage.onChanged.addListener(changes => {
      const option = changes.option.newValue
      document.documentElement!.classList.toggle(
        'mob-enable-outline',
        option.outlineBlockUser
      )
    })

    ExtOption.load().then(option => {
      document.documentElement!.classList.toggle(
        'mob-enable-outline',
        option.outlineBlockUser
      )
    })
  }
}
