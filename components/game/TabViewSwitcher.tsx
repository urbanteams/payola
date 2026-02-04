'use client';

import React from 'react';

interface TabViewSwitcherProps {
  currentView: 'game' | 'map' | 'firstMap';
  onViewChange: (view: 'game' | 'map' | 'firstMap') => void;
  showFirstMapTab?: boolean;
}

export function TabViewSwitcher({ currentView, onViewChange, showFirstMapTab }: TabViewSwitcherProps) {
  return (
    <div className={`flex gap-2 bg-gray-100 p-1 rounded-lg mb-6 ${showFirstMapTab ? 'max-w-2xl' : 'max-w-md'} mx-auto`}>
      <button
        onClick={() => onViewChange('game')}
        className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
          currentView === 'game'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Game View
      </button>
      <button
        onClick={() => onViewChange('map')}
        className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
          currentView === 'map'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Map View
      </button>
      {showFirstMapTab && (
        <button
          onClick={() => onViewChange('firstMap')}
          className={`flex-1 px-6 py-3 rounded-md font-semibold transition-all ${
            currentView === 'firstMap'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          First Map Results
        </button>
      )}
    </div>
  );
}
