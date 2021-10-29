const fs = require('fs')

function generateI18NInterface(name, translates) {
  function generateMethod([key, value]) {
    let method = ''
    const placeholders = value?.placeholders ?? {}
    if (/^[a-z_][a-z0-9_]*$/i.test(key)) {
      method += `  ${key}`
    } else {
      method += `  '${key}'`
    }
    method += '('
    const params = Object.keys(placeholders).map(pkey => `${pkey}: string`)
    method += params.join(', ')
    method += '): string'
    return method
  }
  let interface = '// automatically generated\n'
  interface += `declare interface ${name}`
  interface += ' {\n'
  interface += Object.entries(translates).map(generateMethod).join('\n')
  interface += '\n}\n'
  return interface
}

let ko = fs.readFileSync(process.stdin.fd, 'utf8')
ko = JSON.parse(ko)

const result = generateI18NInterface('MirrorBlockI18NTranslates', ko)
fs.writeFileSync(process.stdout.fd, result, 'utf8')
// console.log(result)
