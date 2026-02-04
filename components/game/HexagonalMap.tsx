/**
 * HexagonalMap Component
 *
 * SVG-based rendering of the hexagonal game board
 * Displays hexagons, vertices, and influence tokens
 */

'use client';

import React from 'react';
import { MapLayout, getHexColor } from '@/lib/game/map-generator';
import { hexToPixel, getHexagonPoints, EdgeId, parseEdgeId, edgeToPixel, getEdgeRotation } from '@/lib/game/hex-grid';
import { HexIcon } from './HexIcon';

interface InfluenceTokenData {
  edgeId: EdgeId;
  playerId: string;
  playerName?: string;
  playerColor?: string | null;
  tokenType: string; // "4/0", "2/2", "1/3"
  orientation: string; // "A" or "B"
}

interface HexagonalMapProps {
  mapLayout: MapLayout | null;
  tokens: InfluenceTokenData[];
  highlightedEdges?: EdgeId[];
  interactionMode?: 'view' | 'place';
  onEdgeClick?: (edgeId: EdgeId) => void;
}

const HEX_SIZE = 40; // Base hex size in pixels
const EDGE_RADIUS = 6; // Edge circle radius (grey circles)
const EDGE_RADIUS_HIGHLIGHTED = 12; // Highlighted edge radius
const TOKEN_RADIUS = 14; // Token circle radius

/**
 * Render a single hexagon
 */
function HexagonTile({ hex, hexSize }: { hex: any; hexSize: number }) {
  const center = hexToPixel(hex.coordinate, hexSize);
  const points = getHexagonPoints(center.x, center.y, hexSize);
  const color = getHexColor(hex.type);

  // Show double house icon if this hex has 5-6 edges around it
  // But NOT if it's a Money Hub or Buzz Hub
  const showDoubleHouse = hex.edgeCount >= 5 &&
    hex.type !== 'moneyHub' &&
    hex.type !== 'buzzHub';

  return (
    <g className="hex-tile">
      {/* Hexagon polygon */}
      <polygon
        points={points}
        fill={color}
        stroke="#333"
        strokeWidth="2"
        opacity="0.9"
      />

      {/* Icon centered in hexagon */}
      <foreignObject
        x={center.x - hexSize * 0.5}
        y={center.y - hexSize * 0.5}
        width={hexSize}
        height={hexSize}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            gap: '2px',
          }}
        >
          <HexIcon type={hex.type} size={showDoubleHouse ? 'small' : 'normal'} />
          {showDoubleHouse && <HexIcon type="households" size="small" />}
        </div>
      </foreignObject>
    </g>
  );
}

/**
 * Render an edge (grey circle on shared side between hexagons)
 */
function Edge({
  edgeId,
  hexSize,
  highlighted,
  onClick,
  interactive,
}: {
  edgeId: EdgeId;
  hexSize: number;
  highlighted: boolean;
  onClick?: () => void;
  interactive: boolean;
}) {
  const pos = React.useMemo(() => {
    const hexPair = parseEdgeId(edgeId);
    if (!hexPair) return null;
    return edgeToPixel(hexPair[0], hexPair[1], hexSize);
  }, [edgeId, hexSize]);

  if (!pos) return null;

  const radius = highlighted ? EDGE_RADIUS_HIGHLIGHTED : EDGE_RADIUS;

  return (
    <g>
      <circle
        cx={pos.x}
        cy={pos.y}
        r={radius}
        fill={highlighted ? '#000000' : '#B0B0B0'} // Black if highlighted, grey otherwise
        stroke="#333"
        strokeWidth="1"
        opacity={highlighted ? 1 : 0.6}
        className={interactive ? 'cursor-pointer hover:opacity-100 transition-opacity' : ''}
        onClick={onClick}
      />
      {highlighted && (
        <text
          x={pos.x}
          y={pos.y + 4}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="10"
          fontWeight="900"
          style={{ pointerEvents: 'none' }}
        >
          !
        </text>
      )}
    </g>
  );
}

/**
 * Render an influence token (split circle with numbers)
 */
