{
  const isDarkMode = /\bnight_mode=1\b/.test(document.cookie)

  if (document.getElementById('react-root')) {
    const colorThemeClass = isDarkMode ? 'mob-mobile-dark' : 'mob-mobile-light'
    document.documentElement!.classList.add('mob-mobile', colorThemeClass)
    document.documentElement.classList.toggle('mob-nightmode', isDarkMode)
  } else {
    function toggleNightMode(mode: boolean): void {
      document.documentElement.classList.toggle('mob-nightmode', mode)
    }

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

    nightModeObserver.observe(document.head!, {
      childList: true,
      subtree: true,
    })

    toggleNightMode(isDarkMode)
  }
}
