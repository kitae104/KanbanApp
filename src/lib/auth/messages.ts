/** 인증 화면 문구. 서버 액션과 테스트가 같이 쓴다. */
export const AUTH_MESSAGES = {
  /** 이메일이 없든 패스워드가 틀리든 같은 문구를 쓴다 (FR-6). */
  loginFailed: "이메일 또는 패스워드가 올바르지 않습니다.",
  tooManyAttempts: "로그인 시도가 너무 많습니다. 15분 뒤 다시 시도하세요.",
  emailTaken: "이미 가입된 이메일입니다.",
  sessionExpired: "로그인이 만료되었습니다. 다시 로그인하세요.",
} as const;
