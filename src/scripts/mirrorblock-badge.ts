const enum BadgeType {
  BlocksYou = 'blocks-you',
  BlockReflected = 'block-reflected',
}

function blocksYouBadge(type: BadgeType, afterText = ''): HTMLElement {
  const badgeCss = browser.runtime.getURL('styles/mob-badge.css')
  const badge = document.createElement('span')
  badge.className = `mob-badge mob-badge-${type}`
  let badgeClasses = ''
  let badgeText = ''
  switch (type) {
    case BadgeType.BlocksYou:
      badgeClasses = 'badge blocks-you'
      badgeText = `나를 차단함 ${afterText}`.trim()
      break
    case BadgeType.BlockReflected:
      badgeClasses = 'badge block-reflected'
      badgeText = '차단반사 발동!'
      break
  }
  const shadowRoot = badge.attachShadow({ mode: 'closed' })
  shadowRoot.innerHTML = `\
<span class="${badgeClasses}">${badgeText}</span>
<link rel="stylesheet" href="${badgeCss}" />`
  return badge
}

function generateBlocksYouBadge(afterText = ''): HTMLElement {
  return blocksYouBadge(BadgeType.BlocksYou, afterText)
}
function generateBlockReflectedBadge(): HTMLElement {
  return blocksYouBadge(BadgeType.BlockReflected)
}
