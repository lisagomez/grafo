/**
 * Input Component
 * Form input with label, error, and icon support
 */

import { forwardRef } from 'react';

const Input = forwardRef(({
  label,
  error,
  leftIcon,
  rightIcon,
  className = '',
  ...props
}, ref) => {
  const baseInputStyles = `
    w-full rounded-lg border border-gray-200 bg-white
    focus:ring-2 focus:ring-primary-500 focus:border-transparent
    transition-all duration-200
    disabled:bg-gray-50 disabled:cursor-not-allowed
  `;

  const inputPadding = leftIcon 
    ? 'pl-10 pr-4 py-3' 
    : rightIcon 
      ? 'pl-4 pr-10 py-3' 
      : 'px-4 py-3';

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`${baseInputStyles} ${inputPadding} ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;

