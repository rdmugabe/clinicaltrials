'use client';

import { useEffect, useState } from 'react';
import type { SavedSearch, SearchParams } from '@/types';
import { getSavedSearches, createSavedSearch, deleteSavedSearch } from '@/lib/api';

interface SavedSearchesProps {
  currentParams: SearchParams;
  onLoadSearch: (params: SearchParams) => void;
}

export default function SavedSearches({ currentParams, onLoadSearch }: SavedSearchesProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSearches = async () => {
    try {
      const data = await getSavedSearches();
      setSearches(data.searches);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSearches();
  }, []);

  const handleSave = async () => {
    if (!saveName.trim()) return;

    setSaving(true);
    try {
      await createSavedSearch(saveName.trim(), currentParams);
      setSaveName('');
      setShowSaveModal(false);
      loadSearches();
    } catch (error) {
      console.error('Failed to save search:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this saved search?')) return;

    try {
      await deleteSavedSearch(id);
      setSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  const formatParams = (params: SearchParams): string => {
    const parts: string[] = [];
    if (params.condition) parts.push(`Condition: ${params.condition}`);
    if (params.intervention) parts.push(`Intervention: ${params.intervention}`);
    if (params.location) parts.push(`Location: ${params.location}`);
    if (params.term) parts.push(`Keywords: ${params.term}`);
    if (params.status?.length) parts.push(`Status: ${params.status.join(', ')}`);
    if (params.phase?.length) parts.push(`Phase: ${params.phase.join(', ')}`);
    return parts.join(' | ') || 'No filters';
  };

  const hasCurrentParams = Object.keys(currentParams).some(
    (key) => {
      const value = currentParams[key as keyof SearchParams];
      if (Array.isArray(value)) return value.length > 0;
      return Boolean(value);
    }
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Saved Searches</h2>
        {hasCurrentParams && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="text-sm bg-primary-600 text-white px-3 py-1 rounded-md hover:bg-primary-700"
          >
            Save Current Search
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading saved searches...</div>
      ) : searches.length === 0 ? (
        <div className="text-gray-500 text-sm">
          No saved searches yet. Perform a search and save it for quick access later.
        </div>
      ) : (
        <div className="space-y-2">
          {searches.map((search) => (
            <div
              key={search.id}
              className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => onLoadSearch(search.params)}
                    className="font-medium text-primary-600 hover:text-primary-800 text-left"
                  >
                    {search.name}
                  </button>
                  <p className="text-xs text-gray-500 truncate mt-1">
                    {formatParams(search.params)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(search.id)}
                  className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Save Search</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Enter a name for this search"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4"
              autoFocus
            />
            <div className="bg-gray-50 p-3 rounded-md mb-4">
              <p className="text-sm text-gray-600">{formatParams(currentParams)}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={!saveName.trim() || saving}
                className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveName('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
