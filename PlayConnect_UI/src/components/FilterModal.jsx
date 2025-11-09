import { Fragment } from "react";

const baseField =
  "w-full rounded-xl border border-neutral-800 bg-neutral-950/70 px-3 py-3 text-sm text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent transition";
const selectWrapper =
  "relative flex items-center";
const selectChevron =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-500";

export default function FilterModal({
  open,
  onClose,
  sports,
  filters,
  handlers,
  onApply,
  onClear,
}) {
  if (!open) return null;

  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-neutral-800 bg-neutral-950/95 p-6 shadow-2xl"
        onClick={stop}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Filter Games</h2>
            <p className="text-sm text-neutral-400">
              Narrow down games by criteria that matter to you.
            </p>
          </div>
          <button
            className="text-neutral-400 hover:text-white"
            onClick={onClose}
            aria-label="Close filters"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm text-neutral-300 mb-1 block">
              Search
            </label>
            <input
              className={`${baseField}`}
              placeholder="Search by location or notes"
              value={filters.searchText}
              onChange={(e) => handlers.setSearchText(e.target.value)}
            />
          </div>

          <Field label="Sport">
            <div className={selectWrapper}>
              <select
                className={`${baseField} appearance-none pr-10`}
                value={filters.sportFilter}
                onChange={(e) => handlers.setSportFilter(e.target.value)}
              >
                <option value="">All sports</option>
                {sports.map((s) => (
                  <option key={s.sport_id} value={s.sport_id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className={selectChevron}>▼</span>
            </div>
          </Field>

          <Field label="Status">
            <div className={selectWrapper}>
              <select
                className={`${baseField} appearance-none pr-10`}
                value={filters.statusFilter}
                onChange={(e) => handlers.setStatusFilter(e.target.value)}
              >
                <option value="">Any status</option>
                <option value="Open">Open</option>
                <option value="Full">Full</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <span className={selectChevron}>▼</span>
            </div>
          </Field>

          <Field label="Skill level">
            <div className={selectWrapper}>
              <select
                className={`${baseField} appearance-none pr-10`}
                value={filters.skillFilter}
                onChange={(e) => handlers.setSkillFilter(e.target.value)}
              >
                <option value="">Any skill</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
              <span className={selectChevron}>▼</span>
            </div>
          </Field>

          <Field label="Spot availability">
            <div className={selectWrapper}>
              <select
                className={`${baseField} appearance-none pr-10`}
                value={filters.spotsFilter}
                onChange={(e) => handlers.setSpotsFilter(e.target.value)}
              >
                <option value="">Any spots</option>
                <option value="available">Spots available</option>
                <option value="full">Full</option>
              </select>
              <span className={selectChevron}>▼</span>
            </div>
          </Field>

          <Field label="Start time from">
            <input
              type="datetime-local"
              className={`${baseField}`}
              value={filters.fromISO ? filters.fromISO.slice(0, 16) : ""}
              onChange={(e) =>
                handlers.setFromISO(
                  e.target.value ? new Date(e.target.value).toISOString() : ""
                )
              }
            />
          </Field>

          <Field label="Start time to">
            <input
              type="datetime-local"
              className={`${baseField}`}
              value={filters.toISO ? filters.toISO.slice(0, 16) : ""}
              onChange={(e) =>
                handlers.setToISO(
                  e.target.value ? new Date(e.target.value).toISOString() : ""
                )
              }
            />
          </Field>

          <Field label="Sort by" className="md:col-span-2">
            <div className={selectWrapper}>
              <select
                className={`${baseField} appearance-none pr-10`}
                value={filters.sort}
                onChange={(e) => handlers.setSort(e.target.value)}
              >
                <option value="start_time:asc">Start time ↑</option>
                <option value="start_time:desc">Start time ↓</option>
                <option value="created_at:asc">Created ↑</option>
                <option value="created_at:desc">Created ↓</option>
              </select>
              <span className={selectChevron}>▼</span>
            </div>
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <button
            className="rounded-lg border border-neutral-700 px-4 py-2 text-white hover:bg-neutral-800 transition"
            onClick={onClear}
          >
            Clear filters
          </button>
          <div className="flex gap-3">
            <button
              className="rounded-lg border border-neutral-700 px-4 py-2 text-white hover:bg-neutral-800 transition"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-violet-500 px-4 py-2 font-semibold text-white hover:bg-violet-400 transition"
              onClick={onApply}
            >
              Apply filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm text-neutral-300">{label}</label>
      {children}
    </div>
  );
}
