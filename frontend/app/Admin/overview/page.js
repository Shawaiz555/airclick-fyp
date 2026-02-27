'use client';

import { useState, useEffect } from 'react';
// import AdminSidebar from '../../components/AdminSidebar';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import { adminAPI } from '../../utils/api';

const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), { ssr: false });
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false });
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });

export default function AdminOverview() {
  // const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [stats, setStats] = useState({
    total_users: 0,
    active_users: 0,
    average_gesture_accuracy: 0,
    total_false_triggers: 0
  });
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [accuracyData, setAccuracyData] = useState([]);

  // Fetch initial data
  const fetchDashboardData = async () => {
    try {
      // Check if user is authenticated first
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        console.log('No authentication token found, skipping admin API calls');
        setIsLoaded(true);
        return;
      }

      // Fetch all data in parallel
      const [overviewStats, monthlyUsers, monthlyAccuracy, recentActivity] = await Promise.all([
        adminAPI.getOverviewStats(),
        adminAPI.getMonthlyUserGrowth(6),
        adminAPI.getMonthlyGestureAccuracy(6),
        adminAPI.getRecentActivity(10)
      ]);

      // Update stats
      setStats(overviewStats);

      // Update user growth chart (monthly)
      setUserGrowthData(monthlyUsers.map(month => ({
        name: month.month_label,
        users: month.user_count
      })));

      // Update accuracy chart (convert to percentage, monthly)
      setAccuracyData(monthlyAccuracy.map(month => ({
        name: month.month_label,
        accuracy: month.avg_accuracy * 100
      })));

      // Update activity logs with staggered animation
      setLogs([]); // Clear existing logs first

      // Add logs one by one with delay for better UX (reversed order so newest appears at top)
      const reversedLogs = [...recentActivity].reverse();
      reversedLogs.forEach((log, index) => {
        setTimeout(() => {
          setLogs(prevLogs => [{
            id: log.id,
            message: `${log.user_email}: ${log.action}`,
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            type: log.action.toLowerCase().includes('error') || log.action.toLowerCase().includes('false') ? 'warning' : 'info',
            user_email: log.user_email,
            meta_data: log.meta_data
          }, ...prevLogs]);
        }, index * 7000); // 7000ms (7 second) delay between each log for smooth appearance
      });

      setIsLoaded(true);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsLoaded(true);
    }
  };

  useEffect(() => {
    // Only fetch data if user is authenticated
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      console.log('User not authenticated, skipping dashboard initialization');
      return;
    }

    fetchDashboardData();

    // Refresh data every 10 seconds for real-time updates
    const interval = setInterval(async () => {
      // Re-check authentication before each refresh
      const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!currentToken) {
        console.log('Authentication lost, stopping real-time updates');
        clearInterval(interval);
        return;
      }

      try {
        // Fetch updated stats and activity logs
        const [overviewStats, recentActivity] = await Promise.all([
          adminAPI.getOverviewStats(),
          adminAPI.getRecentActivity(10)
        ]);

        setStats(overviewStats);

        // Check for new logs by comparing IDs
        const currentLogIds = new Set(logs.map(log => log.id));
        const newLogs = recentActivity.filter(log => !currentLogIds.has(log.id));

        // Add only new logs with staggered animation
        if (newLogs.length > 0) {
          newLogs.reverse().forEach((log, index) => {
            setTimeout(() => {
              setLogs(prevLogs => {
                // Double-check the log isn't already in the list (avoid race conditions)
                if (prevLogs.some(existingLog => existingLog.id === log.id)) {
                  return prevLogs;
                }

                // Limit to 10 logs maximum
                const updatedLogs = [{
                  id: log.id,
                  message: `${log.user_email}: ${log.action}`,
                  timestamp: new Date(log.timestamp).toLocaleTimeString(),
                  type: log.action.toLowerCase().includes('error') || log.action.toLowerCase().includes('false') ? 'warning' : 'info',
                  user_email: log.user_email,
                  meta_data: log.meta_data
                }, ...prevLogs];

                return updatedLogs.slice(0, 10);
              });
            }, index * 7000); // 7000ms (7 second) delay between each new log for smooth, visible appearance
          });
        }
      } catch (error) {
        console.error('Failed to refresh dashboard data:', error);
        // If error is 401/403, user might have been logged out
        if (error.message?.includes('401') || error.message?.includes('403')) {
          console.log('Authentication error, stopping real-time updates');
          clearInterval(interval);
        }
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [logs]);

  const statsCards = [
    {
      title: 'Total Users',
      value: stats.total_users.toLocaleString(),
      change: `${stats.total_users} registered`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'from-cyan-500 to-blue-600',
      shadowColor: 'cyan-500/20'
    },
    {
      title: 'Active Users',
      value: stats.active_users.toLocaleString(),
      change: `${((stats.active_users / Math.max(stats.total_users, 1)) * 100).toFixed(1)}% of total`,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'from-purple-500 to-pink-600',
      shadowColor: 'purple-500/20'
    },
    {
      title: 'Gesture Accuracy',
      value: `${(stats.average_gesture_accuracy * 100).toFixed(1)}%`,
      change: stats.average_gesture_accuracy > 0 ? 'Average across all gestures' : 'No data yet',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-emerald-500 to-teal-600',
      shadowColor: 'emerald-500/20'
    },
    {
      title: 'False Triggers',
      value: stats.total_false_triggers.toLocaleString(),
      change: 'Total count',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'from-amber-500 to-orange-600',
      shadowColor: 'amber-500/20'
    }
  ];


  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br px-4 py-6 from-indigo-900 via-purple-900 to-pink-800 text-white">
        <main className="md:ml-64 min-h-screen p-4 md:p-2">
          {!isLoaded ? (
            <div className="flex items-center justify-center min-h-[80vh]">
              <LoadingSpinner message="Loading dashboard..." size="lg" />
            </div>
          ) : (
          <div className="max-w-8xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                System Overview
              </h1>
              <p className="text-purple-200">Monitor system performance and key metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {statsCards.map((stat, index) => (
                <div
                  key={index}
                  className={`bg-gray-800/30 backdrop-blur-lg rounded-2xl p-4 py-8 border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  {/* Icon Container - Centered */}
                  <div className="flex items-center justify-center mb-3">
                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-lg shadow-${stat.shadowColor}`}>
                      {stat.icon}
                    </div>
                  </div>

                  {/* Text Content - Centered */}
                  <div className='text-center'>
                    <p className="text-2xl text-white font-bold mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-purple-300/80 mb-2">{stat.value}</p>
                    <p className="text-sm text-gray-400">
                      {stat.change}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h3 className="text-xl font-semibold mb-4 text-cyan-200">Monthly User Growth</h3>
                <div className="h-88">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.8)',
                          borderColor: 'rgba(6, 182, 212, 0.3)',
                          borderRadius: '0.5rem'
                        }}
                        labelStyle={{ color: '#06b6d4' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={{ stroke: '#06b6d4', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#0891b2' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h3 className="text-xl font-semibold mb-4 text-emerald-200">Monthly Gesture Accuracy</h3>
                <div className="h-88">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accuracyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.8)',
                          borderColor: 'rgba(16, 185, 129, 0.3)',
                          borderRadius: '0.5rem',
                          boxShadow: 'none',
                        }}
                        labelStyle={{ color: '#10b981' }}
                        itemStyle={{ color: '#d1fae5' }}
                        wrapperStyle={{
                          backgroundColor: 'transparent',
                          boxShadow: 'none',
                          border: 'none',
                        }}
                        cursor={{ fill: 'rgba(255,255,255,0)' }}
                      />
                      <Bar
                        dataKey="accuracy"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 px-10 border border-cyan-500/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-cyan-200">Real-time Status Logs</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm text-green-400">Live</span>
                </div>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log,index) => (
                  <div
                    key={`${index}`}
                    className={`p-4 rounded-lg border-l-4 ${log.type === 'warning'
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-cyan-500/10 border-cyan-500/50'
                      }`}
                  >
                    <div className="flex justify-between">
                      <p className={log.type === 'warning' ? 'text-amber-300' : 'text-cyan-300'}>
                        {log.message}
                      </p>
                      <span className="text-xs text-gray-400">{log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}