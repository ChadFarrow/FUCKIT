'use client';

import React, { ReactNode } from 'react';

interface SettingsLayoutProps {
  children: ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pb-32">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-safe-plus">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
          <p className="text-gray-400">Manage your preferences and account settings</p>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 sm:p-6 border border-gray-700/50">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white mb-1">{title}</h2>
        {description && (
          <p className="text-sm text-gray-400">{description}</p>
        )}
      </div>
      {/* Wider on a phone than at sm+, because rows stack there: the space
          BETWEEN two rows has to beat the gap inside one (gap-y-3), or a
          control reads as belonging to the label underneath it. */}
      <div className="space-y-6 sm:space-y-4">
        {children}
      </div>
    </div>
  );
}

interface SettingsRowProps {
  label: string | ReactNode;
  // ReactNode, not string: `DangerSettings` puts a live favorites count inside
  // its description, and a row that has to hand-roll this layout to say one
  // coloured word is a row that drifts away from the fix below.
  description?: ReactNode;
  children: ReactNode;
}

/**
 * Label on the left, control on the right — until they cannot both fit.
 *
 * The control is `flex-shrink-0` — a segmented control or an input must not be
 * squashed — so on a phone a WIDE control took the width it needed and the
 * label column absorbed the whole loss. Measured on the reported screen at a
 * 393px viewport: "Favorites on Nostr" with its three options left the
 * description **61px, wrapping to 19 lines**, one word per line down the side
 * of an otherwise empty row, with the options themselves hanging past the
 * right edge of the screen.
 *
 * `flex-wrap` plus a `basis-56` floor on the label fixes that without
 * restyling the rows that already fit: the label never drops below 14rem, so a
 * control that cannot fit beside it wraps to its own line and left-aligns
 * under the description instead of squeezing it. A toggle still sits on the
 * right at 360px and wider — only a genuinely wide control moves, and below
 * 360px (Android Display size turned up) every row stacks.
 *
 * `lib/settings-row-layout.browser-probe.mjs` measures both halves of that
 * across six viewports; it fails against the shape this replaced.
 */
export function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      {/* grow/shrink/basis rather than `flex-1 basis-56` — the shorthand also
          sets flex-basis, so which one wins would depend on Tailwind's emission
          order rather than on anything written here. */}
      <div className="min-w-0 grow shrink basis-56">
        <div className="text-sm font-medium text-white">{label}</div>
        {description && (
          <div className="text-xs text-gray-400 mt-1">{description}</div>
        )}
      </div>
      {/* max-w-full clamps a shrink-0 child so a control wider than the line
          wraps inside itself instead of overflowing the section. */}
      <div className="flex-shrink-0 max-w-full">
        {children}
      </div>
    </div>
  );
}
