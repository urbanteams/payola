/**
 * HexIcon Component
 *
 * Abstract icon rendering layer for hex tiles
 * Uses Unicode emoji for initial implementation
 * Designed for easy upgrade to SVG icons later
 *
 * ARCHITECTURE NOTE: This component isolates icon implementation from game logic
 * To upgrade to SVG: Only this file needs to change, no other code affected
 */

import React from 'react';
import { HexType } from '@/lib/game/map-generator';

interface HexIconProps {
  type: HexType | HexType[]; // Support both single type and multiple types
  className?: string;
  size?: 'normal' | 'small';
}

/**
 * Icon mapping for hex types using Unicode emoji
 * FUTURE: Replace this object with SVG component imports
 */
const ICON_MAP: Record<HexType, string> = {
  households: '🏠',
  bluesStar: '🎺',
  countryStar: '🤠',
  jazzStar: '🎷',
  rockStar: '🎸',
  popStar: '🎤',
  classicalStar: '🎹',
  powerHub: '⚡',
  moneyHub: '💵',
};

/**
 * Get accessible label for screen readers
 */
const LABEL_MAP: Record<HexType, string> = {
  households: 'Households',
  bluesStar: 'Blues Star',
  countryStar: 'Country Star',
  jazzStar: 'Jazz Star',
  rockStar: 'Rock Star',
  popStar: 'Pop Star',
  classicalStar: 'Classical Star',
  powerHub: 'Power Hub',
  moneyHub: 'Money Hub',
};

/**
 * HexIcon component
 *
 * Renders icon(s) for a hex type or multiple hex types
 * Currently uses Unicode emoji, designed for easy SVG upgrade
 */
export function HexIcon({ type, className = '', size = 'normal' }: HexIconProps) {
  const fontSize = size === 'small' ? '1rem' : '1.5rem';

  // Support both single type and array of types
  const types = Array.isArray(type) ? type : [type];

  // Get icons and labels for all types
  const icons = types.map(t => ICON_MAP[t]).join(' ');
  const labels = types.map(t => LABEL_MAP[t]).join(' and ');

  return (
    <span
      className={`hex-icon ${className}`}
      role="img"
      aria-label={labels}
      style={{
        fontSize,
        display: 'inline-block',
        lineHeight: 1,
      }}
    >
      {icons}
    </span>
  );
}

/**
 * FUTURE UPGRADE PATH:
 *
 * To upgrade to SVG icons, replace ICON_MAP with SVG component map:
 *
 * const ICON_MAP: Record<HexType, React.ComponentType> = {
 *   house: HouseSVG,
 *   trumpet: TrumpetSVG,
 *   cowboy: CowboySVG,
 *   // ...
 * };
 *
 * Then update the component to render:
 * const IconComponent = ICON_MAP[type];
 * return <IconComponent className={`hex-icon ${className}`} aria-label={label} />;
 *
 * No other files need to change - all game logic references HexIcon abstractly
 */

export default HexIcon;
