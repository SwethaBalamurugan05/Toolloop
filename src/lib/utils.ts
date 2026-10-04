import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Standard shadcn utility for safely joining Tailwind class names. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}