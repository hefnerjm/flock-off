import { useMemo, useState } from "preact/hooks";

export interface AbuseCaseSummary {
  id: string;
  title: string;
  date: string;
  city?: string;
  state: string;
  category: string;
  agency?: string;
}

interface Props {
  cases: AbuseCaseSummary[];
}

const CATEGORY_LABELS: Record<string, string> = {
  stalking: "Stalking",
  immigration: "Immigration",
  reproductive: "Reproductive care",
  "protest-1a": "Protest / 1st Amendment",
  "data-sharing": "Data sharing",
  "warrantless-dragnet": "Warrantless dragnet",
  other: "Other",
};

type SortKey = "date" | "title" | "state";

export default function CaseTableIsland({ cases }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let result = cases.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.state.toLowerCase().includes(q) ||
        c.agency?.toLowerCase().includes(q)
      );
    });
    result = [...result].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === "date") return a.date < b.date ? dir : a.date > b.date ? -dir : 0;
      if (sortKey === "title") return a.title.localeCompare(b.title) * dir;
      return a.state.localeCompare(b.state) * dir;
    });
    return result;
  }, [cases, query, category, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div class="case-table">
      <div class="table-controls">
        <label class="search-label">
          <span class="sr-only">Search cases</span>
          <input
            type="search"
            placeholder="Search by title, city, state, or agency"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
        </label>
        <label>
          Category
          <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="all">All</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cases.length === 0 ? (
        <p>No cases in the database yet. See the {" "}
          <a href="/database/submit">submit a case</a> page to propose one.
        </p>
      ) : filtered.length === 0 ? (
        <p>No cases match your search.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort("title")}>
                  Title {sortKey === "title" ? (sortAsc ? "▲" : "▼") : ""}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("date")}>
                  Date {sortKey === "date" ? (sortAsc ? "▲" : "▼") : ""}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("state")}>
                  State {sortKey === "state" ? (sortAsc ? "▲" : "▼") : ""}
                </button>
              </th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <a href={`/database/${c.id}`}>{c.title}</a>
                </td>
                <td>{c.date}</td>
                <td>
                  {c.city ? `${c.city}, ` : ""}
                  {c.state}
                </td>
                <td>{CATEGORY_LABELS[c.category] ?? c.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
