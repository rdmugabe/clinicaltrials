'use client';

import { useState, useEffect } from 'react';
import type {
  ResearchAlert,
  AlertNotification,
  AlertStats,
  ServiceStatus,
  SearchParams,
  NotificationChannel,
  AlertFrequency,
  StudyStatus,
  StudyPhase,
} from '@/types';
import {
  getAlerts,
  getAlertStats,
  getAlertNotifications,
  createAlert,
  updateAlert,
  toggleAlert,
  triggerAlertCheck,
  deleteAlert,
  testNotification,
} from '@/lib/api';

interface AlertsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearchParams?: SearchParams;
}

type Tab = 'alerts' | 'create' | 'notifications';

const frequencyLabels: Record<AlertFrequency, string> = {
  hourly: 'Every hour',
  every6hours: 'Every 6 hours',
  daily: 'Daily',
  weekly: 'Weekly',
};

const channelLabels: Record<NotificationChannel, string> = {
  email: 'Email only',
  sms: 'SMS only',
  both: 'Email & SMS',
};

const statusOptions: { value: StudyStatus; label: string }[] = [
  { value: 'RECRUITING', label: 'Recruiting' },
  { value: 'NOT_YET_RECRUITING', label: 'Not Yet Recruiting' },
  { value: 'ENROLLING_BY_INVITATION', label: 'Enrolling by Invitation' },
  { value: 'ACTIVE_NOT_RECRUITING', label: 'Active, Not Recruiting' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'WITHDRAWN', label: 'Withdrawn' },
];

const phaseOptions: { value: StudyPhase; label: string }[] = [
  { value: 'EARLY_PHASE1', label: 'Early Phase 1' },
  { value: 'PHASE1', label: 'Phase 1' },
  { value: 'PHASE2', label: 'Phase 2' },
  { value: 'PHASE3', label: 'Phase 3' },
  { value: 'PHASE4', label: 'Phase 4' },
  { value: 'NA', label: 'Not Applicable' },
];

