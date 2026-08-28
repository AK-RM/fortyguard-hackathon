"use client";

export const TEXTAREA_MIN_HEIGHT_PX = 72;
export const TEXTAREA_MAX_HEIGHT_PX = 240;

export function computeTextareaHeight(
  scrollHeight: number,
  minHeight = TEXTAREA_MIN_HEIGHT_PX,
  maxHeight = TEXTAREA_MAX_HEIGHT_PX
): number {
  return Math.min(Math.max(scrollHeight, minHeight), maxHeight);
}

export function shouldTextareaScroll(
  scrollHeight: number,
  maxHeight = TEXTAREA_MAX_HEIGHT_PX
): boolean {
  return scrollHeight > maxHeight;
}
