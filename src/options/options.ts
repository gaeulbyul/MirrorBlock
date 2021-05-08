import * as Options from '미러블락/extoption'
import * as i18n from '미러블락/scripts/i18n'

const elements: { [key in keyof MirrorBlockOption]: HTMLInputElement } = {
  outlineBlockUser: document.getElementById('outlineBlockUser') as HTMLInputElement,
  enableBlockReflection: document.getElementById('enableBlockReflection') as HTMLInputElement,
  blockMutedUser: document.getElementById('blockMutedUser') as HTMLInputElement,
  alwaysImmediatelyBlockMode: document.getElementById(
    'alwaysImmediatelyBlockMode'
  ) as HTMLInputElement,
}

async function saveOption() {
  const option = await Options.load()
  for (const [key_, elem] of Object.entries(elements)) {
    const key = key_ as keyof MirrorBlockOption
    option[key] = elem.checked
  }
  return Options.save(option)
}

async function loadOption() {
  const option = await Options.load()
  for (const [key_, elem] of Object.entries(elements)) {
    const key = key_ as keyof MirrorBlockOption
    elem.disabled = false
    elem.checked = option[key]
  }
}

function displayVersion() {
  const elem = document.getElementById('version')!
  const manifest = browser.runtime.getManifest()
  elem.textContent = manifest.version
}

function init() {
  i18n.applyI18nOnHtml()
  loadOption()
  for (const input of document.querySelectorAll('.field input')) {
    input.addEventListener('change', () => {
      saveOption()
    })
  }
  displayVersion()
}

document.addEventListener('DOMContentLoaded', init)
