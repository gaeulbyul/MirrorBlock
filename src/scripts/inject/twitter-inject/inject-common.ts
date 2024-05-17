function isReactPropsKey(name: string) {
  return name.startsWith('__reactProps')
}

export function getReactEventHandler(target: Element): any {
  const key = Object.keys(target).find(isReactPropsKey)
  return key ? (target as any)[key] : null
}
