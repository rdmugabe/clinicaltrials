'use client';

import { useEffect, useState } from 'react';
import type { Study, StudyStatus } from '@/types';
import { getStudy } from '@/lib/api';

interface TrialDetailProps {
  nctId: string;
  onClose: () => void;
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

export default function TrialDetail({ nctId, onClose }: TrialDetailProps) {
  const [study, setStudy] = useState<Study | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    getStudy(nctId)
      .then(setStudy)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [nctId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading study details...</p>
        </div>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <p className="text-red-600 mb-4">{error || 'Failed to load study'}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const {
    identificationModule,
    statusModule,
    descriptionModule,
    conditionsModule,
    designModule,
    eligibilityModule,
    armsInterventionsModule,
    contactsLocationsModule,
    sponsorCollaboratorsModule,
  } = study.protocolSection;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-start">
          <div>
            <span className="text-sm font-mono text-gray-500">{identificationModule.nctId}</span>
            <span
              className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${statusColors[statusModule.overallStatus]}`}
            >
              {statusModule.overallStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {identificationModule.briefTitle}
          </h2>
          {identificationModule.officialTitle && (
            <p className="text-gray-600 mb-4">{identificationModule.officialTitle}</p>
          )}

          {/* Summary */}
          {descriptionModule?.briefSummary && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Summary</h3>
              <p className="text-gray-600 whitespace-pre-line">{descriptionModule.briefSummary}</p>
            </section>
          )}

          {/* Study Details */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Study Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {designModule?.phases && (
                <div>
                  <span className="font-medium text-gray-700">Phase:</span>{' '}
                  <span className="text-gray-600">
                    {designModule.phases.map((p) => p.replace('_', ' ')).join(', ')}
                  </span>
                </div>
              )}
              {designModule?.enrollmentInfo?.count && (
                <div>
                  <span className="font-medium text-gray-700">Enrollment:</span>{' '}
                  <span className="text-gray-600">
                    {designModule.enrollmentInfo.count.toLocaleString()}
                  </span>
                </div>
              )}
              {statusModule.startDateStruct?.date && (
                <div>
                  <span className="font-medium text-gray-700">Start Date:</span>{' '}
                  <span className="text-gray-600">{statusModule.startDateStruct.date}</span>
                </div>
              )}
              {statusModule.primaryCompletionDateStruct?.date && (
                <div>
                  <span className="font-medium text-gray-700">Completion Date:</span>{' '}
                  <span className="text-gray-600">
                    {statusModule.primaryCompletionDateStruct.date}
                  </span>
                </div>
              )}
              {sponsorCollaboratorsModule?.leadSponsor?.name && (
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">Lead Sponsor:</span>{' '}
                  <span className="text-gray-600">
                    {sponsorCollaboratorsModule.leadSponsor.name}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Conditions */}
          {conditionsModule?.conditions && conditionsModule.conditions.length > 0 && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Conditions</h3>
              <div className="flex flex-wrap gap-2">
                {conditionsModule.conditions.map((condition, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                  >
                    {condition}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Interventions */}
          {armsInterventionsModule?.interventions &&
            armsInterventionsModule.interventions.length > 0 && (
              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Interventions</h3>
                <div className="space-y-3">
                  {armsInterventionsModule.interventions.map((intervention, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-md">
                      <div className="font-medium text-gray-800">
                        {intervention.name}
                        <span className="ml-2 text-xs text-gray-500 font-normal">
                          ({intervention.type})
                        </span>
                      </div>
                      {intervention.description && (
                        <p className="text-sm text-gray-600 mt-1">{intervention.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Eligibility */}
          {eligibilityModule && (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Eligibility</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                {eligibilityModule.sex && (
                  <div>
                    <span className="font-medium text-gray-700">Sex:</span>{' '}
                    <span className="text-gray-600">{eligibilityModule.sex}</span>
                  </div>
                )}
                {eligibilityModule.minimumAge && (
                  <div>
                    <span className="font-medium text-gray-700">Minimum Age:</span>{' '}
                    <span className="text-gray-600">{eligibilityModule.minimumAge}</span>
                  </div>
                )}
                {eligibilityModule.maximumAge && (
                  <div>
                    <span className="font-medium text-gray-700">Maximum Age:</span>{' '}
                    <span className="text-gray-600">{eligibilityModule.maximumAge}</span>
                  </div>
                )}
                {eligibilityModule.healthyVolunteers !== undefined && (
                  <div>
                    <span className="font-medium text-gray-700">Healthy Volunteers:</span>{' '}
                    <span className="text-gray-600">
                      {eligibilityModule.healthyVolunteers ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
              {eligibilityModule.eligibilityCriteria && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="font-medium text-gray-700 mb-2">Eligibility Criteria</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-line">
                    {eligibilityModule.eligibilityCriteria}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Locations */}
          {contactsLocationsModule?.locations &&
            contactsLocationsModule.locations.length > 0 && (
              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Locations ({contactsLocationsModule.locations.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                  {contactsLocationsModule.locations.map((location, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-md text-sm">
                      {location.facility && (
                        <div className="font-medium text-gray-800">{location.facility}</div>
                      )}
                      <div className="text-gray-600">
                        {[location.city, location.state, location.country]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

          {/* Contacts */}
          {contactsLocationsModule?.centralContacts &&
            contactsLocationsModule.centralContacts.length > 0 && (
              <section className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Contact Information</h3>
                <div className="space-y-2">
                  {contactsLocationsModule.centralContacts.map((contact, idx) => (
                    <div key={idx} className="text-sm">
                      {contact.name && <div className="font-medium">{contact.name}</div>}
                      {contact.phone && (
                        <div className="text-gray-600">Phone: {contact.phone}</div>
                      )}
                      {contact.email && (
                        <div>
                          <a
                            href={`mailto:${contact.email}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            {contact.email}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <a
              href={`https://clinicaltrials.gov/study/${identificationModule.nctId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 text-center"
            >
              View on ClinicalTrials.gov
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
