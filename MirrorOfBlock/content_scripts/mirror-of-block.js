/* globals browser, fetch, location, URLSearchParams, MutationObserver  */

const BLOCKS_YOU = '<span class="mob-BlockStatus">Blocks you</span>'
const BLOCK_REFLECTED = '<span class="mob-BlockReflectedStatus">Block Reflected!</span>'

const optionP = (function () {
  const defaultOption = {
    outlineBlockUser: false,
    enableBlockReflection: false,
    hideBlockedUser: false
  }
  return browser.storage.local.get('option').then(
    storage => Object.assign(defaultOption, storage.option),
    () => defaultOption
  )
}())

// 페이지에 CSS를 삽입
function injectCSS (css) {
  const div = document.createElement('div')
  div.innerHTML = `&shy;<style>${css}</style>`
  if (document.body) {
    document.body.appendChild(div)
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(div)
    })
  }
}

// 트위터 서버에 차단 요청을 보냄.
function sendBlockRequest (userId) {
  const authenticityToken = document.getElementById('authenticity_token').value
  const requestBody = new URLSearchParams()
  requestBody.append('authenticity_token', authenticityToken)
  requestBody.append('challenges_passed', 'false')
  requestBody.append('handles_challenges', '1')
  requestBody.append('impression_id', '')
  requestBody.append('user_id', userId)
  // [1]: referrer
  // Chrome에선 referrer속성 없이도 정상적으로 작동하지만
  // Firefox에서 그러면 referer 없이 요청을 보내서 403에러가 난다.
  // 따라서 직접 명시하도록 했음.
  const fetchOptions = {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    referrer: location.href, // [1]
    body: requestBody
  }
  return fetch('https://twitter.com/i/user/block', fetchOptions).then(response => {
    if (response.ok) {
      return response
    } else {
      console.dir(response)
      throw new Error(response)
    }
  })
}

// 딱지 붙일 요소 찾기
function getPlaceForBadge (user) {
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
function indicateBlockToUser (user, badge) {
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
function outlineToBlockedUser (user) {
  if (user.matches('.js-actionable-user')) {
    user.classList.add('mob-blocks-you-outline')
  } else if (user.classList.contains('ProfileNav')) {
    const circleProfileAvatar = document.querySelector('.ProfileAvatar')
    if (circleProfileAvatar) {
      circleProfileAvatar.style.borderColor = 'crimson'
    }
  }
}

// 맞차단 사용자 숨기기
function hideUser (user) {
  user.style.display = 'none'
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function changeButtonToBlocked (profile) {
  const actions = profile.querySelector('.user-actions')
  actions.classList.remove('not-following')
  actions.classList.add('blocked')
}

// 차단반사
function reflectBlock (user) {
  const actions = user.querySelector('.user-actions')
  const userId = actions.getAttribute('data-user-id')
  const userName = actions.getAttribute('data-screen-name')
  return sendBlockRequest(userId).then(response => {
    console.log('%s에게 차단반사!', userName, response)
    changeButtonToBlocked(user)
    indicateBlockToUser(user, BLOCK_REFLECTED)
  })
}

function userHandler (user) {
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
  optionP.then(option => {
    if (option.outlineBlockUser) {
      outlineToBlockedUser(user)
    }
    // 나를 차단한 사용자 숨기기
    const shouldHide = option.hideBlockedUser && user.matches('.js-actionable-user')
    if (shouldHide) {
      hideUser(user)
    }
    // 차단반사
    const shouldBlock = option.enableBlockReflection && !alreadyBlocked && !muted
    if (shouldBlock) {
      reflectBlock(user)
    }
  })
}

function applyToRendered () {
  const userList = document.querySelectorAll('.js-actionable-user')
  if (userList.length > 0) {
    userList.forEach(userHandler)
  }
  const profileNav = document.querySelector('.ProfileNav')
  if (profileNav) {
    userHandler(profileNav)
  }
}

function toggleNightMode (mode) {
  document.documentElement.classList.toggle('mob-nightmode', mode)
}

// language=CSS
// noinspection CssUnusedSymbol
injectCSS(`
  .mob-BlockStatus,
  .mob-BlockReflectedStatus {
    border-radius: 4px;
    font-size: 12px;
    font-weight: normal;
    margin-left: 2px;
    padding: 2px 4px;
  }
  .account .mob-BlockStatus,
  .account .mob-BlockReflectedStatus {
    margin: 0;
  }
  .mob-BlockStatus {
    background-color: #f9f2f4;
    color: #c7254e;
  }
  .mob-BlockReflectedStatus {
    background-color: #fcf8e3;
    color: #8a6d3b;
  }
  .ProfileCard.mob-blocks-you-outline {
    outline: 3px solid crimson;
  }
  .account.mob-blocks-you-outline {
    border: 3px solid crimson !important;
    margin: 1px 0;
  }
  .mob-nightmode .mob-BlockStatus {
    background-color: #141d26;
  }
  .mob-nightmode .mob-BlockReflectedStatus {
    background-color: #141d26;
    color: #fce8b3;
  }
`)

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!('querySelector' in node)) {
        continue
      }
      const isUser = node.matches('.js-actionable-user')
      if (isUser) {
        userHandler(node)
      }
      const profileNav = node.querySelector('.ProfileNav')
      if (profileNav) {
        userHandler(profileNav)
      }
    }
  }
})

const nightModeObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (!node.matches) {
        return
      }
      if (node.matches('link.coreCSSBundles')) {
        const nightMode = /nightmode/.test(node.href)
        toggleNightMode(nightMode)
      }
    }
  }
})

observer.observe(document.body, {
  childList: true,
  characterData: true,
  subtree: true
})

nightModeObserver.observe(document.head, {
  childList: true,
  subtree: true
})

toggleNightMode(/\bnight_mode=1\b/.test(document.cookie))

window.setInterval(() => {
  applyToRendered()
}, 1500)

applyToRendered()
