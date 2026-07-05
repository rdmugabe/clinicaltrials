'use client';

import { useState, useEffect } from 'react';
import type {
  TrialContact,
  OutreachRecord,
  EmailTemplate,
  EmailStats,
  OrganizationSettings,
} from '@/types';
import {
  getContacts,
  deleteContact,
  getTemplates,
  getOutreachHistory,
  getOutreachStats,
  sendEmail,
  sendBulkEmails,
  previewEmail,
  getOrganizationSettings,
  updateOrganizationSettings,
  getEmailServiceStatus,
} from '@/lib/api';

type Tab = 'contacts' | 'compose' | 'history' | 'templates' | 'settings';

interface OutreachPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  opened: 'bg-purple-100 text-purple-800',
  replied: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  bounced: 'bg-orange-100 text-orange-800',
};

export default function OutreachPanel({ isOpen, onClose }: OutreachPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('contacts');
  const [contacts, setContacts] = useState<TrialContact[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [history, setHistory] = useState<OutreachRecord[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [loading, setLoading] = useState(false);

  // Compose state
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [previewHtml, setPreviewHtml] = useState<{ subject: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsRes, templatesRes, historyRes, statsRes, settingsRes, emailStatus] =
        await Promise.all([
          getContacts(),
          getTemplates(),
          getOutreachHistory(),
          getOutreachStats(),
          getOrganizationSettings(),
          getEmailServiceStatus(),
        ]);
      setContacts(contactsRes.contacts);
      setTemplates(templatesRes.templates);
      setHistory(historyRes.records);
      setStats(statsRes);
      setSettings(settingsRes);
      setEmailConfigured(emailStatus.configured);
    } catch (error) {
      console.error('Failed to load outreach data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Remove this contact from your list?')) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
      setSelectedContacts((prev) => prev.filter((cid) => cid !== id));
    } catch (error) {
      console.error('Failed to delete contact:', error);
    }
  };

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setEmailSubject(template.subject);
      setEmailBody(template.body);
    }
  };

  const handlePreview = async () => {
    try {
      const result = await previewEmail({
        contactId: selectedContacts[0],
        templateId: selectedTemplate || undefined,
        subject: emailSubject,
        body: emailBody,
        variables: { customMessage },
      });
      setPreviewHtml(result);
    } catch (error) {
      console.error('Preview failed:', error);
    }
  };

  const handleSend = async () => {
    if (selectedContacts.length === 0) {
      alert('Please select at least one contact');
      return;
    }
    if (!emailSubject || !emailBody) {
      alert('Please enter a subject and body');
      return;
    }

    setSending(true);
    try {
      if (selectedContacts.length === 1) {
        await sendEmail({
          contactId: selectedContacts[0],
          templateId: selectedTemplate || undefined,
          subject: emailSubject,
          body: emailBody,
          variables: { customMessage },
        });
        alert('Email sent successfully!');
      } else {
        const result = await sendBulkEmails({
          contactIds: selectedContacts,
          templateId: selectedTemplate || undefined,
          subject: emailSubject,
          body: emailBody,
          variables: { customMessage },
        });
        alert(`Sent: ${result.sent}, Failed: ${result.failed}, Skipped: ${result.skipped}`);
      }

      // Refresh history and stats
      const [historyRes, statsRes] = await Promise.all([
        getOutreachHistory(),
        getOutreachStats(),
      ]);
      setHistory(historyRes.records);
      setStats(statsRes);

      // Reset compose form
      setSelectedContacts([]);
      setSelectedTemplate('');
      setEmailSubject('');
      setEmailBody('');
      setCustomMessage('');
      setPreviewHtml(null);
      setActiveTab('history');
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Failed to send email(s)');
    } finally {
      setSending(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      await updateOrganizationSettings(settings);
      alert('Settings saved!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const selectAllContacts = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map((c) => c.id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">Contact Outreach</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            &times;
          </button>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="bg-gray-50 p-3 flex gap-4 text-sm border-b overflow-x-auto">
            <span className="font-medium">Outreach Stats:</span>
            <span className="text-blue-600">{stats.sent} Sent</span>
            <span className="text-green-600">{stats.delivered} Delivered</span>
            <span className="text-purple-600">{stats.opened} Opened</span>
            <span className="text-emerald-600">{stats.replied} Replied</span>
            <span className="text-red-600">{stats.failed} Failed</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b">
          {(['contacts', 'compose', 'history', 'templates', 'settings'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize ${
                activeTab === tab
                  ? 'border-b-2 border-primary-600 text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'contacts' && contacts.length > 0 && (
                <span className="ml-1 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                  {contacts.length}
                </span>
              )}
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
              {/* Contacts Tab */}
              {activeTab === 'contacts' && (
                <div>
                  {contacts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No contacts added yet.</p>
                      <p className="text-sm mt-2">
                        Search for trials and click &quot;Add to Contacts&quot; to start building your list.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedContacts.length === contacts.length}
                            onChange={selectAllContacts}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-600">
                            {selectedContacts.length} selected
                          </span>
                        </div>
                        {selectedContacts.length > 0 && (
                          <button
                            onClick={() => setActiveTab('compose')}
                            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm hover:bg-primary-700"
                          >
                            Compose Email ({selectedContacts.length})
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center gap-3 p-3 border rounded-md hover:bg-gray-50"
                          >
                            <input
                              type="checkbox"
                              checked={selectedContacts.includes(contact.id)}
                              onChange={() => toggleContactSelection(contact.id)}
                              className="rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{contact.trialTitle}</div>
                              <div className="text-sm text-gray-500">
                                <span className="font-mono">{contact.nctId}</span>
                                {contact.contactName && ` • ${contact.contactName}`}
                                {contact.contactEmail && ` • ${contact.contactEmail}`}
                              </div>
                              {contact.city && (
                                <div className="text-xs text-gray-400">
                                  {[contact.city, contact.state, contact.country]
                                    .filter(Boolean)
                                    .join(', ')}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteContact(contact.id)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Compose Tab */}
              {activeTab === 'compose' && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-3">Compose Email</h3>

                    {!emailConfigured && (
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-4 text-sm text-yellow-800">
                        SendGrid is not configured. Emails will not be sent. Configure SENDGRID_API_KEY in your environment.
                      </div>
                    )}

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Recipients ({selectedContacts.length})
                      </label>
                      <div className="text-sm text-gray-500">
                        {selectedContacts.length === 0 ? (
                          <span className="text-red-500">
                            No contacts selected. Go to Contacts tab to select recipients.
                          </span>
                        ) : (
                          selectedContacts
                            .map((id) => contacts.find((c) => c.id === id)?.contactEmail || id)
                            .slice(0, 3)
                            .join(', ') +
                          (selectedContacts.length > 3 ? ` +${selectedContacts.length - 3} more` : '')
                        )}
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => handleSelectTemplate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="">Select a template...</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Email subject..."
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Message (optional)
                      </label>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md"
                        rows={2}
                        placeholder="Add a personalized message..."
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                      <textarea
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md font-mono text-sm"
                        rows={10}
                        placeholder="Email body..."
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Variables: {`{{contactName}}, {{trialTitle}}, {{nctId}}, {{organizationName}}, {{customMessage}}`}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={handlePreview}
                        className="px-4 py-2 border rounded-md hover:bg-gray-50"
                      >
                        Preview
                      </button>
                      <button
                        onClick={handleSend}
                        disabled={sending || selectedContacts.length === 0}
                        className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50"
                      >
                        {sending ? 'Sending...' : `Send to ${selectedContacts.length} contact(s)`}
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div>
                    <h3 className="font-medium mb-3">Preview</h3>
                    {previewHtml ? (
                      <div className="border rounded-md p-4 bg-gray-50">
                        <div className="mb-2">
                          <span className="text-sm text-gray-500">Subject:</span>
                          <div className="font-medium">{previewHtml.subject}</div>
                        </div>
                        <div className="border-t pt-3 whitespace-pre-wrap text-sm">
                          {previewHtml.body}
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-md p-4 bg-gray-50 text-gray-500 text-center">
                        Click &quot;Preview&quot; to see how your email will look
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  {history.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No outreach history yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {history.map((record) => {
                        const contact = contacts.find((c) => c.id === record.contactId);
                        return (
                          <div key={record.id} className="p-3 border rounded-md">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium">{record.subject}</div>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[record.status]}`}>
                                {record.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              To: {contact?.contactEmail || record.contactId}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {record.sentAt
                                ? `Sent: ${new Date(record.sentAt).toLocaleString()}`
                                : `Created: ${new Date(record.createdAt).toLocaleString()}`}
                              {record.errorMessage && (
                                <span className="text-red-500 ml-2">Error: {record.errorMessage}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Templates Tab */}
              {activeTab === 'templates' && (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-md p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          {template.isDefault && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">Default</span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            handleSelectTemplate(template.id);
                            setActiveTab('compose');
                          }}
                          className="text-sm text-primary-600 hover:text-primary-800"
                        >
                          Use Template
                        </button>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Subject:</strong> {template.subject}
                      </div>
                      <div className="text-sm text-gray-500 whitespace-pre-wrap line-clamp-3">
                        {template.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && settings && (
                <div className="max-w-lg">
                  <h3 className="font-medium mb-4">Organization Settings</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    These details will be used in email templates as variables.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Name *
                      </label>
                      <input
                        type="text"
                        value={settings.name}
                        onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Email *
                      </label>
                      <input
                        type="email"
                        value={settings.email}
                        onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={settings.phone || ''}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={settings.website || ''}
                        onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Organization Description
                      </label>
                      <textarea
                        value={settings.description || ''}
                        onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        rows={3}
                      />
                    </div>

                    <button
                      onClick={handleSaveSettings}
                      className="bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700"
                    >
                      Save Settings
                    </button>
                  </div>

                  <div className="mt-8 pt-6 border-t">
                    <h4 className="font-medium mb-2">Email Service Status</h4>
                    <div className={`flex items-center gap-2 ${emailConfigured ? 'text-green-600' : 'text-yellow-600'}`}>
                      <span className={`w-2 h-2 rounded-full ${emailConfigured ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                      {emailConfigured ? 'SendGrid configured and ready' : 'SendGrid not configured'}
                    </div>
                    {!emailConfigured && (
                      <p className="text-sm text-gray-500 mt-2">
                        Add SENDGRID_API_KEY to your backend .env file to enable email sending.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
