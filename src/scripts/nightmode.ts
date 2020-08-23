export function handleDarkMode() {
  const isDarkMode = /\bnight_mode=1\b/.test(document.cookie)
  function toggleNightMode(isDarkMode: boolean): void {
    document.documentElement.classList.toggle('mob-nightmode', isDarkMode)
  }

  document.documentElement.classList.add('mob-mobile')
  const colorThemeTag = document.querySelector('meta[name="theme-color"]')
  if (colorThemeTag) {
    const nightModeObserver = new MutationObserver(mutations => {
      if (mutations.length <= 0) {
        return
      }
      const target = mutations[0].target as HTMLMetaElement
      const themeColor = target.content.toUpperCase()
      const nightMode = themeColor !== '#FFFFFF'
      toggleNightMode(nightMode)
    })

    nightModeObserver.observe(colorThemeTag, {
      attributeFilter: ['content'],
      attributes: true,
    })
  }
  toggleNightMode(isDarkMode)
}
