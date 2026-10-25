export function decodeBase64Bytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.codePointAt(0) ?? 0);
}
