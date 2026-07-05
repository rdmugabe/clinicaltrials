'use client';

import type { Study, StudyStatus, TrialContact } from '@/types';

interface TrialCardProps {
  study: Study;
  onSelect?: (nctId: string) => void;
  onAddToContacts?: (contact: Omit<TrialContact, 'id' | 'addedAt'>) => void;
  isInContacts?: boolean;
}

const statusColors: Record<StudyStatus, string> = {
  RECRUITING: 'bg-green-100 text-green-800',
  NOT_YET_RECRUITING: 'bg-yellow-100 text-yellow-800',
  ENROLLING_BY_INVITATION: 'bg-blue-100 text-blue-800',
  ACTIVE_NOT_RECRUITING: 'bg-purple-100 text-purple-800',
  SUSPENDED: 'bg-orange-100 text-orange-800',
  TERMINATED: 'bg-red-100 text-red-800',
  COMPLETED: 'bg-gray-100 text-gray-800',
  WITHDRAWN: 'bg-red-100 text-red-800',
  UNKNOWN: 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<StudyStatus, string> = {
  RECRUITING: 'Recruiting',
  NOT_YET_RECRUITING: 'Not Yet Recruiting',
  ENROLLING_BY_INVITATION: 'Enrolling by Invitation',
  ACTIVE_NOT_RECRUITING: 'Active, Not Recruiting',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
  COMPLETED: 'Completed',
  WITHDRAWN: 'Withdrawn',
  UNKNOWN: 'Unknown',
};

export default function TrialCard({ study, onSelect, onAddToContacts, isInContacts }: TrialCardProps) {
  const { identificationModule, statusModule, conditionsModule, designModule, contactsLocationsModule, sponsorCollaboratorsModule } =
    study.protocolSection;

  const status = statusModule.overallStatus;
  const phases = designModule?.phases || [];
  const conditions = conditionsModule?.conditions || [];
  const locations = contactsLocationsModule?.locations || [];
  const enrollment = designModule?.enrollmentInfo?.count;

  const formatPhase = (phase: string) => {
    if (phase === 'NA') return 'N/A';
    return phase.replace('_', ' ').replace('PHASE', 'Phase ').replace('EARLY ', 'Early ');
  };

  const formatLocation = (loc: typeof locations[0]) => {
    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-100"
      onClick={() => onSelect?.(identificationModule.nctId)}
    >
      <div className="flex justify-between items-start mb-3">
        <span className="text-sm font-mono text-gray-500">{identificationModule.nctId}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
        {identificationModule.briefTitle}
      </h3>

      {conditions.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {conditions.slice(0, 3).map((condition, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-primary-50 text-primary-700 rounded text-xs"
              >
                {condition}
              </span>
            ))}
            {conditions.length > 3 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                +{conditions.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
        {phases.length > 0 && (
          <div>
            <span className="font-medium">Phase:</span>{' '}
            {phases.map(formatPhase).join(', ')}
          </div>
        )}
        {enrollment !== undefined && (
          <div>
            <span className="font-medium">Enrollment:</span> {enrollment.toLocaleString()}
          </div>
        )}
      </div>

      {locations.length > 0 && (
        <div className="text-sm text-gray-600">
          <span className="font-medium">Locations:</span>{' '}
          {locations.slice(0, 2).map(formatLocation).join(' | ')}
          {locations.length > 2 && ` (+${locations.length - 2} more)`}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {study.hasResults ? 'Results Available' : 'No Results Yet'}
          </span>
          {onAddToContacts && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const contact = contactsLocationsModule?.centralContacts?.[0];
                const location = locations[0];
                onAddToContacts({
                  nctId: identificationModule.nctId,
                  trialTitle: identificationModule.briefTitle,
                  contactName: contact?.name,
                  contactEmail: contact?.email,
                  contactPhone: contact?.phone,
                  facility: location?.facility,
                  city: location?.city,
                  state: location?.state,
                  country: location?.country,
                  sponsorName: sponsorCollaboratorsModule?.leadSponsor?.name,
                });
              }}
              disabled={isInContacts}
              className={`text-xs px-2 py-1 rounded ${
                isInContacts
                  ? 'bg-gray-100 text-gray-400 cursor-default'
                  : 'bg-primary-50 text-primary-600 hover:bg-primary-100'
              }`}
            >
              {isInContacts ? 'In Contacts' : '+ Add Contact'}
            </button>
          )}
        </div>
        <a
          href={`https://clinicaltrials.gov/study/${identificationModule.nctId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
        >
          View on ClinicalTrials.gov
        </a>
      </div>
    </div>
  );
}
