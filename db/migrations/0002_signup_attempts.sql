-- 가입 시도 제한용 기록. IP마다 최근 시도 횟수만 센다 (회원가입 남용 방지).
CREATE TABLE signup_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip           text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX signup_attempts_ip_idx ON signup_attempts(ip, attempted_at);
