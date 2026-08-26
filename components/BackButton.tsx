'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  href?: string;
  label?: string;
  className?: string;
  onClick?: () => void;
  useHistory?: boolean; // Use browser back() instead of href
}

/**
 * Shared styling for the Back/Home control group.
 *
 * Single-sourced because three places render a button in this row — BackButton,
 * HomeButton, and the playlist page's own "Back to Playlists" link, which points at a
 * named destination rather than a history step and so can't reuse BackButton itself.
 * Copies of this string drift; the pair is supposed to read as one control group.
 *
 * `min-h-[44px]` is the touch-target floor. Padding alone gave 36px (`p-2` = 8px each
 * side around a 20px icon), under the 44px minimum. It is an arbitrary px value on
 * purpose: Tailwind's `p-*`/`h-*` are rem, so an OS font-size setting would scale the
 * target itself — only the label should scale.
 */
export const BACK_ROW_BUTTON_CLASSES =
  "flex items-center gap-2 text-gray-400 hover:text-white transition-all duration-200 p-2 min-h-[44px] rounded-lg hover:bg-white/5 active:scale-95";

export default function BackButton({
  href = '/',
  label = 'Back',
  className = '',
  onClick,
  useHistory = true // Default to using browser history
}: BackButtonProps) {
  const router = useRouter();
  const baseClasses = BACK_ROW_BUTTON_CLASSES;
  const combinedClasses = `${baseClasses} ${className}`;

  const handleBack = () => {
    // history.length > 1 means there's a page to go back to
    // (works correctly with SPA navigation unlike document.referrer)
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  };

  // Custom onClick handler takes priority
  if (onClick) {
    return (
      <button
        aria-label="Go back"
        onClick={onClick}
        className={combinedClasses}
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm font-medium">{label}</span>
      </button>
    );
  }

  // Use browser history by default, but go to home for external entries
  if (useHistory) {
    return (
      <button
        aria-label="Go back"
        onClick={handleBack}
        className={combinedClasses}
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm font-medium">{label}</span>
      </button>
    );
  }

  // Fallback to Link with specific href
  return (
    <Link
      href={href}
      className={combinedClasses}
    >
      <ArrowLeft className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}