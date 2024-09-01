/*
interface APIResponse {
  ok: boolean
  status: number
  statusText: string
  headers: { [name: string]: string }
  body: object
}
*/

declare function cloneInto<T>(detail: T, view: Window | null): T
