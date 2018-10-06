const BLOCKS_YOU = '<span class="mob-BlockStatus">나를 차단함</span>'
const BLOCK_REFLECTED = '<span class="mob-BlockReflectedStatus">차단반사 발동!</span>'

// 딱지 붙일 요소 찾기
function getPlaceForBadge (user: Element): Element | null {
  // 팔로잉/팔로워 페이지
  const pcScreenName = user.querySelector('.ProfileCard-screenname')
  if (pcScreenName) {
    return pcScreenName
  }
  // 차단/뮤트 사용자 목록 및 리스트 멤버
  const content = user.querySelector('.content')
  if (content) {
    return content
  }
  const phcScreenName = document.querySelector('.ProfileHeaderCard-screenname')
  if (phcScreenName) {
    return phcScreenName
  }
  return null
}

// 사용자 옆에 "나를 차단함" 또는 "차단반사" 딱지 붙이기
function indicateBlockToUser (user: Element, badge: string): void {
  const alreadyBadged = badge === BLOCKS_YOU && user.querySelector('.mob-BlockStatus')
  const alreadyBadged2 = badge === BLOCK_REFLECTED && user.querySelector('.mob-BlockReflectedStatus')
  if (alreadyBadged || alreadyBadged2) {
    return
  }
  const badgePlace = getPlaceForBadge(user)
  if (badgePlace) {
    badgePlace.innerHTML += badge
  }
}

// 나를 차단한 사용자가 눈에 잘 띄도록 테두리 표시
function outlineToBlockedUser (user: Element): void {
  if (user.matches('.js-actionable-user')) {
    user.classList.add('mob-blocks-you-outline')
  } else if (user.classList.contains('ProfileNav')) {
    const circleProfileAvatar = document.querySelector('.ProfileAvatar')
    if (circleProfileAvatar) {
      circleProfileAvatar.classList.add('mob-blocks-you-outline')
    }
  }
}

// 차단반사
function reflectBlock (user: Element) {
  const actions = user.querySelector('.user-actions')
  if (!actions) {
    throw new Error('Failed to find actions element')
  }
  const userId = actions.getAttribute('data-user-id')
  if (!userId) {
    throw new Error('Failed to find user id from actions element')
  }
  return sendBlockRequest(userId).then(() => {
    changeButtonToBlocked(user)
    indicateBlockToUser(user, BLOCK_REFLECTED)
  })
}

function userHandler (user: Element) {
  if (!user) {
    return
  }
  const alreadyChecked = user.classList.contains('mob-checked')
  if (alreadyChecked) {
    return
  }
  user.classList.add('mob-checked')
  const blocksYou = !!user.querySelector('.blocks-you')
  if (!blocksYou) {
    return
  }
  user.classList.add('mob-blocks-you')
  indicateBlockToUser(user, BLOCKS_YOU)
  const alreadyBlocked = !!user.querySelector('.blocked')
  const muted = !!user.querySelector('.muting')
  outlineToBlockedUser(user)
  ExtOption.load().then(option => {
    const muteSkip = muted && !option.blockMutedUser
    const shouldBlock = option.enableBlockReflection && !alreadyBlocked && !muteSkip
    if (shouldBlock) {
      reflectBlock(user)
    }
  })
}

function applyToRendered () {
  const elementsToHandle = [
    ...document.querySelectorAll('.js-actionable-user')
  ]
  const profileNav = document.querySelector('.ProfileNav')
  if (profileNav) {
    elementsToHandle.push(profileNav)
  }
  elementsToHandle.forEach(userHandler)
}

function toggleNightMode (mode: boolean): void {
  document.documentElement!.classList.toggle('mob-nightmode', mode)
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) {
        continue
      }
      const elementsToHandle = [
        ...node.querySelectorAll('.js-actionable-user')
      ]
      if (node.matches('.js-actionable-user')) {
        elementsToHandle.push(node)
      }
      const profileNav = node.querySelector('.ProfileNav')
      if (profileNav) {
        elementsToHandle.push(profileNav)
      }
      elementsToHandle.forEach(userHandler)
    }
  }
})

const nightModeObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!(node instanceof Element)) {
        continue
      }
      if (node.matches('link.coreCSSBundles')) {
        const css = node as HTMLLinkElement
        const nightMode = /nightmode/.test(css.href)
        toggleNightMode(nightMode)
      }
    }
  }
})

const isDarkMode = /\bnight_mode=1\b/.test(document.cookie)

if (document.getElementById('react-root')) {
  console.info('차단반사 미지원 페이지!')
  const colorThemeClass = isDarkMode ? 'mob-mobile-dark' : 'mob-mobile-light'
  document.documentElement!.classList.add('mob-mobile', colorThemeClass)
} else {
  observer.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
  })

  nightModeObserver.observe(document.head!, {
    childList: true,
    subtree: true
  })

  toggleNightMode(isDarkMode)

  applyToRendered()

  browser.storage.onChanged.addListener(changes => {
    const option = changes.option.newValue
    document.documentElement!.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })

  ExtOption.load().then(option => {
    document.documentElement!.classList.toggle('mob-enable-outline', option.outlineBlockUser)
  })
}
