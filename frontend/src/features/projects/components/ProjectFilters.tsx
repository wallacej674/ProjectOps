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
  includeArchived: boolean;
  onIncludeArchived: (value: boolean) => void;
  view: ProjectView;
  onView: (view: ProjectView) => void;
}

/** Search, status filter, sort, archived toggle, and view switch for the Registry. */
export function ProjectFilters({
  query,
  onQuery,
  status,
  onStatus,
  sort,
  onSort,
  includeArchived,
  onIncludeArchived,
  view,
  onView,
}: ProjectFiltersProps) {
  return (
    <div className="filters">
      <input
        className="control search"
        aria-label="Search Projects"
        placeholder="Search Projects"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
      />
      <select
        className="control"
        aria-label="Filter by Project status"
        value={status}
        onChange={(e) => onStatus(e.target.value)}
      >
        <option value="all">All statuses</option>
        {[...editableStatuses, "archived"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <select
        className="control"
        aria-label="Sort Projects"
        value={sort}
        onChange={(e) => onSort(e.target.value as SortKey)}
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label className="button">
        <input type="checkbox" checked={includeArchived} onChange={(e) => onIncludeArchived(e.target.checked)} /> Include
        archived
      </label>
      <ViewToggle view={view} onChange={onView} />
    </div>
  );
}
