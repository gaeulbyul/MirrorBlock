/* globals browser, ExtOption */

const defaultOption = {
  outlineBlockUser: false,
  enableBlockReflection: false
}

const elements = {
  outlineBlockUser: document.getElementById('outlineBlockUser'),
  enableBlockReflection: document.getElementById('enableBlockReflection')
}

function saveOption () {
  const option = Object.assign({}, defaultOption)
  for (const key of Object.keys(elements)) {
    option[key] = elements[key].checked
  }
  return ExtOption.save(option)
}

async function loadOption () {
  const option = await ExtOption.load()
  for (const key of Object.keys(elements)) {
    elements[key].checked = option[key]
  }
}

function displayVersion () {
  const elem = document.getElementById('version')
  const manifest = browser.runtime.getManifest()
  elem.textContent = `v${manifest.version}`
}

function init () {
  loadOption()
  for (const input of document.querySelectorAll('.field input')) {
    input.addEventListener('change', event => {
      saveOption()
    })
  }
  displayVersion()
}

document.addEventListener('DOMContentLoaded', init)
