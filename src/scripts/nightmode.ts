function isDark(colorThemeElem: HTMLMetaElement) {
  return colorThemeElem.content.toUpperCase() !== '#FFFFFF'
}

function toggleNightMode(dark: boolean): void {
  document.documentElement.classList.toggle('mob-nightmode', dark)
}

export function handleDarkMode() {
  // TODO: mob-mobile 은 이제 필요없음
  // 단, 지울 때 chainblock.css 를 수정해야 함
  document.documentElement.classList.add('mob-mobile')

  const colorThemeTag = document.querySelector('meta[name=theme-color]')
  if (colorThemeTag instanceof HTMLMetaElement) {
    const nightModeObserver = new MutationObserver(() => {
      toggleNightMode(isDark(colorThemeTag))
    })

    nightModeObserver.observe(colorThemeTag, {
      attributeFilter: ['content'],
      attributes: true,
    })

    toggleNightMode(isDark(colorThemeTag))
  }
}
