"use client";

import { useEffect, useRef } from "react";

import {
  computeTextareaHeight,
  shouldTextareaScroll,
  TEXTAREA_MAX_HEIGHT_PX,
  TEXTAREA_MIN_HEIGHT_PX,
} from "@/lib/auto-resize-textarea";

type AutoResizeTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "rows"
> & {
  minHeight?: number;
  maxHeight?: number;
};

export function AutoResizeTextarea({
  minHeight = TEXTAREA_MIN_HEIGHT_PX,
  maxHeight = TEXTAREA_MAX_HEIGHT_PX,
  value,
  className = "",
  onChange,
  ...props
}: AutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textareaRef.current;

    if (!element) {
      return;
    }

    element.style.height = "auto";
    const nextHeight = computeTextareaHeight(element.scrollHeight, minHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = shouldTextareaScroll(element.scrollHeight, maxHeight)
      ? "auto"
      : "hidden";
  }, [value, minHeight, maxHeight]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      rows={1}
      className={`${className} resize-none overflow-x-hidden break-words`}
      style={{ minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` }}
    />
  );
}
