'use client';

import { useState, useEffect } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  showProgress?: boolean;
  progress?: number;
  className?: string;
}

export default function LoadingSpinner({ 
  size = 'medium', 
  text = 'Loading...', 
  showProgress = false,
  progress = 0,
  className = ''
}: LoadingSpinnerProps) {
  const [dots, setDots] = useState('');

  // Animated dots effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const textSizes = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {/* Spinner */}
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-gray-300 border-t-white`} />
      
      {/* Text */}
      <div className={`text-gray-400 ${textSizes[size]} text-center`}>
        {text}{dots}
      </div>
      
      {/* Progress bar */}
      {showProgress && (
        <div className="w-32 bg-gray-700 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
} 