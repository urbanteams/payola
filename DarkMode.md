# Dark Mode Implementation Guide

> This file documents the dark mode feature that was implemented and then reverted.
> It is kept as reference in case dark mode is re-implemented in the future.

## Overview

Dark mode was implemented using Tailwind CSS class-based dark mode with a React context for state management and localStorage for persistence.

## Architecture

### How It Worked

1. User clicks `DarkModeToggle` floating button (bottom-right corner)
2. `toggleDarkMode()` updates state in `DarkModeContext`
3. `useEffect` adds/removes `'dark'` class on `document.documentElement` (`<html>`)
4. `useEffect` persists preference to `localStorage('darkMode')`
5. On page load, context reads localStorage and reapplies the class
6. Tailwind applies all `dark:` prefixed utility classes when `dark` class exists on `<html>`

### Key Configuration

**tailwind.config.ts** — Must include `darkMode: 'class'` at the top level:
```ts
export default {
  darkMode: 'class',
  content: [...],
  // ...
} satisfies Config;
```

Without this, none of the `dark:` utility classes will have any effect.

## Files That Were Created

### 1. `lib/contexts/dark-mode-context.tsx`

React context providing dark mode state management:

```tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  isLoaded: boolean;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load dark mode preference from localStorage on mount (client-side only)
  useEffect(() => {
    const stored = localStorage.getItem('darkMode');
    if (stored !== null) {
      setIsDarkMode(stored === 'true');
    }
    setIsLoaded(true);
  }, []);

  // Update document class and localStorage when dark mode changes
  useEffect(() => {
    if (!isLoaded) return;

    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode, isLoaded]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode, isLoaded }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
}
```

### 2. `components/ui/DarkModeToggle.tsx`

Floating toggle button with sun/moon icons:

```tsx
"use client";

import { useDarkMode } from '@/lib/contexts/dark-mode-context';

export function DarkModeToggle() {
  const { isDarkMode, toggleDarkMode, isLoaded } = useDarkMode();

  if (!isLoaded) return null;

  return (
    <button
      onClick={toggleDarkMode}
      className="fixed bottom-4 right-4 z-50 p-3 rounded-full bg-gray-200 dark:bg-gray-700
                 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shadow-lg
                 border-2 border-gray-300 dark:border-gray-600"
      aria-label="Toggle dark mode"
      title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? (
        {/* Sun icon - shown in dark mode to switch to light */}
        <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        {/* Moon icon - shown in light mode to switch to dark */}
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
```

## Files That Were Modified

### 3. `app/layout.tsx`

Added dark mode provider wrapping children and the toggle component:

```tsx
import { DarkModeProvider } from "@/lib/contexts/dark-mode-context";
import { DarkModeToggle } from "@/components/ui/DarkModeToggle";

// In the html tag:
<html lang="en" suppressHydrationWarning>

// Wrapped body children:
<DarkModeProvider>
  {children}
  <DarkModeToggle />
</DarkModeProvider>
```

### 4. `app/globals.css`

Added CSS custom properties for dark mode:

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

body {
  color: var(--foreground);
  background: var(--background);
}
```

### 5. `components/ui/Card.tsx`

```
Card div:      bg-white dark:bg-gray-800
CardHeader:    border-gray-200 dark:border-gray-700
```

### 6. `components/ui/Button.tsx`

Secondary variant updated:
```
bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600
```

### 7. `app/page.tsx`

All major elements received dark variants. Key patterns:
- Background gradient: `dark:from-gray-900 dark:to-gray-800`
- Headings: `dark:text-gray-100`
- Subtext: `dark:text-gray-400`
- Inputs: `dark:border-gray-600 dark:text-gray-100 dark:bg-gray-700`
- Error messages: `dark:bg-red-900 dark:border-red-700 dark:text-red-200`
- Info boxes: `dark:bg-purple-900 dark:border-purple-700 dark:text-purple-200`

### 8-17. Game Components

The following game components all received `dark:` class variants:

| Component | Key Dark Classes |
|-----------|-----------------|
| `GameBoard.tsx` | Backgrounds, text, cards, info boxes, song implications section |
| `BiddingPanel.tsx` | Headers, labels, inputs, currency display |
| `PlayerList.tsx` | Header, player rows, labels, round info |
| `ResultsDisplay.tsx` | Headers, winner section, totals, bid details |
| `TokenPlacementPhase.tsx` | Turn indicator, headers, status text, borders |
| `SpinningWheel.tsx` | Title, status messages, winner text |
| `InitialMapView.tsx` | Background gradient, headers, description text |
| `RoundTransitionMapView.tsx` | Background gradient, headers, description text |
| `PromisePhaseSummary.tsx` | Headers, song totals, individual bids |
| `TokenPlacementInterface.tsx` | Turn indicator, token selector, status text |

## Color Scheme Reference

### Light Mode (Default)
- Backgrounds: `bg-white`, `bg-*-50`, `bg-gray-200`
- Text: `text-gray-800`, `text-gray-600`
- Borders: `border-gray-200`, `border-gray-300`

### Dark Mode
- Backgrounds: `dark:bg-gray-800`, `dark:bg-gray-700`, `dark:bg-gray-900`
- Text: `dark:text-gray-100`, `dark:text-gray-300`, `dark:text-gray-400`
- Borders: `dark:border-gray-700`, `dark:border-gray-600`

## Re-implementation Checklist

To re-enable dark mode:

1. Add `darkMode: 'class'` to `tailwind.config.ts`
2. Recreate `lib/contexts/dark-mode-context.tsx` (code above)
3. Recreate `components/ui/DarkModeToggle.tsx` (code above)
4. Wrap layout children with `<DarkModeProvider>` and add `<DarkModeToggle />`
5. Add `suppressHydrationWarning` to `<html>` tag
6. Add `.dark` CSS variables to `globals.css`
7. Add `dark:` utility classes to all components listed above
