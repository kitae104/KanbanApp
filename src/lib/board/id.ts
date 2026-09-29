/**
 * 카드 id를 만든다. crypto.randomUUID는 보안 컨텍스트(HTTPS, localhost)에서만 있으므로
 * 사내망 IP처럼 http로 열었을 때는 getRandomValues로 같은 형식을 만든다.
 */
export function newCardId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
