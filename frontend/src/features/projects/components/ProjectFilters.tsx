import { ViewToggle } from "../../../components/ui/ViewToggle";
import type { ProjectView } from "../../../components/ui/ViewToggle";
import { editableStatuses } from "../projectForm";
import { sortOptions } from "../projectSort";
import type { SortKey } from "../projectSort";

export interface ProjectFiltersProps {
  query: string;
  onQuery: (value: string) => void;
  status: string;
  onStatus: (value: string) => void;
  sort: SortKey;
  onSort: (value: SortKey) => void;
  statusDisabled?: boolean;
  view: ProjectView;
  onView: (view: ProjectView) => void;
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.75" cy="6.75" r="4.25" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** Search, status filter, sort, archived toggle, and view switch for the Registry. */
export function ProjectFilters({
  query,
  onQuery,
  status,
  onStatus,
  sort,
  onSort,
  statusDisabled = false,
  view,
  onView,
}: ProjectFiltersProps) {
  return (
    <div className="filters project-registry-toolbar">
      <div className="filter-search">
        <SearchIcon />
        <input
          aria-label="Search Projects"
          placeholder="Search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
      <div className="filter-chip">
        <select
          aria-label="Filter by Project status"
          value={status}
          disabled={statusDisabled}
          onChange={(e) => onStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {editableStatuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <ChevronIcon />
      </div>
      <div className="filter-chip">
        <select aria-label="Sort Projects" value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
      <div className="filter-spacer" />
      <ViewToggle view={view} onChange={onView} />
    </div>
  );
}
