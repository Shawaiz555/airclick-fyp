'use client';

import { useState, useEffect } from 'react';
import Head from 'next/head';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function UserManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState(null);

  // Mock user data
  useEffect(() => {
    const mockUsers = Array.from({ length: 25 }, (_, i) => ({
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i % 4 === 0 ? 'ADMIN' : i % 3 === 0 ? 'MODERATOR' : 'USER',
      status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
      lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      accessibility: {
        fontSize: 'medium',
        colorScheme: 'default',
        voiceCommands: i % 2 === 0
      }
    }));
    setUsers(mockUsers);
  }, []);

  // Get current users
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = users.slice(indexOfFirstUser, indexOfLastUser);

  // Change page
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleViewLogs = (user) => {
    setSelectedUser(user);
    setShowLogsModal(true);
  };

  const handleEditUser = (user) => {
    setCurrentUser(user);
    setShowEditModal(true);
  };

  const handleDisableUser = (userId) => {
    setUserToDisable(userId);
    setShowDisableConfirm(true);
  };

  const confirmDisable = () => {
    setUsers(users.map(user =>
      user.id === userToDisable ? { ...user, status: 'INACTIVE' } : user
    ));
    toast.success('User disabled successfully');
    setUserToDisable(null);
  };

  const handleSaveUser = () => {
    if (currentUser) {
      setUsers(users.map(user =>
        user.id === currentUser.id ? currentUser : user
      ));
      toast.success('User updated successfully');
    }
    setShowEditModal(false);
    setCurrentUser(null);
  };

  const mockLogs = [
    { id: 1, action: 'Logged in', timestamp: '2024-01-15 14:30:22', ip: '192.168.1.100' },
    { id: 2, action: 'Created gesture profile', timestamp: '2024-01-15 14:32:15', ip: '192.168.1.100' },
    { id: 3, action: 'Modified accessibility settings', timestamp: '2024-01-15 14:35:44', ip: '192.168.1.100' },
    { id: 4, action: 'Logged out', timestamp: '2024-01-15 15:20:11', ip: '192.168.1.100' },
    { id: 5, action: 'Logged in', timestamp: '2024-01-16 09:15:33', ip: '192.168.1.101' },
  ];

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <Head>
          <title>User Management | Admin Dashboard</title>
          <meta name="description" content="Manage user access and roles" />
        </Head>

        <AdminSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab="users"
        />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        <main className="md:ml-64 min-h-screen p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                User Management
              </h1>
              <p className="text-purple-200">Manage user access, roles, and accessibility configurations</p>
            </div>

            {/* Users Table */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-cyan-500/20">
                    <tr>
                      <th className="text-center p-4 font-semibold text-cyan-200">User</th>
                      <th className="text-center p-4 font-semibold text-cyan-200">Email</th>
                      <th className="text-center p-4 font-semibold text-cyan-200">Role</th>
                      <th className="text-center p-4 font-semibold text-cyan-200">Status</th>
                      <th className="text-center p-4 font-semibold text-cyan-200">Last Login</th>
                      <th className="text-right p-4 font-semibold text-cyan-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-700/50 hover:bg-gray-800/20 text-center transition-colors">
                        <td className="p-4 font-medium">{user.name}</td>
                        <td className="p-4 text-cyan-300">{user.email}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'ADMIN'
                              ? 'bg-purple-500/20 text-purple-300'
                              : user.role === 'MODERATOR'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'bg-green-500/20 text-green-300'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.status === 'ACTIVE'
                              ? 'bg-green-500/20 text-green-300'
                              : 'bg-amber-500/20 text-amber-300'
                            }`}>
                            {user.status}
                          </span>
                        </td>
                        <td className="p-4 text-gray-300">
                          {new Date(user.lastLogin).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleViewLogs(user)}
                              className="p-2 rounded-lg hover:cursor-pointer hover:bg-cyan-500/10 transition-colors"
                              title="View Logs"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-2 rounded-lg hover:cursor-pointer hover:bg-purple-500/10 transition-colors"
                              title="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {user.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleDisableUser(user.id)}
                                className="p-2 rounded-lg hover:cursor-pointer hover:bg-amber-500/10 transition-colors"
                                title="Disable"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex justify-center mt-6">
              <nav className="flex items-center space-x-2">
                <button
                  onClick={() => paginate(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 rounded-lg hover:cursor-pointer bg-gray-800/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                {Array.from({ length: Math.ceil(users.length / usersPerPage) }, (_, i) => i + 1).map(number => (
                  <button
                    key={number}
                    onClick={() => paginate(number)}
                    className={`px-3 py-2 rounded-lg hover:cursor-pointer transition-colors ${currentPage === number
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                        : 'bg-gray-800/50 hover:bg-gray-700'
                      }`}
                  >
                    {number}
                  </button>
                ))}

                <button
                  onClick={() => paginate(currentPage + 1)}
                  disabled={currentPage === Math.ceil(users.length / usersPerPage)}
                  className="px-3 py-2 rounded-lg hover:cursor-pointer bg-gray-800/50 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </nav>
            </div>

            {/* Logs Modal */}
            {showLogsModal && selectedUser && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-2xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                  <div className="p-6 pb-4 border-b border-gray-700/50">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                        Activity Logs - {selectedUser.name}
                      </h2>
                      <button
                        onClick={() => setShowLogsModal(false)}
                        className="text-gray-400 hover:cursor-pointer hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="space-y-4">
                      {mockLogs.map(log => (
                        <div key={log.id} className="p-4 bg-gray-800/30 rounded-lg border border-cyan-500/20">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-cyan-200">{log.action}</p>
                              <p className="text-sm text-gray-400 mt-1">IP: {log.ip}</p>
                            </div>
                            <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                              {log.timestamp}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && currentUser && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-md bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                        Edit User
                      </h2>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="text-gray-400 hover:cursor-pointer hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Name</label>
                        <input
                          type="text"
                          value={currentUser.name}
                          onChange={(e) => setCurrentUser({ ...currentUser, name: e.target.value })}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Email</label>
                        <input
                          type="email"
                          value={currentUser.email}
                          onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Role</label>
                        <select
                          value={currentUser.role}
                          onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        >
                          <option value="USER">User</option>
                          <option value="MODERATOR">Moderator</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Status</label>
                        <select
                          value={currentUser.status}
                          onChange={(e) => setCurrentUser({ ...currentUser, status: e.target.value })}
                          className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                        </select>
                      </div>

                      <div className="pt-4">
                        <h3 className="text-lg font-semibold mb-3 text-purple-200">Accessibility Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-cyan-200">Font Size</label>
                            <select
                              value={currentUser.accessibility.fontSize}
                              onChange={(e) => setCurrentUser({
                                ...currentUser,
                                accessibility: { ...currentUser.accessibility, fontSize: e.target.value }
                              })}
                              className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                            >
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-cyan-200">Color Scheme</label>
                            <select
                              value={currentUser.accessibility.colorScheme}
                              onChange={(e) => setCurrentUser({
                                ...currentUser,
                                accessibility: { ...currentUser.accessibility, colorScheme: e.target.value }
                              })}
                              className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                            >
                              <option value="default">Default</option>
                              <option value="high-contrast">High Contrast</option>
                              <option value="dark">Dark</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center mt-3">
                          <input
                            type="checkbox"
                            id="voiceCommands"
                            checked={currentUser.accessibility.voiceCommands}
                            onChange={(e) => setCurrentUser({
                              ...currentUser,
                              accessibility: { ...currentUser.accessibility, voiceCommands: e.target.checked }
                            })}
                            className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                          />
                          <label htmlFor="voiceCommands" className="ml-2 text-sm font-medium text-gray-300">Enable Voice Commands</label>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-6">
                      <button
                        onClick={handleSaveUser}
                        className="flex-1 py-3 hover:cursor-pointer px-6 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="flex-1 py-3 px-6 hover:cursor-pointer bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Disable User Confirmation Modal */}
            <ConfirmModal
              isOpen={showDisableConfirm}
              onClose={() => {
                setShowDisableConfirm(false);
                setUserToDisable(null);
              }}
              onConfirm={confirmDisable}
              title="Disable User"
              message="Are you sure you want to disable this user? They will no longer be able to access the system."
              confirmText="Disable"
              cancelText="Cancel"
            />
          </div>
        </main>
      </div>
    </ProtectedRoute>

  );
}