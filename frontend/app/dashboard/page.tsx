'use client';

import { useCallback } from 'react';
import {
  Users,
  DollarSign,
  Activity,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
} from 'lucide-react';
import DashboardLayout from '@/components/layouts/DashboardLayout';

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ComponentType<{ className?: string }>;
}

const stats: StatCard[] = [
  {
    title: 'Total Revenue',
    value: '$45,231.89',
    change: '+20.1%',
    changeType: 'positive',
    icon: DollarSign,
  },
  {
    title: 'Active Users',
    value: '2,350',
    change: '+180',
    changeType: 'positive',
    icon: Users,
  },
  {
    title: 'Active Sessions',
    value: '1,247',
    change: '-5.4%',
    changeType: 'negative',
    icon: Activity,
  },
  {
    title: 'Growth Rate',
    value: '+12.5%',
    change: '+2.3%',
    changeType: 'positive',
    icon: TrendingUp,
  },
];

interface RecentActivity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
  avatar: string;
}

const recentActivity: RecentActivity[] = [
  {
    id: '1',
    user: 'Sarah Chen',
    action: 'Upgraded to Pro plan',
    timestamp: '2 minutes ago',
    avatar: 'SC',
  },
  {
    id: '2',
    user: 'Mike Johnson',
    action: 'Created new workspace',
    timestamp: '15 minutes ago',
    avatar: 'MJ',
  },
  {
    id: '3',
    user: 'Emily Davis',
    action: 'Invited 3 team members',
    timestamp: '1 hour ago',
    avatar: 'ED',
  },
  {
    id: '4',
    user: 'Alex Rivera',
    action: 'Completed onboarding',
    timestamp: '2 hours ago',
    avatar: 'AR',
  },
  {
    id: '5',
    user: 'Jordan Lee',
    action: 'Updated billing info',
    timestamp: '3 hours ago',
    avatar: 'JL',
  },
];

export default function DashboardPage() {
  const handleMoreClick = useCallback(() => {
    // Handle more options click
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back! Here&apos;s what&apos;s happening with your business.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-primary-600" />
                </div>
                <span
                  className={`flex items-center gap-1 text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.changeType === 'positive' ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
                <p className="text-sm text-gray-600 mt-1">{stat.title}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Overview</h2>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Chart component placeholder</p>
                <p className="text-sm text-gray-400">Integrate your preferred charting library</p>
              </div>
            </div>
          </div>

          {/* User Growth Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">User Growth</h2>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </select>
            </div>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">Chart component placeholder</p>
                <p className="text-sm text-gray-400">Integrate your preferred charting library</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {recentActivity?.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-medium text-sm">
                      {activity.avatar}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.user}</p>
                      <p className="text-sm text-gray-600">{activity.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">{activity.timestamp}</span>
                    <button
                      onClick={handleMoreClick}
                      className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreHorizontal className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

