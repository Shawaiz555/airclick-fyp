/**
 * AirClick - Admin Action Mappings Management
 * ============================================
 *
 * This page allows administrators to manage keyboard shortcut actions
 * that can be assigned to gestures. Supports dynamic key combinations.
 *
 * Features:
 * - Create actions with 1-10+ keyboard keys
 * - Edit/delete existing actions
 * - Search and filter by context/category/status
 * - View statistics dashboard
 * - Dynamic key input (add/remove keys)
 * - Real-time validation
 *
 * Author: Muhammad Shawaiz
 * Project: AirClick FYP
 */

'use client';

import { useState, useEffect } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function ActionMappingsManagement() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actions, setActions] = useState([]);
  const [statistics, setStatistics] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionToDelete, setActionToDelete] = useState(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterContext, setFilterContext] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'

  // Form state
  const [formData, setFormData] = useState({
    action_id: '',
    name: '',
    description: '',
    app_context: 'GLOBAL',
    category: 'SYSTEM',
    keyboard_keys: [''],
    icon: '',
    is_active: true
  });
  const [formErrors, setFormErrors] = useState({});

  // Constants
  const APP_CONTEXTS = ['GLOBAL', 'POWERPOINT', 'WORD', 'BROWSER', 'MEDIA'];
  const CATEGORIES = ['NAVIGATION', 'EDITING', 'FORMATTING', 'MEDIA_CONTROL', 'SYSTEM'];

  // Valid keyboard keys for validation
  const VALID_KEYS = [
    // Modifiers
    'ctrl', 'alt', 'shift', 'win', 'cmd', 'option', 'command',
    // Letters
    ...'abcdefghijklmnopqrstuvwxyz'.split(''),
    // Numbers
    ...'0123456789'.split(''),
    // Function keys
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
    // Navigation
    'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
    // Special
    'enter', 'return', 'tab', 'space', 'backspace', 'delete', 'escape', 'esc',
    // Media
    'playpause', 'play', 'pause', 'stop', 'nexttrack', 'prevtrack',
    'volumeup', 'volumedown', 'volumemute', 'mute',
    // Punctuation
    ',', '.', '/', ';', "'", '[', ']', '\\', '-', '=',
    '<', '>', '?', ':', '"', '{', '}', '|', '_', '+'
  ];

  // ============================================================
  // DATA FETCHING
  // ============================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadActions(), loadStatistics()]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadActions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/action-mappings/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setActions(data.actions || []);
      } else {
        throw new Error('Failed to fetch actions');
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      toast.error('Failed to load actions');
    }
  };

  const loadStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/action-mappings/statistics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const handleOpenModal = (action = null) => {
    if (action) {
      // Edit mode
      setIsEditing(true);
      setFormData({
        action_id: action.action_id,
        name: action.name,
        description: action.description || '',
        app_context: action.app_context,
        category: action.category || 'SYSTEM',
        keyboard_keys: action.keyboard_keys || [''],
        icon: action.icon || '',
        is_active: action.is_active
      });
    } else {
      // Create mode
      setIsEditing(false);
      setFormData({
        action_id: '',
        name: '',
        description: '',
        app_context: 'GLOBAL',
        category: 'SYSTEM',
        keyboard_keys: [''],
        icon: '',
        is_active: true
      });
    }
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      action_id: '',
      name: '',
      description: '',
      app_context: 'GLOBAL',
      category: 'SYSTEM',
      keyboard_keys: [''],
      icon: '',
      is_active: true
    });
    setFormErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleKeyChange = (index, value) => {
    const newKeys = [...formData.keyboard_keys];
    newKeys[index] = value.toLowerCase().trim();
    setFormData(prev => ({ ...prev, keyboard_keys: newKeys }));
  };

  const handleAddKey = () => {
    setFormData(prev => ({
      ...prev,
      keyboard_keys: [...prev.keyboard_keys, '']
    }));
  };

  const handleRemoveKey = (index) => {
    if (formData.keyboard_keys.length > 1) {
      const newKeys = formData.keyboard_keys.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, keyboard_keys: newKeys }));
    }
  };

  // ============================================================
  // VALIDATION
  // ============================================================

  const validateForm = () => {
    const errors = {};

    // Action ID validation
    if (!formData.action_id.trim()) {
      errors.action_id = 'Action ID is required';
    } else if (!/^[a-z0-9_]+$/.test(formData.action_id)) {
      errors.action_id = 'Action ID must be lowercase letters, numbers, and underscores only';
    }

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    // Keyboard keys validation
    const validKeys = formData.keyboard_keys.filter(k => k.trim() !== '');
    if (validKeys.length === 0) {
      errors.keyboard_keys = 'At least one keyboard key is required';
    } else {
      // Check for invalid keys
      const invalidKeys = validKeys.filter(key => !VALID_KEYS.includes(key.toLowerCase()));
      if (invalidKeys.length > 0) {
        errors.keyboard_keys = `Invalid keys: ${invalidKeys.join(', ')}`;
      }

      // Check for duplicates
      const uniqueKeys = new Set(validKeys.map(k => k.toLowerCase()));
      if (uniqueKeys.size !== validKeys.length) {
        errors.keyboard_keys = 'Duplicate keys are not allowed';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const cleanedKeys = formData.keyboard_keys.filter(k => k.trim() !== '');

      const payload = {
        action_id: formData.action_id,
        name: formData.name,
        description: formData.description,
        app_context: formData.app_context,
        category: formData.category,
        keyboard_keys: cleanedKeys,
        icon: formData.icon,
        is_active: formData.is_active
      };

      let response;
      if (isEditing) {
        // Update existing action
        response = await fetch(`http://localhost:8000/api/action-mappings/${formData.action_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        // Create new action
        response = await fetch('http://localhost:8000/api/action-mappings/', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok) {
        toast.success(isEditing ? 'Action updated successfully' : 'Action created successfully');
        handleCloseModal();
        await loadData();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save action');
      }
    } catch (error) {
      console.error('Error saving action:', error);
      toast.error('Failed to save action');
    }
  };

  const handleDelete = (action) => {
    setActionToDelete(action);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:8000/api/action-mappings/${actionToDelete.action_id}?hard_delete=false`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success('Action deactivated successfully');
        await loadData();
      } else {
        toast.error('Failed to delete action');
      }
    } catch (error) {
      console.error('Error deleting action:', error);
      toast.error('Failed to delete action');
    } finally {
      setActionToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  const handleToggleStatus = async (action) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = action.is_active ? 'deactivate' : 'activate';
      const response = await fetch(
        `http://localhost:8000/api/action-mappings/${action.action_id}/${endpoint}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success(`Action ${action.is_active ? 'deactivated' : 'activated'} successfully`);
        await loadData();
      } else {
        toast.error('Failed to toggle action status');
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Failed to toggle action status');
    }
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredActions = actions.filter(action => {
    // Search filter
    const matchesSearch = searchQuery === '' ||
      action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.action_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (action.description && action.description.toLowerCase().includes(searchQuery.toLowerCase()));

    // Context filter
    const matchesContext = filterContext === 'ALL' || action.app_context === filterContext;

    // Category filter
    const matchesCategory = filterCategory === 'ALL' || action.category === filterCategory;

    // Status filter
    const matchesStatus = filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && action.is_active) ||
      (filterStatus === 'INACTIVE' && !action.is_active);

    return matchesSearch && matchesContext && matchesCategory && matchesStatus;
  });

  // ============================================================
  // UI HELPERS
  // ============================================================

  const getContextColor = (context) => {
    const colors = {
      'GLOBAL': { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30' },
      'POWERPOINT': { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30' },
      'WORD': { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
      'BROWSER': { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
      'MEDIA': { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30' }
    };
    return colors[context] || { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/30' };
  };

  const getCategoryColor = (category) => {
    const colors = {
      'NAVIGATION': 'text-cyan-400',
      'EDITING': 'text-green-400',
      'FORMATTING': 'text-yellow-400',
      'MEDIA_CONTROL': 'text-pink-400',
      'SYSTEM': 'text-purple-400'
    };
    return colors[category] || 'text-gray-400';
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <ProtectedRoute allowedRoles={['ADMIN']}>
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 text-white">
        <AdminSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          activeTab="action-mappings"
        />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        <main className="md:ml-66 min-h-screen p-4 md:p-8">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[80vh]">
              <LoadingSpinner message="Loading actions..." size="lg" />
            </div>
          ) : (
            <div className="max-w-8xl">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                  Action Mappings
                </h1>
                <p className="text-purple-200">
                  Manage keyboard shortcut actions that can be assigned to gestures
                </p>
              </div>

              {/* Statistics Overview */}
              {statistics && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs md:text-lg font-bold text-gray-400">Total Actions</p>
                        <p className="text-xl md:text-2xl font-bold text-white">{statistics.total}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs md:text-lg font-bold text-gray-400">Active</p>
                        <p className="text-xl md:text-2xl font-bold text-white">{statistics.active}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs md:text-lg font-bold text-gray-400">Inactive</p>
                        <p className="text-xl md:text-2xl font-bold text-white">{statistics.inactive}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-800/30 backdrop-blur-md rounded-2xl p-5 py-8 md:p-6 md:py-8 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs md:text-lg font-bold text-gray-400">Contexts</p>
                        <p className="text-xl md:text-2xl font-bold text-white">{Object.keys(statistics.by_context || {}).length}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Search and Actions Bar */}
              <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-5 py-8 md:p-6 md:py-10 border border-cyan-500/20 mb-8">
                <div className="space-y-4">
                  {/* Top Row */}
                  <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder="Search actions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>

                    <button
                      onClick={() => handleOpenModal()}
                      className="flex-1 lg:flex-none px-4 md:px-6 py-3 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Add Action</span>
                    </button>
                  </div>

                  {/* Bottom Row: Filters */}
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Context Filter */}
                    <div className="flex gap-2 flex-wrap">
                      {['ALL', ...APP_CONTEXTS].map(context => (
                        <button
                          key={context}
                          onClick={() => setFilterContext(context)}
                          className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-300 hover:cursor-pointer ${
                            filterContext === context
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          {context}
                        </button>
                      ))}
                    </div>

                    {/* Status Filter */}
                    <div className="flex gap-2 border-l border-gray-700/50 pl-2">
                      {['ALL', 'ACTIVE', 'INACTIVE'].map(status => (
                        <button
                          key={status}
                          onClick={() => setFilterStatus(status)}
                          className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium transition-all duration-300 hover:cursor-pointer ${
                            filterStatus === status
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                              : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Table */}
              {filteredActions.length === 0 ? (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-white">No actions found</h3>
                    <p className="text-gray-400 mb-6">
                      {searchQuery || filterContext !== 'ALL' || filterStatus !== 'ALL'
                        ? 'Try adjusting your search or filters'
                        : 'Get started by creating your first action'}
                    </p>
                    {(!searchQuery && filterContext === 'ALL' && filterStatus === 'ALL') && (
                      <button
                        onClick={() => handleOpenModal()}
                        className="px-6 py-3 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
                      >
                        Create First Action
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-cyan-500/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-cyan-500/20 bg-gray-800/50">
                        <tr>
                          <th className="text-left p-4 font-semibold text-cyan-200">Action ID</th>
                          <th className="text-left p-4 font-semibold text-cyan-200">Name</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Context</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Keys</th>
                          <th className="text-center p-4 font-semibold text-cyan-200">Status</th>
                          <th className="text-right p-4 font-semibold text-cyan-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActions.map((action) => {
                          const contextColors = getContextColor(action.app_context);
                          return (
                            <tr key={action.id} className="border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                              <td className="p-4">
                                <div className="font-mono text-sm text-cyan-300">{action.action_id}</div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  {action.icon && <span className="text-xl">{action.icon}</span>}
                                  <div>
                                    <div className="font-medium text-white">{action.name}</div>
                                    {action.description && (
                                      <div className="text-xs text-gray-400 mt-1">{action.description}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${contextColors.bg} ${contextColors.text} border ${contextColors.border}`}>
                                  {action.app_context}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {action.keyboard_keys?.map((key, idx) => (
                                    <span key={idx} className="px-2 py-1 bg-gray-700 text-white text-xs rounded border border-gray-600 font-mono">
                                      {key}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  onClick={() => handleToggleStatus(action)}
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium hover:cursor-pointer transition-all ${
                                    action.is_active
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                >
                                  {action.is_active ? 'Active' : 'Inactive'}
                                </button>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => handleOpenModal(action)}
                                    className="p-2 rounded-lg hover:cursor-pointer hover:bg-cyan-500/10 transition-colors group"
                                    title="Edit"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(action)}
                                    className="p-2 rounded-lg hover:cursor-pointer hover:bg-rose-500/10 transition-colors group"
                                    title="Delete"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400 group-hover:text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Create/Edit Modal - Next part */}
              {isModalOpen && (
                <ActionMappingModal
                  isOpen={isModalOpen}
                  isEditing={isEditing}
                  formData={formData}
                  formErrors={formErrors}
                  onClose={handleCloseModal}
                  onSave={handleSave}
                  onInputChange={handleInputChange}
                  onKeyChange={handleKeyChange}
                  onAddKey={handleAddKey}
                  onRemoveKey={handleRemoveKey}
                  appContexts={APP_CONTEXTS}
                  categories={CATEGORIES}
                />
              )}

              {/* Delete Confirmation Modal */}
              <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => {
                  setShowDeleteConfirm(false);
                  setActionToDelete(null);
                }}
                onConfirm={confirmDelete}
                title="Delete Action"
                message={`Are you sure you want to deactivate "${actionToDelete?.name}"? This action will no longer be available to users.`}
                confirmText="Deactivate"
                cancelText="Cancel"
              />
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

// ============================================================
// ACTION MAPPING MODAL COMPONENT
// ============================================================

function ActionMappingModal({
  isOpen,
  isEditing,
  formData,
  formErrors,
  onClose,
  onSave,
  onInputChange,
  onKeyChange,
  onAddKey,
  onRemoveKey,
  appContexts,
  categories
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl bg-gray-900/90 backdrop-blur-lg rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              {isEditing ? 'Edit Action' : 'Create New Action'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:cursor-pointer hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Action ID */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-200">
                Action ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.action_id}
                onChange={(e) => onInputChange('action_id', e.target.value)}
                disabled={isEditing}
                placeholder="e.g., custom_action"
                className={`w-full bg-gray-800/50 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 ${
                  formErrors.action_id ? 'border-red-500' : 'border-cyan-500/30'
                } ${isEditing ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              {formErrors.action_id && (
                <p className="mt-1 text-sm text-red-400">{formErrors.action_id}</p>
              )}
              {!isEditing && (
                <p className="mt-1 text-xs text-gray-400">Lowercase letters, numbers, and underscores only</p>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-200">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => onInputChange('name', e.target.value)}
                placeholder="e.g., Next Slide"
                className={`w-full bg-gray-800/50 border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 ${
                  formErrors.name ? 'border-red-500' : 'border-cyan-500/30'
                }`}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-400">{formErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-200">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => onInputChange('description', e.target.value)}
                placeholder="e.g., Advance to the next slide"
                rows={2}
                className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              />
            </div>

            {/* Context and Category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-200">Context</label>
                <select
                  value={formData.app_context}
                  onChange={(e) => onInputChange('app_context', e.target.value)}
                  className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                >
                  {appContexts.map(context => (
                    <option key={context} value={context}>{context}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-cyan-200">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => onInputChange('category', e.target.value)}
                  className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyboard Keys (Dynamic) */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-200">
                Keyboard Keys <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {formData.keyboard_keys.map((key, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => onKeyChange(index, e.target.value)}
                      placeholder={`Key ${index + 1} (e.g., ctrl, shift, p)`}
                      className={`flex-1 bg-gray-800/50 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500 ${
                        formErrors.keyboard_keys ? 'border-red-500' : 'border-cyan-500/30'
                      }`}
                    />
                    {formData.keyboard_keys.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onRemoveKey(index)}
                        className="px-3 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 rounded-lg text-rose-300 transition-colors hover:cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={onAddKey}
                  className="w-full py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-300 transition-colors hover:cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Another Key
                </button>
              </div>
              {formErrors.keyboard_keys && (
                <p className="mt-1 text-sm text-red-400">{formErrors.keyboard_keys}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">Valid keys: ctrl, alt, shift, win, a-z, 0-9, f1-f12, arrows, media keys, etc.</p>
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium mb-2 text-cyan-200">Icon (Emoji)</label>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => onInputChange('icon', e.target.value)}
                placeholder="e.g., →, ⏯, 🔊"
                maxLength={10}
                className="w-full bg-gray-800/50 border border-cyan-500/30 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-white placeholder-gray-500"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => onInputChange('is_active', e.target.checked)}
                className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
              />
              <label htmlFor="is_active" className="ml-2 text-sm font-medium text-gray-300">Active</label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-6 mt-6 border-t border-gray-700/50">
            <button
              onClick={onSave}
              className="flex-1 py-3 px-6 hover:cursor-pointer bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 transition-all duration-300"
            >
              {isEditing ? 'Update Action' : 'Create Action'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 px-6 hover:cursor-pointer bg-gray-700 rounded-xl font-medium hover:bg-gray-600 transition-all duration-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