export default function AlertsPanel({ isOpen, onClose, initialSearchParams }: AlertsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('alerts');
  const [alerts, setAlerts] = useState<ResearchAlert[]>([]);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);

  // Create form state
  const [alertName, setAlertName] = useState('');
  const [channels, setChannels] = useState<NotificationChannel>('both');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [frequency, setFrequency] = useState<AlertFrequency>('hourly');
  const [creating, setCreating] = useState(false);

  // Search criteria state
  const [condition, setCondition] = useState(initialSearchParams?.condition || '');
  const [intervention, setIntervention] = useState(initialSearchParams?.intervention || '');
  const [location, setLocation] = useState(initialSearchParams?.location || '');
  const [sponsor, setSponsor] = useState(initialSearchParams?.sponsor || '');
  const [term, setTerm] = useState(initialSearchParams?.term || '');
  const [selectedStatus, setSelectedStatus] = useState<StudyStatus[]>(initialSearchParams?.status || []);
  const [selectedPhase, setSelectedPhase] = useState<StudyPhase[]>(initialSearchParams?.phase || []);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Build search params from form state
  const buildSearchParams = (): SearchParams => {
    const params: SearchParams = {};
    if (condition) params.condition = condition;
    if (intervention) params.intervention = intervention;
    if (location) params.location = location;
    if (sponsor) params.sponsor = sponsor;
    if (term) params.term = term;
    if (selectedStatus.length > 0) params.status = selectedStatus;
    if (selectedPhase.length > 0) params.phase = selectedPhase;
    return params;
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialSearchParams) {
      setCondition(initialSearchParams.condition || '');
      setIntervention(initialSearchParams.intervention || '');
      setLocation(initialSearchParams.location || '');
      setSponsor(initialSearchParams.sponsor || '');
      setTerm(initialSearchParams.term || '');
      setSelectedStatus(initialSearchParams.status || []);
      setSelectedPhase(initialSearchParams.phase || []);
    }
  }, [initialSearchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [alertsRes, statsRes, notificationsRes] = await Promise.all([
        getAlerts(),
        getAlertStats(),
        getAlertNotifications(),
      ]);
      setAlerts(alertsRes.alerts);
      setStats(statsRes.stats);
      setServiceStatus(statsRes.serviceStatus);
      setNotifications(notificationsRes.notifications);
    } catch (error) {
      console.error('Failed to load alerts data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!alertName.trim()) {
      alert('Please enter an alert name');
      return;
    }
    if ((channels === 'email' || channels === 'both') && !email) {
      alert('Please enter an email address');
      return;
    }
    if ((channels === 'sms' || channels === 'both') && !phone) {
      alert('Please enter a phone number');
      return;
    }

    setCreating(true);
    try {
      await createAlert({
        name: alertName.trim(),
        searchParams: buildSearchParams(),
        notificationChannels: channels,
        email: email || undefined,
        phone: phone || undefined,
        frequency,
      });

      // Reset form
      setAlertName('');
      setCondition('');
      setIntervention('');
      setLocation('');
      setSponsor('');
      setTerm('');
      setSelectedStatus([]);
      setSelectedPhase([]);
      setEmail('');
      setPhone('');
      setFrequency('hourly');
      setShowAdvanced(false);

      // Reload data
      await loadData();
      setActiveTab('alerts');
    } catch (error: any) {
      alert(error.message || 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await toggleAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (error) {
      console.error('Failed to toggle alert:', error);
    }
  };

  const handleCheck = async (id: string) => {
    setChecking(id);
    try {
      const result = await triggerAlertCheck(id);
      if (result.newTrialsCount > 0) {
        alert(`Found ${result.newTrialsCount} new trial(s)! ${result.notificationSent ? 'Notification sent.' : ''}`);
      } else {
        alert('No new trials found.');
      }
      await loadData();
    } catch (error) {
      console.error('Failed to check alert:', error);
    } finally {
      setChecking(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert?')) return;

    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (error) {
      console.error('Failed to delete alert:', error);
    }
  };

  const handleTestNotification = async () => {
    if ((channels === 'email' || channels === 'both') && !email) {
      alert('Please enter an email address');
      return;
    }
    if ((channels === 'sms' || channels === 'both') && !phone) {
      alert('Please enter a phone number');
      return;
    }

    try {
      const result = await testNotification({ channels, email, phone });
      if (result.success) {
        alert(`Test notification sent! Email: ${result.emailSent}, SMS: ${result.smsSent}`);
      } else {
        alert(`Failed: ${result.errors.join(', ')}`);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to send test notification');
    }
  };

  const formatSearchParams = (params: SearchParams): string => {
    const parts: string[] = [];
    if (params.condition) parts.push(`Condition: ${params.condition}`);
    if (params.intervention) parts.push(`Intervention: ${params.intervention}`);
    if (params.location) parts.push(`Location: ${params.location}`);
    if (params.term) parts.push(`Keywords: ${params.term}`);
    if (params.status?.length) parts.push(`Status: ${params.status.join(', ')}`);
    if (params.phase?.length) parts.push(`Phase: ${params.phase.join(', ')}`);
    return parts.join(' | ') || 'All trials';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Research Alerts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        {/* Service Status */}
        {serviceStatus && (
          <div className="bg-gray-50 p-3 flex gap-4 text-sm border-b">
            <span className="font-medium">Services:</span>
            <span className={serviceStatus.email.configured ? 'text-green-600' : 'text-yellow-600'}>
              Email: {serviceStatus.email.configured ? 'Ready' : 'Not configured'}
            </span>
            <span className={serviceStatus.sms.configured ? 'text-green-600' : 'text-yellow-600'}>
              SMS: {serviceStatus.sms.configured ? 'Ready' : 'Not configured'}
            </span>
            {stats && (
              <>
                <span className="text-gray-400">|</span>
                <span>{stats.activeAlerts} active alert(s)</span>
                <span>{stats.recentNotifications} notification(s) today</span>
              </>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b">
          {(['alerts', 'create', 'notifications'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'create' ? 'Create Alert' : tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : (
            <>
              {/* Alerts Tab */}
              {activeTab === 'alerts' && (
                <div>
                  {alerts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No alerts configured yet.</p>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="mt-4 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
                      >
                        Create Your First Alert
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`border rounded-lg p-4 ${alert.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-semibold text-lg">{alert.name}</h3>
                              <p className="text-sm text-gray-600">{formatSearchParams(alert.searchParams)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs ${alert.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                {alert.isActive ? 'Active' : 'Paused'}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-medium">Frequency:</span> {frequencyLabels[alert.frequency]}
                            </div>
                            <div>
                              <span className="font-medium">Via:</span> {channelLabels[alert.notificationChannels]}
                            </div>
                            <div>
                              <span className="font-medium">Matches:</span> {alert.matchCount}
                            </div>
                            <div>
                              <span className="font-medium">Seen:</span> {alert.seenTrialIds.length}
                            </div>
                          </div>

                          {alert.lastChecked && (
                            <p className="text-xs text-gray-400 mb-3">
                              Last checked: {new Date(alert.lastChecked).toLocaleString()}
                              {alert.lastNotified && ` | Last notified: ${new Date(alert.lastNotified).toLocaleString()}`}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggle(alert.id)}
                              className={`px-3 py-1 rounded text-sm ${alert.isActive ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                            >
                              {alert.isActive ? 'Pause' : 'Resume'}
                            </button>
                            <button
                              onClick={() => handleCheck(alert.id)}
                              disabled={checking === alert.id}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
                            >
                              {checking === alert.id ? 'Checking...' : 'Check Now'}
                            </button>
                            <button
                              onClick={() => handleDelete(alert.id)}
                              className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create Tab */}
              {activeTab === 'create' && (
                <div className="max-w-lg">
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alert Name *</label>
                    <input
                      type="text"
                      value={alertName}
                      onChange={(e) => setAlertName(e.target.value)}
                      placeholder="e.g., Cancer Phase 3 Recruiting"
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>

                  {/* Search Criteria Section */}
                  <div className="mb-6 border rounded-lg p-4 bg-gray-50">
                    <h3 className="font-medium text-gray-800 mb-4">Search Criteria</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Condition / Disease
                        </label>
                        <input
                          type="text"
                          value={condition}
                          onChange={(e) => setCondition(e.target.value)}
                          placeholder="e.g., diabetes, cancer"
                          className="w-full px-3 py-2 border rounded-md bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Intervention / Treatment
                        </label>
                        <input
                          type="text"
                          value={intervention}
                          onChange={(e) => setIntervention(e.target.value)}
                          placeholder="e.g., drug name, therapy"
                          className="w-full px-3 py-2 border rounded-md bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Location
                        </label>
                        <input
                          type="text"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder="e.g., New York, USA"
                          className="w-full px-3 py-2 border rounded-md bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Keywords
                        </label>
                        <input
                          type="text"
                          value={term}
                          onChange={(e) => setTerm(e.target.value)}
                          placeholder="General search terms"
                          className="w-full px-3 py-2 border rounded-md bg-white"
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
                      <div className="border-t pt-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sponsor
                          </label>
                          <input
                            type="text"
                            value={sponsor}
                            onChange={(e) => setSponsor(e.target.value)}
                            placeholder="e.g., NIH, Pfizer"
                            className="w-full px-3 py-2 border rounded-md bg-white"
                          />
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Study Status</label>
                          <div className="flex flex-wrap gap-2">
                            {statusOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSelectedStatus((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((s) => s !== option.value)
                                      : [...prev, option.value]
                                  );
                                }}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  selectedStatus.includes(option.value)
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-white text-gray-700 border hover:bg-gray-100'
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
                            {phaseOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setSelectedPhase((prev) =>
                                    prev.includes(option.value)
                                      ? prev.filter((p) => p !== option.value)
                                      : [...prev, option.value]
                                  );
                                }}
                                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                                  selectedPhase.includes(option.value)
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-white text-gray-700 border hover:bg-gray-100'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Preview of current criteria */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium">Current criteria: </span>
                        {formatSearchParams(buildSearchParams()) || 'All trials (no filters)'}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check Frequency *</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as AlertFrequency)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="hourly">Every hour</option>
                      <option value="every6hours">Every 6 hours</option>
                      <option value="daily">Daily (9 AM)</option>
                      <option value="weekly">Weekly (Monday 9 AM)</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notification Method *</label>
                    <select
                      value={channels}
                      onChange={(e) => setChannels(e.target.value as NotificationChannel)}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      <option value="both">Email & SMS</option>
                      <option value="email">Email only</option>
                      <option value="sms">SMS only</option>
                    </select>
                  </div>

                  {(channels === 'email' || channels === 'both') && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  )}

                  {(channels === 'sms' || channels === 'both') && (
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateAlert}
                      disabled={creating}
                      className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : 'Create Alert'}
                    </button>
                    <button
                      onClick={handleTestNotification}
                      className="px-4 py-2 border rounded-md hover:bg-gray-50"
                    >
                      Test Notification
                    </button>
                  </div>
                </div>
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div>
                  {notifications.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No notifications sent yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="border rounded-md p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium">{notification.alertName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${notification.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {notification.success ? 'Sent' : 'Failed'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {notification.trialCount} new trial(s) found
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(notification.sentAt).toLocaleString()} via {notification.sentVia.join(' & ')}
                            {notification.errorMessage && (
                              <span className="text-red-500 ml-2">{notification.errorMessage}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
