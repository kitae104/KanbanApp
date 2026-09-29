"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import type { z } from "zod";
import { BUTTON_BASE, FOCUS_RING } from "@/components/board/styles";
import type { AuthFormState } from "@/app/(auth)/actions";
import { toFieldErrors, type AuthField as FieldName, type FieldErrors } from "@/lib/auth/schema";
import { AuthField } from "./AuthField";

export interface FieldSpec {
  name: FieldName;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  hint?: string;
}

interface AuthFormProps {
  title: string;
  submitLabel: string;
  fields: FieldSpec[];
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  /** 서버에 보내기 전에 브라우저에서 먼저 검사할 스키마. */
  schema: z.ZodType;
  footer: { text: string; href: string; link: string };
}

/** 로그인·가입 공용 폼. Server Action으로 제출하고, 실패하면 첫 오류로 포커스를 옮긴다. */
export function AuthForm({ title, submitLabel, fields, action, schema, footer }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const inputs = useRef(new Map<FieldName, HTMLInputElement>());

  const errors = clientErrors ?? state.fieldErrors ?? {};

  const focusFirstError = (fieldErrors: FieldErrors) => {
    const first = fields.find((field) => fieldErrors[field.name]);
    if (first) inputs.current.get(first.name)?.focus();
  };

  // 서버 응답이 오면 첫 오류 필드(없으면 폼 오류)로 포커스를 옮긴다.
  useEffect(() => {
    if (state.fieldErrors) focusFirstError(state.fieldErrors);
    else if (state.formError) inputs.current.get(fields[0].name)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state가 바뀔 때만 실행한다.
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const result = schema.safeParse(values);
    if (!result.success) {
      event.preventDefault();
      const fieldErrors = toFieldErrors(result.error);
      setClientErrors(fieldErrors);
      focusFirstError(fieldErrors);
      return;
    }
    setClientErrors(null);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-sm ring-1 ring-line">
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        <form
          action={formAction}
          onSubmit={handleSubmit}
          noValidate
          aria-busy={pending}
          className="mt-6 flex flex-col gap-4"
        >
          {fields.map((field) => (
            <AuthField
              key={field.name}
              {...field}
              error={errors[field.name]}
              defaultValue={field.type === "email" ? state.email : undefined}
              inputRef={(element) => {
                if (element) inputs.current.set(field.name, element);
                else inputs.current.delete(field.name);
              }}
            />
          ))}

          <p role="alert" className="min-h-5 text-sm text-danger">
            {clientErrors ? "" : (state.formError ?? "")}
          </p>

          <button
            type="submit"
            aria-disabled={pending}
            disabled={pending}
            className={`${BUTTON_BASE} bg-primary py-2 text-white hover:bg-primary-strong`}
          >
            {pending ? "처리 중…" : submitLabel}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className={`font-medium text-primary underline-offset-2 hover:underline ${FOCUS_RING}`}
          >
            {footer.link}
          </Link>
        </p>
      </div>
    </main>
  );
}
