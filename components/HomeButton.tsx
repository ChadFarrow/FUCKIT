'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';
import { BACK_ROW_BUTTON_CLASSES } from './BackButton';

interface HomeButtonProps {
  label?: string;
  className?: string;
}

/**
 * Jump straight to the home page from anywhere.
 *
 * Sits next to BackButton: Back walks one step up the history stack, Home
 * escapes it entirely no matter how deep the user has clicked. Styling
 * deliberately mirrors BackButton so the pair reads as one control group.
 */
export default function HomeButton({
  label = 'Home',
  className = ''
}: HomeButtonProps) {
  const baseClasses = BACK_ROW_BUTTON_CLASSES;

  return (
    <Link
      href="/"
      className={`${baseClasses} ${className}`}
      aria-label="Go to home page"
    >
      <Home className="h-5 w-5" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}
