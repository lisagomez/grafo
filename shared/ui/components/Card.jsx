/**
 * Card Component
 * Flexible card container with header and footer support
 */

const Card = ({ 
  children, 
  className = '',
  padding = 'md',
  ...props 
}) => {
  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div 
      className={`bg-white rounded-xl border border-gray-100 ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

Card.Header = ({ children, className = '' }) => (
  <div className={`border-b border-gray-100 -mx-6 -mt-6 px-6 py-4 mb-6 ${className}`}>
    {children}
  </div>
);

Card.Title = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

Card.Description = ({ children, className = '' }) => (
  <p className={`text-sm text-gray-500 mt-1 ${className}`}>
    {children}
  </p>
);

Card.Footer = ({ children, className = '' }) => (
  <div className={`border-t border-gray-100 -mx-6 -mb-6 px-6 py-4 mt-6 bg-gray-50 rounded-b-xl ${className}`}>
    {children}
  </div>
);

export default Card;

