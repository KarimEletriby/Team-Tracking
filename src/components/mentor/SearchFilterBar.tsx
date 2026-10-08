import { Search } from 'lucide-react';
import styles from './MentorUi.module.css';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: FilterDefinition[];
  onFilterChange?: (filterId: string, value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
}

/** Controlled search input with optional select filters. */
export function SearchFilterBar({
  searchValue,
  onSearchChange,
  filters = [],
  onFilterChange,
  searchPlaceholder = 'Search',
  searchLabel = 'Search items',
}: SearchFilterBarProps) {
  return (
    <div className={styles.filterBar}>
      <div className={styles.searchField}>
        <Search className={styles.searchIcon} size={16} aria-hidden="true" />
        <input
          className={styles.searchInput}
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
        />
      </div>
      {filters.map((filter) => (
        <select
          key={filter.id}
          className={styles.filterSelect}
          value={filter.value}
          onChange={(event) => onFilterChange?.(filter.id, event.target.value)}
          aria-label={filter.label}
        >
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ))}
    </div>
  );
}
