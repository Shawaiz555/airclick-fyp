'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
// import AdminSidebar from '../../components/AdminSidebar';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';

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

  const [userGrowthData] = useState([
    { name: 'Jan', users: 4000 },
    { name: 'Feb', users: 3000 },
    { name: 'Mar', users: 2000 },
    { name: 'Apr', users: 2780 },
    { name: 'May', users: 1890 },
    { name: 'Jun', users: 2390 },
    { name: 'Jul', users: 3490 },
  ]);

  const [accuracyData] = useState([
    { name: 'Week 1', accuracy: 92 },
    { name: 'Week 2', accuracy: 89 },
    { name: 'Week 3', accuracy: 94 },
    { name: 'Week 4', accuracy: 91 },
    { name: 'Week 5', accuracy: 95 },
    { name: 'Week 6', accuracy: 93 },
    { name: 'Week 7', accuracy: 96 },
  ]);

  useEffect(() => {
    setIsLoaded(true);

    const logMessages = [
      "User 'admin' logged in",
      "Gesture 'Swipe Left' executed successfully",
      "System health check passed",
      "New user registered: user123",
      "Gesture accuracy improved to 94%",
      "False trigger detected and filtered",
      "Cloud sync completed successfully",
      "Camera module initialized",
      "Gesture 'Pinch to Zoom' executed",
      "System resources optimized"
    ];

    const generateLog = () => {
      const randomMessage = logMessages[Math.floor(Math.random() * logMessages.length)];
      const newLog = {
        id: Date.now(),
        message: randomMessage,
        timestamp: new Date().toLocaleTimeString(),
        type: Math.random() > 0.7 ? 'warning' : 'info'
      };

      setLogs(prev => [newLog, ...prev.slice(0, 9)]);
    };

    const interval = setInterval(generateLog, 5000);
    generateLog();

    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      title: 'Total Users',
      value: '12,482',
      change: '+12.4%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'from-cyan-500 to-blue-500'
    },
    {
      title: 'Active Sessions',
      value: '1,248',
      change: '+8.2%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Gesture Accuracy',
      value: '94.2%',
      change: '+2.1%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-emerald-500 to-teal-500'
    },
    {
      title: 'False Triggers',
      value: '24',
      change: '-15.3%',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'from-amber-500 to-orange-500'
    }
  ];


  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <Head>
          <title>Admin Dashboard | System Overview</title>
          <meta name="description" content="Admin dashboard for system monitoring" />
        </Head>

        <main className="md:ml-64 min-h-screen p-4 md:p-2">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                System Overview
              </h1>
              <p className="text-purple-200">Monitor system performance and key metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className={`bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20 transform transition-all duration-500 hover:scale-[1.02] hover:border-cyan-500/40 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                    }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-cyan-200 text-sm mb-1">{stat.title}</p>
                      <p className="text-2xl font-bold mb-2">{stat.value}</p>
                      <p className={`text-sm ${stat.change.startsWith('+') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {stat.change} from last month
                      </p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.color} opacity-20`}>
                      {stat.icon}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                <h3 className="text-xl font-semibold mb-4 text-cyan-200">User Growth</h3>
                <div className="h-72">
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
                      <LineChart
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
                <h3 className="text-xl font-semibold mb-4 text-emerald-200">Gesture Accuracy</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={accuracyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                      <XAxis dataKey="name" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" domain={[80, 100]} />
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
                        cursor={{ fill: 'rgba(255,255,255,0)' }} // 🔥 makes hover background fully invisible without replacing bars
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

            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-cyan-200">Real-time Status Logs</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm text-green-400">Live</span>
                </div>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
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
        </main>
      </div>
    </ProtectedRoute>

  );
}