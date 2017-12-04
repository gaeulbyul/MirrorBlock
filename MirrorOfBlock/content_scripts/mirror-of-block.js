/* globals browser, fetch, location, URLSearchParams, MutationObserver  */

const optionP = (function () {
  const defaultOption = {
    outlineBlockUser: false,
    enableBlockReflection: false
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

function getScreenName (profile) {
  if (profile.classList.contains('ProfileCard')) {
    return profile.querySelector('.ProfileCard-screenname')
  } else if (profile.classList.contains('ProfileNav')) {
    return document.querySelector('.ProfileHeaderCard-screenname')
  } else {
    return null
  }
}

// 나를 차단한 사용자의 프로필에 "나를 차단함" 딱지 붙이기
function indicateBlockToUserName (profile) {
  if (profile.querySelector('.mob-BlockStatus')) {
    return
  }
  const username = getScreenName(profile)
  if (username) {
    username.innerHTML += '<span class="mob-BlockStatus">Blocks you</span>'
  }
}

// 뮤트/차단목록에서 "나를 차단함" 딱지 붙이기.
function indicateBlockToUserItem (item) {
  if (item.querySelector('.mob-BlockStatus')) {
    return
  }
  const content = item.querySelector('.content')
  if (content) {
    content.innerHTML += '<span class="mob-BlockStatus">Blocks you</span>'
  }
}

// 차단반사를 적용한 사용자의 프로필에 "차단 반사함" 딱지 붙이기
function indicateBlockReflectedToUserName (profile) {
  if (profile.querySelector('.mob-BlockReflectedStatus')) {
    return
  }
  const username = getScreenName(profile)
  if (username) {
    username.innerHTML += '<span class="mob-BlockReflectedStatus">Block Reflected!</span>'
  }
}

// 내가 차단한 사용자의 프로필에 "차단됨" 표시
function markBlockedToProfile (profile) {
  const actions = profile.querySelector('.user-actions')
  actions.classList.remove('not-following')
  actions.classList.add('blocked')
}

// 차단반사
function reflectBlock (profile) {
  const actions = profile.querySelector('.user-actions')
  const userId = actions.getAttribute('data-user-id')
  const userName = actions.getAttribute('data-screen-name')
  return sendBlockRequest(userId).then(response => {
    console.log('%s에게 차단반사!', userName, response)
    markBlockedToProfile(profile)
    indicateBlockReflectedToUserName(profile)
  })
}

function userHandler (user) {
  const blocksYou = !!user.querySelector('.blocks-you')
  const alreadyBlocked = !!user.querySelector('.blocked')
  if (blocksYou) {
    const alreadyChecked = user.classList.contains('mob-checked')
    if (alreadyChecked) {
      return
    }
    user.classList.add('mob-checked')
  } else {
    return
  }
  if (user.classList.contains('ProfileCard')) {
    indicateBlockToUserName(user)
    optionP.then(option => {
      if (option.outlineBlockUser) {
        user.classList.add('mob-blocks-you-outline')
      }
    })
  } else if (user.classList.contains('ProfileNav')) {
    indicateBlockToUserName(user)
    optionP.then(option => {
      if (option.outlineBlockUser) {
        const circleProfileAvatar = document.querySelector('.ProfileAvatar')
        if (circleProfileAvatar) {
          circleProfileAvatar.style.borderColor = 'crimson'
        }
      }
    })
  } else if (user.matches('.blocked-setting.account, .muted-setting.account')) {
    indicateBlockToUserItem(user)
    optionP.then(option => {
      if (option.outlineBlockUser) {
        user.classList.add('mob-blocks-you-outline')
      }
    })
  }
  // Block Reflection
  const muted = !!user.querySelector('.muting')
  if (!alreadyBlocked && !muted) {
    optionP.then(option => {
      if (option.enableBlockReflection) {
        reflectBlock(user)
      }
    })
  }
}

function applyToRendered () {
  const profileCards = document.querySelectorAll('.ProfileCard')
  for (const profileCard of profileCards) {
    userHandler(profileCard)
  }
  const profileNav = document.querySelector('.ProfileNav')
  if (profileNav) {
    userHandler(profileNav)
  }
  const userList = document.querySelectorAll('.blocked-setting.account, .muted-setting.account')
  if (userList.length > 0) {
    userList.forEach(userHandler)
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
  .blocked-setting .mob-BlockStatus,
  .muted-setting .mob-BlockStatus {
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
  .blocked-setting.mob-blocks-you-outline,
  .muted-setting.mob-blocks-you-outline {
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
  mutations.forEach(mutation => {
    for (const node of mutation.addedNodes) {
      if (!('querySelector' in node)) {
        continue
      }
      if (node.classList.contains('ProfileCard')) {
        userHandler(node)
      }
      const profileNav = node.querySelector('.ProfileNav')
      if (profileNav) {
        userHandler(profileNav)
      }
      const isUserItem = node.matches('.blocked-setting.account, .muted-setting.account')
      if (isUserItem) {
        userHandler(node)
      }
    }
  })
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
