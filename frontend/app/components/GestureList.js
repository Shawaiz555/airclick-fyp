// components/GestureList.js
import { useState } from 'react';

export default function GestureList({ gestures, onDelete, onEdit }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAction, setEditAction] = useState('');

  const actions = [
    { id: 'play-pause', name: 'Play/Pause Media' },
    { id: 'volume-up', name: 'Volume Up' },
    { id: 'volume-down', name: 'Volume Down' },
    { id: 'next-track', name: 'Next Track' },
    { id: 'prev-track', name: 'Previous Track' },
    { id: 'open-app', name: 'Open App' },
    { id: 'mute', name: 'Mute Microphone' },
    { id: 'screenshot', name: 'Take Screenshot' },
  ];

  const startEditing = (gesture) => {
    setEditingId(gesture.id);
    setEditName(gesture.name);
    setEditAction(gesture.action);
  };

  const saveEdit = () => {
    onEdit(editingId, { name: editName, action: editAction });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  if (gestures.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="inline-block p-6 bg-gray-800/30 rounded-2xl border border-dashed border-cyan-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-cyan-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="text-xl font-medium mt-4 mb-2">No gestures recorded yet</h3>
          <p className="text-cyan-300 max-w-md mx-auto">
            Click Record New Gesture to create your first custom gesture
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {gestures.map((gesture) => (
        <div 
          key={gesture.id}
          className="bg-gray-800/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-cyan-500/20 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-lg hover:shadow-cyan-500/10"
        >
          <div className="p-5">
            {editingId === gesture.id ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                <select
                  value={editAction}
                  onChange={(e) => setEditAction(e.target.value)}
                  className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  {actions.map(action => (
                    <option key={action.id} value={action.id}>{action.name}</option>
                  ))}
                </select>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="flex-1 py-2 bg-gray-700 rounded-lg font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                      {gesture.name}
                    </h3>
                    <p className="text-cyan-300 text-sm mt-1">
                      {actions.find(a => a.id === gesture.action)?.name || gesture.action}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(gesture)}
                      className="p-2 rounded-lg hover:bg-cyan-500/10 transition-colors"
                      title="Edit"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(gesture.id)}
                      className="p-2 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Delete"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center text-sm text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {new Date(gesture.timestamp).toLocaleDateString()}
                </div>
                
                <div className="mt-4 flex items-center text-sm text-gray-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Stored locally & synced to cloud</span>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}