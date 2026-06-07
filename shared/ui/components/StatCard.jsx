/**
 * Stat Card Component
 * Display statistics with icon and trend indicator
 */

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({
  title,
  value,
  change,
  changeType = 'positive',
  icon: Icon,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-shadow ${className}`}>
      <div className="flex items-center justify-between">
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary-600" />
          </div>
        )}
        {change && (
          <span
            className={`flex items-center gap-1 text-sm font-medium ${
              changeType === 'positive' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {changeType === 'positive' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            {change}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        <p className="text-sm text-gray-600 mt-1">{title}</p>
      </div>
    </div>
  );
};

export default StatCard;

