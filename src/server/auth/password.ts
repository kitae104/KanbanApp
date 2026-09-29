import "server-only";

import { hash, verify, type Algorithm } from "@node-rs/argon2";

// Algorithm은 const enum이라 isolatedModules에서 값으로 쓸 수 없다. 2 = Algorithm.Argon2id.
const ARGON2ID = 2 as Algorithm;

// OWASP 권장 argon2id 파라미터: m=19 MiB, t=2, p=1 (plan §2).
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * 없는 이메일로 로그인할 때도 실제 검증과 비슷한 시간을 쓴다.
 * 응답 시간으로 계정 존재 여부를 알 수 없게 한다 (NFR-3). 결과는 항상 false다.
 */
export async function verifyDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummyHash, plain);
  return false;
}
