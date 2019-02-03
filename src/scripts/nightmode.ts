{
  const isDarkMode = /\bnight_mode=1\b/.test(document.cookie)
  function toggleNightMode(isDarkMode: boolean): void {
    document.documentElement.classList.toggle('mob-nightmode', isDarkMode)
  }

  if (document.getElementById('react-root')) {
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
  } else {
    const nightModeObserver = new MutationObserver(mutations => {
      for (const elem of getAddedElementsFromMutations(mutations)) {
        if (elem.matches('link.coreCSSBundles')) {
          const css = elem as HTMLLinkElement
          const nightMode = /nightmode/.test(css.href)
          toggleNightMode(nightMode)
        }
      }
    })

    nightModeObserver.observe(document.head, {
      childList: true,
      subtree: true,
    })
  }

  toggleNightMode(isDarkMode)
}
