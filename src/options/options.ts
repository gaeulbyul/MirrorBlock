import * as Options from '../extoption'

const elements: { [key in keyof MirrorBlockOption]: HTMLInputElement } = {
  outlineBlockUser: document.getElementById(
    'outlineBlockUser'
  ) as HTMLInputElement,
  enableBlockReflection: document.getElementById(
    'enableBlockReflection'
  ) as HTMLInputElement,
  blockMutedUser: document.getElementById('blockMutedUser') as HTMLInputElement,
  alwaysImmediatelyBlockMode: document.getElementById(
    'alwaysImmediatelyBlockMode'
  ) as HTMLInputElement,
}

async function saveOption() {
  const option = await Options.load()
  for (const key_ of Object.keys(elements)) {
    const key = key_ as keyof MirrorBlockOption
    option[key] = elements[key].checked
  }
  return Options.save(option)
}

async function loadOption() {
  const option = await Options.load()
  for (const key_ of Object.keys(elements)) {
    const key = key_ as keyof MirrorBlockOption
    elements[key].disabled = false
    elements[key].checked = option[key]
  }
}

function displayVersion() {
  const elem = document.getElementById('version')!
  const manifest = browser.runtime.getManifest()
  elem.textContent = manifest.version
}

function init() {
  loadOption()
  for (const input of document.querySelectorAll('.field input')) {
    input.addEventListener('change', () => {
      saveOption()
    })
  }
  displayVersion()
}

document.addEventListener('DOMContentLoaded', init)
