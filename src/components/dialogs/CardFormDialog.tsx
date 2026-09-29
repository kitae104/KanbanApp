"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { BUTTON_BASE } from "@/components/board/styles";
import { useModalDialog } from "@/hooks/useModalDialog";
import { cardInputSchema, type CardInput } from "@/lib/board/schema";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/board/types";

interface CardFormDialogProps {
  mode: "create" | "edit";
  initial?: CardInput;
  onSubmit: (input: CardInput) => void;
  onClose: () => void;
}

type FieldErrors = Partial<Record<keyof CardInput, string>>;

const FIELD_CLASS =
  "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus-visible:outline-2 focus-visible:outline-primary aria-invalid:border-danger";

export function CardFormDialog({ mode, initial, onSubmit, onClose }: CardFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const id = useId();
  useModalDialog(dialogRef, onClose);

  const heading = mode === "create" ? "카드 추가" : "카드 수정";
  const ids = {
    heading: `${id}-heading`,
    title: `${id}-title`,
    titleError: `${id}-title-error`,
    titleCount: `${id}-title-count`,
    description: `${id}-description`,
    descriptionError: `${id}-description-error`,
    descriptionCount: `${id}-description-count`,
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = cardInputSchema.safeParse({ title, description });
    if (!result.success) {
      const fieldErrors = z.flattenError(result.error).fieldErrors;
      setErrors({ title: fieldErrors.title?.[0], description: fieldErrors.description?.[0] });
      if (fieldErrors.title) titleRef.current?.focus();
      return;
    }
    onSubmit(result.data);
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ids.heading}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <h2 id={ids.heading} className="text-lg font-bold">
          {heading}
        </h2>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.title} className="text-sm font-medium">
              제목 <span className="text-danger">(필수)</span>
            </label>
            <span id={ids.titleCount} className="text-xs text-muted">
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          <input
            ref={titleRef}
            id={ids.title}
            name="title"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(event) => setTitle(event.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={errors.title ? `${ids.titleError} ${ids.titleCount}` : ids.titleCount}
            className={FIELD_CLASS}
          />
          {errors.title && (
            <p id={ids.titleError} className="mt-1 text-sm text-danger">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor={ids.description} className="text-sm font-medium">
              설명 <span className="text-muted">(선택)</span>
            </label>
            <span id={ids.descriptionCount} className="text-xs text-muted">
              {description.length}/{DESCRIPTION_MAX}
            </span>
          </div>
          <textarea
            id={ids.description}
            name="description"
            value={description}
            rows={5}
            maxLength={DESCRIPTION_MAX}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={
              errors.description
                ? `${ids.descriptionError} ${ids.descriptionCount}`
                : ids.descriptionCount
            }
            className={`${FIELD_CLASS} resize-y`}
          />
          {errors.description && (
            <p id={ids.descriptionError} className="mt-1 text-sm text-danger">
              {errors.description}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className={`${BUTTON_BASE} text-muted hover:bg-column hover:text-ink`}
          >
            취소
          </button>
          <button
            type="submit"
            className={`${BUTTON_BASE} bg-primary text-white hover:bg-primary-strong`}
          >
            {mode === "create" ? "추가" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
