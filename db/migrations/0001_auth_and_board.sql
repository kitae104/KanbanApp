-- 이메일/패스워드 계정, 세션, 유저당 보드 1개, 카드 (docs/db-integration/plan.md §4.1)

CREATE TABLE users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text NOT NULL UNIQUE
                    CHECK (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254),
  password_hash     text NOT NULL,
  email_verified_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- id는 세션 토큰의 sha256 hex다. 토큰 원문은 저장하지 않는다.
CREATE TABLE sessions (
  id         text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{64}$'),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expires_at_idx ON sessions(expires_at);

-- user_id UNIQUE: 유저당 보드는 1개다.
CREATE TABLE boards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 컬럼 안 순서는 position(0-based)이다. 도메인에서는 order라고 부른다.
-- UNIQUE는 커밋 시점에 검사해 트랜잭션 중간에 순서를 밀고 당길 수 있게 한다.
CREATE TABLE cards (
  id          uuid PRIMARY KEY,
  board_id    uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  status      text NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
  position    integer NOT NULL CHECK (position >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cards_board_status_position_key
    UNIQUE (board_id, status, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email        text NOT NULL,
  ip           text NOT NULL,
  succeeded    boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_attempts_email_idx ON login_attempts(email, attempted_at) WHERE NOT succeeded;
CREATE INDEX login_attempts_ip_idx ON login_attempts(ip, attempted_at) WHERE NOT succeeded;
