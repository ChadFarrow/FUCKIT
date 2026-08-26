'use client';


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
  // The animated dots used to be a setInterval calling setState twice a second,
  // per spinner. The home page renders `SkeletonGrid count={12}`, so that was
  // 24 React renders a second for a decorative ellipsis, during the load it was
  // decorating. CSS does it for free, off the main thread.

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
        {text}
        <span className="sk-loading-dots" aria-hidden="true" />
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