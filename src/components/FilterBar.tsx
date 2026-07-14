import { useMemo, useState } from "preact/hooks";

export interface LegalCaseSummary {
  id: string;
  caseName: string;
  court: string;
  status: string;
  issue: string;
  whyItMatters: string;
}

interface Props {
  cases: LegalCaseSummary[];
}

const STATUS_LABELS: Record<string, string> = {
  filed: "Filed",
  pending: "Pending",
  decided: "Decided",
  dismissed: "Dismissed",
  settled: "Settled",
};

const ISSUE_LABELS: Record<string, string> = {
  geofence: "Geofence",
  alpr: "ALPR",
  "data-sharing": "Data sharing",
  "first-amendment": "First Amendment",
  other: "Other",
};

export default function FilterBar({ cases }: Props) {
  const [status, setStatus] = useState<string>("all");
  const [issue, setIssue] = useState<string>("all");

  const filtered = useMemo(
    () =>
      cases.filter(
        (c) => (status === "all" || c.status === status) && (issue === "all" || c.issue === issue)
      ),
    [cases, status, issue]
  );

  return (
    <div class="legal-filter">
      <div class="filter-controls" role="group" aria-label="Filter legal cases">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus((e.target as HTMLSelectElement).value)}>
            <option value="all">All</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Issue
          <select value={issue} onChange={(e) => setIssue((e.target as HTMLSelectElement).value)}>
            <option value="all">All</option>
            {Object.entries(ISSUE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cases.length === 0 ? (
        <p>No cases in the tracker yet.</p>
      ) : filtered.length === 0 ? (
        <p>No cases match those filters.</p>
      ) : (
        <ul class="case-list">
          {filtered.map((c) => (
            <li key={c.id} class="case-card">
              <a href={`/legal/${c.id}`}>
                <h3>{c.caseName}</h3>
              </a>
              <p class="case-meta">
                {c.court} · {STATUS_LABELS[c.status] ?? c.status} · {ISSUE_LABELS[c.issue] ?? c.issue}
              </p>
              <p>{c.whyItMatters}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