function InfluenceToken({ token, hexSize }: { token: InfluenceTokenData; hexSize: number }) {
  const { pos, rotation } = React.useMemo(() => {
    const hexPair = parseEdgeId(token.edgeId);
    if (!hexPair) return { pos: null, rotation: 0 };
    return {
      pos: edgeToPixel(hexPair[0], hexPair[1], hexSize),
      rotation: getEdgeRotation(hexPair[0], hexPair[1])
    };
  }, [token.edgeId, hexSize]);

  if (!pos) return null;

  // Check if this is an NPC token (by player name)
  const isNPCToken = token.playerName === 'NPC';

  if (isNPCToken) {
    // Render NPC token as a white circle with no numbers
    return (
      <g className="influence-token-npc">
        <circle
          cx={pos.x}
          cy={pos.y}
          r={TOKEN_RADIUS}
          fill="white"
          stroke="#888"
          strokeWidth="2"
        />
      </g>
    );
  }

  const [valueA, valueB] = token.tokenType.split('/').map(Number);

  // Use player color if available, otherwise default to yellow
  const tokenColor = token.playerColor || '#FFEB3B';
  const textColor = '#000';

  return (
    <g
      className="influence-token"
      transform={`rotate(${rotation} ${pos.x} ${pos.y})`}
    >
      {/* Outer circle */}
      <circle
        cx={pos.x}
        cy={pos.y}
        r={TOKEN_RADIUS}
        fill={tokenColor}
        stroke="#333"
        strokeWidth="2"
      />

      {/* Horizontal dividing line */}
      <line
        x1={pos.x - TOKEN_RADIUS}
        y1={pos.y}
        x2={pos.x + TOKEN_RADIUS}
        y2={pos.y}
        stroke="#000"
        strokeWidth="2"
      />

      {/* Top value */}
      <text
        x={pos.x}
        y={pos.y - 3}
        textAnchor="middle"
        fill={textColor}
        fontSize="12"
        fontWeight="bold"
      >
        {token.orientation === 'A' ? valueA : valueB}
      </text>

      {/* Bottom value */}
      <text
        x={pos.x}
        y={pos.y + 10}
        textAnchor="middle"
        fill={textColor}
        fontSize="12"
        fontWeight="bold"
      >
        {token.orientation === 'A' ? valueB : valueA}
      </text>
    </g>
  );
}

/**
 * Main HexagonalMap component
 */
export function HexagonalMap({
  mapLayout,
  tokens,
  highlightedEdges = [],
  interactionMode = 'view',
  onEdgeClick,
}: HexagonalMapProps) {
  if (!mapLayout) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        <p>No map data available</p>
      </div>
    );
  }

  // Calculate SVG viewBox dimensions
  const hexSize = HEX_SIZE;
  const padding = hexSize * 2;

  // Find min/max coordinates for viewBox
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  mapLayout.hexes.forEach((hex) => {
    const pos = hexToPixel(hex.coordinate, hexSize);
    minX = Math.min(minX, pos.x - hexSize);
    minY = Math.min(minY, pos.y - hexSize);
    maxX = Math.max(maxX, pos.x + hexSize);
    maxY = Math.max(maxY, pos.y + hexSize);
  });

  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxWidth = maxX - minX + padding * 2;
  const viewBoxHeight = maxY - minY + padding * 2;

  const isInteractive = interactionMode === 'place' && highlightedEdges.length > 0;

  return (
    <div className="hexagonal-map w-full overflow-auto">
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto"
        style={{ maxHeight: '600px' }}
      >
        {/* Render hexagons */}
        <g className="hexagons">
          {mapLayout.hexes.map((hex) => (
            <HexagonTile key={hex.id} hex={hex} hexSize={hexSize} />
          ))}
        </g>

        {/* Render edges (grey circles between hexagons) */}
        <g className="edges">
          {mapLayout.edges.map((edgeId) => {
            // Don't render edges that have tokens
            const hasToken = tokens.some((t) => t.edgeId === edgeId);
            if (hasToken) return null;

            const highlighted = highlightedEdges.includes(edgeId);

            return (
              <Edge
                key={edgeId}
                edgeId={edgeId}
                hexSize={hexSize}
                highlighted={highlighted}
                onClick={() => onEdgeClick && onEdgeClick(edgeId)}
                interactive={isInteractive && highlighted}
              />
            );
          })}
        </g>

        {/* Render influence tokens */}
        <g className="tokens">
          {tokens.map((token, index) => (
            <InfluenceToken key={`${token.edgeId}-${index}`} token={token} hexSize={hexSize} />
          ))}
        </g>
      </svg>
    </div>
  );
}

export default HexagonalMap;
