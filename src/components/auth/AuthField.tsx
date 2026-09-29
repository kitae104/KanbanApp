"use client";

import { useId, useState, type Ref } from "react";
import { FOCUS_RING } from "@/components/board/styles";

const FIELD_CLASS =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-primary aria-invalid:border-danger";

interface AuthFieldProps {
  label: string;
  name: string;
  type?: "email" | "password";
  autoComplete: string;
  error?: string;
  hint?: string;
  defaultValue?: string;
  inputRef?: Ref<HTMLInputElement>;
}

/** 레이블, 오류, 도움말을 aria로 연결한 입력란 (NFR-12). 패스워드면 표시/숨김 토글을 붙인다 (NFR-14). */
export function AuthField({
  label,
  name,
  type = "email",
  autoComplete,
  error,
  hint,
  defaultValue,
  inputRef,
}: AuthFieldProps) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error && errorId, hint && hintId].filter(Boolean).join(" ") || undefined;
  const isPassword = type === "password";

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${FIELD_CLASS} ${isPassword ? "pr-20" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-controls={id}
            aria-label={visible ? "패스워드 숨기기" : "패스워드 보기"}
            className={`absolute inset-y-1 right-1 rounded px-2 text-xs font-medium text-muted hover:bg-column hover:text-ink ${FOCUS_RING}`}
          >
            {visible ? "숨기기" : "보기"}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
