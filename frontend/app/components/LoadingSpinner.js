'use client';

/**
 * Reusable Loading Spinner Component
 *
 * A consistent loading animation used across all pages in the application.
 * Features a gradient animated spinner with optional message text.
 *
 * @param {string} message - Optional loading message to display (default: "Loading...")
 * @param {string} size - Size of the spinner: 'sm', 'md', 'lg', 'xl' (default: 'lg')
 * @param {boolean} fullScreen - Whether to show as full screen overlay (default: false)
 */
export default function LoadingSpinner({
  message = "Loading...",
  size = "lg",
  fullScreen = false
}) {
  // Size configurations
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
    xl: "h-24 w-24"
  };

  const textSizes = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-2xl"
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.lg;
  const textSize = textSizes[size] || textSizes.lg;

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Animated Gradient Spinner */}
      <div className="relative">
        {/* Outer spinning ring with gradient */}
        <div className={`${spinnerSize} rounded-full border-4 border-transparent bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 animate-spin`}
          style={{
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            maskImage: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            WebkitMaskImage: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor'
          }}>
        </div>

        {/* Inner pulsing circle */}
        <div className={`absolute inset-0 ${spinnerSize} rounded-full bg-gradient-to-r from-cyan-400/20 to-purple-400/20 animate-pulse`}></div>

        {/* Center dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 animate-ping"></div>
        </div>
      </div>

      {/* Loading Text */}
      {message && (
        <div className="flex flex-col items-center gap-2">
          <p className={`${textSize} font-medium text-purple-200 animate-pulse`}>
            {message}
          </p>
          {/* Animated dots */}
          <div className="flex gap-1">
            <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );

  // Full screen overlay version
  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center z-50">
        {content}
      </div>
    );
  }

  // Inline version
  return content;
}
