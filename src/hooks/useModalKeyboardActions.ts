"use client";

import { useEffect } from "react";

type ModalKeyboardActions = {
  enabled: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelDisabled?: boolean;
  confirmDisabled?: boolean;
};

const shouldSkipEnter = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  if (target.closest("form")) return true;
  if (target.isContentEditable) return true;

  const tagName = target.tagName.toLowerCase();

  return ["textarea", "select", "button", "a"].includes(tagName);
};

export function useModalKeyboardActions({
  enabled,
  onCancel,
  onConfirm,
  cancelDisabled = false,
  confirmDisabled = false,
}: ModalKeyboardActions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;

      if (event.key === "Escape" && onCancel && !cancelDisabled) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (
        event.key === "Enter" &&
        onConfirm &&
        !confirmDisabled &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !shouldSkipEnter(event.target)
      ) {
        event.preventDefault();
        onConfirm();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    cancelDisabled,
    confirmDisabled,
    enabled,
    onCancel,
    onConfirm,
  ]);
}
