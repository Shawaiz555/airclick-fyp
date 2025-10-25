'use client';

import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import { Search, Filter, Users as UsersIcon, UserCheck, UserX, Download, ChevronUp, ChevronDown } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(10);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserLogs, setSelectedUserLogs] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [userToDisable, setUserToDisable] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [sortField, setSortField] = useState('email');
  const [sortDirection, setSortDirection] = useState('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Statistics state
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    moderators: 0,
    users: 0
  });

  // Fetch users from API
  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch('http://localhost:8000/api/admin/users?limit=100', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:8000/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchUserLogs = async (userId) => {
    setLogsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/admin/users/${userId}/activity?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity logs');
      }

      const data = await response.json();
      setSelectedUserLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load activity logs');
      setSelectedUserLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Filter and Search Logic
  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user =>
        user.full_name.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filterRole !== 'ALL') {
      filtered = filtered.filter(user => user.role === filterRole);
    }

    // Status filter
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(user => user.status === filterStatus);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (sortField === 'last_login' || sortField === 'created_at') {
        aValue = aValue ? new Date(aValue) : new Date(0);
        bValue = bValue ? new Date(bValue) : new Date(0);
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [users, searchQuery, filterRole, filterStatus, sortField, sortDirection]);

  // Pagination
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterStatus]);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleViewLogs = async (user) => {
    setSelectedUser(user);
    setShowLogsModal(true);
    await fetchUserLogs(user.id);
  };

  const handleEditUser = (user) => {
    setCurrentUser({
      ...user,
      accessibility_settings: user.accessibility_settings || {
        fontSize: 'medium',
        colorScheme: 'default',
        voiceCommands: false
      }
    });
    setShowEditModal(true);
  };

  const handleDisableUser = (userId) => {
    setUserToDisable(userId);
    setShowDisableConfirm(true);
  };

  const confirmDisable = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const response = await fetch(`http://localhost:8000/api/admin/users/${userToDisable}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to disable user');
      }

      toast.success('User disabled successfully');
      await fetchUsers();
      await fetchStats();
    } catch (error) {
      console.error('Error disabling user:', error);
      toast.error(error.message || 'Failed to disable user');
    } finally {
      setUserToDisable(null);
    }
  };

  const handleSaveUser = async () => {
    if (!currentUser) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const updateData = {
        full_name: currentUser.full_name,
        email: currentUser.email,
        role: currentUser.role,
        status: currentUser.status,
        accessibility_settings: currentUser.accessibility_settings
      };

      const response = await fetch(`http://localhost:8000/api/admin/users/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update user');
      }

      toast.success('User updated successfully');
      await fetchUsers();
      await fetchStats();
      setShowEditModal(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error.message || 'Failed to update user');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterRole('ALL');
    setFilterStatus('ALL');
    setSortField('email');
    setSortDirection('asc');
  };

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <Head>
          <title>User Management | Admin Dashboard</title>
          <meta name="description" content="Manage user access and roles" />
        </Head>

        <main className="min-h-screen md:ml-64 p-4 md:p-6 lg:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[80vh]">
              <LoadingSpinner message="Loading users..." size="lg" />
            </div>
          ) : (
          <div className="max-w-8xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl md:text-[44px] font-bold mb-2 gradient-text">
                User Management
              </h1>
              <p className="text-purple-200">Manage user access, roles, and accessibility configurations</p>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
              <div className="bg-gray-800/30 hover:cursor-pointer backdrop-blur-lg rounded-2xl p-6 py-10 border border-cyan-500/20 transition-all duration-300 hover:scale-105 hover:border-cyan-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-cyan-200">Total Users</p>
                    <p className="text-3xl font-bold mt-2">{stats.total}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500">
                    <UsersIcon className="h-6 w-6" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/30 hover:cursor-pointer backdrop-blur-lg rounded-2xl p-6 py-10 border border-green-500/20 transition-all duration-300 hover:scale-105 hover:border-green-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-green-200">Active Users</p>
                    <p className="text-3xl font-bold mt-2 text-green-400">{stats.active}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-green-500/20">
                    <UserCheck className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/30 hover:cursor-pointer backdrop-blur-lg rounded-2xl p-6 py-10 border border-amber-500/20 transition-all duration-300 hover:scale-105 hover:border-amber-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-amber-200">Inactive Users</p>
                    <p className="text-3xl font-bold mt-2 text-amber-400">{stats.inactive}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/20">
                    <UserX className="h-6 w-6 text-amber-400" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/30 hover:cursor-pointer backdrop-blur-lg rounded-2xl p-6 py-10 border border-purple-500/20 transition-all duration-300 hover:scale-105 hover:border-purple-500/40">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-medium text-purple-200">Administrators</p>
                    <p className="text-3xl font-bold mt-2 text-purple-400">{stats.admins}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/20">
                    <UsersIcon className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl p-4 md:p-6 border border-purple-500/20 mb-6">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-cyan-400" />
                  <input
                    type="text"
                    placeholder="Search by Full Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-purple-500/30 bg-gray-700/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  />
                </div>

                {/* Filter Toggle Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center hover:cursor-pointer gap-2 px-6 py-3 rounded-xl font-medium border transition-all duration-300 hover:scale-105 ${
                    showFilters
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-500/40'
                      : 'bg-gray-700/50 border-purple-500/30 hover:border-purple-500/50'
                  }`}
                >
                  <Filter className="h-5 w-5" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-purple-500/20">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">Role</label>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-purple-500/30 bg-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    >
                      <option value="ALL">All Roles</option>
                      <option value="ADMIN">Admin</option>
                      <option value="MODERATOR">Moderator</option>
                      <option value="USER">User</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 text-cyan-200">Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-purple-500/30 bg-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="w-full px-4 py-2.5 rounded-lg font-medium border border-purple-500/30 bg-gray-700/50 hover:border-red-500/50 hover:text-red-400 transition-all duration-300 hover:scale-105"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Results Count */}
              <div className="mt-4 flex items-center justify-between text-sm text-purple-200">
                <span>Showing {indexOfFirstUser + 1}-{Math.min(indexOfLastUser, filteredUsers.length)} of {filteredUsers.length} users</span>
                <div className="flex items-center gap-2">
                  <span>Show:</span>
                  <select
                    value={usersPerPage}
                    onChange={(e) => {
                      setUsersPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 rounded-lg border border-purple-500/30 bg-gray-700/50 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-gray-800/30 backdrop-blur-lg rounded-2xl border border-purple-500/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-purple-500/20">
                    <tr>
                      <th
                        className="text-center p-4 font-semibold cursor-pointer hover:bg-gray-700/30 transition-colors text-cyan-300"
                      >
                        Full Name
                      </th>
                      <th
                        className="text-center p-4 font-semibold cursor-pointer hover:bg-gray-700/30 transition-colors text-cyan-300"
                      >
                        Email
                      </th>
                      <th
                        className="text-center p-4 font-semibold cursor-pointer hover:bg-gray-700/30 transition-colors text-cyan-300"
                      >
                        Role
                      </th>
                      <th
                        className="text-center p-4 font-semibold cursor-pointer hover:bg-gray-700/30 transition-colors text-cyan-300"
                      >
                        Status
                      </th>
                      <th
                        className="text-center p-4 font-semibold cursor-pointer hover:bg-gray-700/30 transition-colors text-cyan-300"
                      >
                        Last Login
                      </th>
                      <th className="text-end p-4 font-semibold text-cyan-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentUsers.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-purple-200">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-12 w-12 opacity-50" />
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-sm">Try adjusting your search or filters</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentUsers.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-purple-500/10 transition-all hover:bg-gray-700/30"
                        >
                          <td className="p-4 text-center text-cyan-300">{user.full_name}</td>
                          <td className="p-4 text-center text-cyan-300">{user.email}</td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-300' :
                              'bg-green-500/20 text-green-300'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {user.status}
                            </span>
                          </td>
                          <td className="p-4 text-center text-purple-200">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleViewLogs(user)}
                                className="p-2 rounded-lg hover:cursor-pointer bg-cyan-500/10 hover:bg-cyan-500/20 transition-all duration-300 hover:scale-110"
                                title="View Logs"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="p-2 rounded-lg hover:cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-300 hover:scale-110"
                                title="Edit User"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              {user.status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleDisableUser(user.id)}
                                  className="p-2 rounded-lg hover:cursor-pointer bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-300 hover:scale-110"
                                  title="Disable User"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => paginate(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg font-medium border border-purple-500/30 bg-gray-700/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:border-purple-500/50"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(number => {
                      return number === 1 ||
                             number === totalPages ||
                             (number >= currentPage - 1 && number <= currentPage + 1);
                    })
                    .map((number, index, array) => {
                      if (index > 0 && number - array[index - 1] > 1) {
                        return [
                          <span key={`ellipsis-${number}`} className="px-3 py-2 text-purple-300">...</span>,
                          <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={`px-4 py-2 rounded-lg font-medium border transition-all duration-300 hover:scale-105 ${
                              currentPage === number
                                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-500/40'
                                : 'bg-gray-700/50 border-purple-500/30 hover:border-purple-500/50'
                            }`}
                          >
                            {number}
                          </button>
                        ];
                      }
                      return (
                        <button
                          key={number}
                          onClick={() => paginate(number)}
                          className={`px-4 py-2 rounded-lg font-medium border transition-all duration-300 hover:scale-105 ${
                            currentPage === number
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 border-cyan-500/40'
                              : 'bg-gray-700/50 border-purple-500/30 hover:border-purple-500/50'
                          }`}
                        >
                          {number}
                        </button>
                      );
                    })}

                  <button
                    onClick={() => paginate(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg font-medium border border-purple-500/30 bg-gray-700/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:border-purple-500/50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}

            {/* Logs Modal */}
            {showLogsModal && selectedUser && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-2xl bg-gray-800/40 backdrop-blur-lg rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl max-h-[80vh] flex flex-col">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                  <div className="p-6 pb-4 border-b border-purple-500/20">
                    <div className="flex justify-between items-center">
                      <h2 className="text-2xl font-bold gradient-text">
                        Activity Logs - {selectedUser.email}
                      </h2>
                      <button
                        onClick={() => setShowLogsModal(false)}
                        className="p-2 rounded-full bg-gray-700/50 text-purple-200 hover:text-white hover:bg-gray-700 transition-all duration-300 hover:scale-110"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {logsLoading ? (
                      <div className="flex justify-center items-center py-8">
                        <LoadingSpinner message="Loading activity logs..." size="md" />
                      </div>
                    ) : selectedUserLogs.length === 0 ? (
                      <div className="text-center py-8 text-purple-200">
                        <p>No activity logs found for this user</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedUserLogs.map(log => (
                          <div
                            key={log.id}
                            className="p-4 rounded-lg border border-purple-500/20 bg-gray-700/30 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500/40"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium text-cyan-300">{log.action}</p>
                                {log.ip_address && (
                                  <p className="text-sm mt-1 text-purple-200">IP: {log.ip_address}</p>
                                )}
                              </div>
                              <span className="text-xs px-2 py-1 rounded bg-gray-900/50 text-purple-200">
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && currentUser && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
                <div className="relative w-full max-w-2xl bg-gray-800/40 backdrop-blur-lg rounded-2xl overflow-hidden border border-purple-500/30 shadow-2xl my-8">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

                  <div className="p-6 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl md:text-3xl font-bold gradient-text">
                        Edit User
                      </h2>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="p-2 rounded-full bg-gray-700/50 text-purple-200 hover:text-white hover:bg-gray-700 transition-all duration-300 hover:scale-110"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Full Name</label>
                        <input
                          type="text"
                          value={currentUser.full_name}
                          onChange={(e) => setCurrentUser({ ...currentUser, full_name: e.target.value })}
                          className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2 text-cyan-200">Email</label>
                        <input
                          type="email"
                          value={currentUser.email}
                          onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                          className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-cyan-200">Role</label>
                          <select
                            value={currentUser.role}
                            onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                            className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                          >
                            <option value="USER">User</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-cyan-200">Status</label>
                          <select
                            value={currentUser.status}
                            onChange={(e) => setCurrentUser({ ...currentUser, status: e.target.value })}
                            className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                          >
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                          </select>
                        </div>
                      </div>

                      <div className="pt-4">
                        <h3 className="text-lg font-semibold mb-4 text-cyan-300">Accessibility Settings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2 text-cyan-200">Font Size</label>
                            <select
                              value={currentUser.accessibility_settings.fontSize}
                              onChange={(e) => setCurrentUser({
                                ...currentUser,
                                accessibility_settings: { ...currentUser.accessibility_settings, fontSize: e.target.value }
                              })}
                              className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                            >
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2 text-cyan-200">Color Scheme</label>
                            <select
                              value={currentUser.accessibility_settings.colorScheme}
                              onChange={(e) => setCurrentUser({
                                ...currentUser,
                                accessibility_settings: { ...currentUser.accessibility_settings, colorScheme: e.target.value }
                              })}
                              className="w-full border border-purple-500/30 bg-gray-700/50 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                            >
                              <option value="default">Default</option>
                              <option value="high-contrast">High Contrast</option>
                              <option value="dark">Dark</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center mt-4 p-3 rounded-lg bg-gray-700/30">
                          <input
                            type="checkbox"
                            id="voiceCommands"
                            checked={currentUser.accessibility_settings.voiceCommands}
                            onChange={(e) => setCurrentUser({
                              ...currentUser,
                              accessibility_settings: { ...currentUser.accessibility_settings, voiceCommands: e.target.checked }
                            })}
                            className="w-4 h-4 rounded focus:ring-2 accent-cyan-500"
                          />
                          <label htmlFor="voiceCommands" className="ml-3 text-sm font-medium text-purple-200">
                            Enable Voice Commands
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-6 mt-6 border-t border-purple-500/20">
                      <button
                        onClick={handleSaveUser}
                        className="flex-1 py-3 px-6 cursor-pointer rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-cyan-500/30"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setShowEditModal(false)}
                        className="flex-1 py-3 px-6 cursor-pointer rounded-xl font-semibold border border-purple-500/30 bg-gray-700/50 hover:bg-gray-700 hover:border-purple-500/50 transition-all duration-300 hover:scale-105"
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
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
