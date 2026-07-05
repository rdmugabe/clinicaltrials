'use client';

import { useState, useEffect } from 'react';
import type { SearchParams, FilterOptions, StudyStatus, StudyPhase, SortOption } from '@/types';
import { getFilterOptions } from '@/lib/api';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading?: boolean;
  initialParams?: SearchParams;
}

export default function SearchForm({ onSearch, isLoading, initialParams }: SearchFormProps) {
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [condition, setCondition] = useState(initialParams?.condition || '');
  const [intervention, setIntervention] = useState(initialParams?.intervention || '');
  const [location, setLocation] = useState(initialParams?.location || '');
  const [sponsor, setSponsor] = useState(initialParams?.sponsor || '');
  const [term, setTerm] = useState(initialParams?.term || '');
  const [selectedStatus, setSelectedStatus] = useState<StudyStatus[]>(initialParams?.status || []);
  const [selectedPhase, setSelectedPhase] = useState<StudyPhase[]>(initialParams?.phase || []);
  const [sort, setSort] = useState<SortOption>(initialParams?.sort || 'LastUpdatePostDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialParams?.sortOrder || 'desc');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    getFilterOptions().then(setFilterOptions).catch(console.error);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const params: SearchParams = {};
    if (condition) params.condition = condition;
    if (intervention) params.intervention = intervention;
    if (location) params.location = location;
    if (sponsor) params.sponsor = sponsor;
    if (term) params.term = term;
    if (selectedStatus.length) params.status = selectedStatus;
    if (selectedPhase.length) params.phase = selectedPhase;
    params.sort = sort;
    params.sortOrder = sortOrder;

    onSearch(params);
  };

  const handleStatusToggle = (status: StudyStatus) => {
    setSelectedStatus((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const handlePhaseToggle = (phase: StudyPhase) => {
    setSelectedPhase((prev) =>
      prev.includes(phase)
        ? prev.filter((p) => p !== phase)
        : [...prev, phase]
    );
  };

  const handleClear = () => {
    setCondition('');
    setIntervention('');
    setLocation('');
    setSponsor('');
    setTerm('');
    setSelectedStatus([]);
    setSelectedPhase([]);
    setSort('LastUpdatePostDate');
    setSortOrder('desc');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="condition" className="block text-sm font-medium text-gray-700 mb-1">
            Condition / Disease
          </label>
          <input
            type="text"
            id="condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="e.g., diabetes, cancer, heart disease"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="intervention" className="block text-sm font-medium text-gray-700 mb-1">
            Intervention / Treatment
          </label>
          <input
            type="text"
            id="intervention"
            value={intervention}
            onChange={(e) => setIntervention(e.target.value)}
            placeholder="e.g., drug name, therapy type"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g., New York, California, USA"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="term" className="block text-sm font-medium text-gray-700 mb-1">
            Keywords
          </label>
          <input
            type="text"
            id="term"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="General search terms"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-primary-600 hover:text-primary-800 text-sm font-medium mb-4"
      >
        {showAdvanced ? '- Hide Advanced Filters' : '+ Show Advanced Filters'}
      </button>

      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="sponsor" className="block text-sm font-medium text-gray-700 mb-1">
                Sponsor
              </label>
              <input
                type="text"
                id="sponsor"
                value={sponsor}
                onChange={(e) => setSponsor(e.target.value)}
                placeholder="e.g., NIH, Pfizer"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <div className="flex gap-2">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortOption)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {filterOptions?.sort.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Study Status</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions?.status.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleStatusToggle(option.value as StudyStatus)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedStatus.includes(option.value as StudyStatus)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Study Phase</label>
            <div className="flex flex-wrap gap-2">
              {filterOptions?.phase.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePhaseToggle(option.value as StudyPhase)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedPhase.includes(option.value as StudyPhase)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search Trials'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
