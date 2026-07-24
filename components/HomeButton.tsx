'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

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
  const baseClasses = "flex items-center gap-2 text-gray-400 hover:text-white transition-all duration-200 p-2 rounded-lg hover:bg-white/5 active:scale-95";

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
