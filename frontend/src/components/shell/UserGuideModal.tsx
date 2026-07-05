'use client';

const SECTIONS = [
  {
    title: 'Discover Studies',
    body: 'Browse a live feed of clinical studies. Use the "For You" tab for a curated mix driven by your Scouts, "All Studies" to search the full registry, and "Bookmarks" for saved studies. Bookmark, hide, or push any study into your TrialTrack pipeline right from its card.',
  },
  {
    title: 'Scouts',
    body: 'Scouts are saved, indication-based search agents. Create one for each therapeutic area you cover; each generates a tailored feed and produces recurring Weekly Reports of newly matching studies.',
  },
  {
    title: 'Study detail',
    body: 'Click any study to open the detail panel with Overview, Eligibility, Locations, Design, Interventions, Outcomes, Timeline, and References — plus deep links to the registry and an "Open in TrialTrack" action.',
  },
  {
    title: 'Contacts & enrichment',
    body: 'The Contacts tab on a study surfaces sponsor, CRO, and site staff. Enrich a contact to resolve their work email and LinkedIn, then select contacts in bulk and add them to an outreach sequence. Enrichment consumes credits.',
  },
];

export default function UserGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">User Guide</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">{s.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
