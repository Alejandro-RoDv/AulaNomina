import {
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Search,
} from "lucide-react";

import "./table.css";

function joinClassNames(...classNames) {
  return classNames.filter(Boolean).join(" ");
}

export function DataTable({ children, className = "", ...props }) {
  return (
    <section className={joinClassNames("an-data-table", className)} {...props}>
      {children}
    </section>
  );
}

export function DataTableToolbar({
  children,
  actions = null,
  className = "",
  ...props
}) {
  return (
    <div className={joinClassNames("an-data-table__toolbar", className)} {...props}>
      <div className="an-data-table__filters">{children}</div>
      {actions && <div className="an-data-table__toolbar-actions">{actions}</div>}
    </div>
  );
}

export function DataTableSearch({
  value,
  onChange,
  placeholder = "Buscar",
  className = "",
  ...props
}) {
  return (
    <label className={joinClassNames("an-data-table__search", className)}>
      <Search aria-hidden="true" />
      <span className="an-visually-hidden">Buscar</span>
      <input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    </label>
  );
}

export function DataTableFilter({
  children,
  value,
  onChange,
  label,
  className = "",
  ...props
}) {
  return (
    <label className={joinClassNames("an-data-table__filter", className)}>
      <span className="an-visually-hidden">{label}</span>
      <select value={value} onChange={onChange} aria-label={label} {...props}>
        {children}
      </select>
    </label>
  );
}

export function DataTableSummary({
  label,
  count,
  total = null,
  className = "",
  ...props
}) {
  const resultText = total === null || Number(count) === Number(total)
    ? `${count} resultados`
    : `${count} de ${total} resultados`;

  return (
    <div className={joinClassNames("an-data-table__summary", className)} {...props}>
      {label && <strong>{label}</strong>}
      <span>{resultText}</span>
    </div>
  );
}

export function Table({
  children,
  className = "",
  minWidth = "58rem",
  responsive = "cards",
  ...props
}) {
  return (
    <div className="an-table-scroll">
      <table
        className={joinClassNames(
          "an-table",
          responsive === "cards" && "an-table--responsive-cards",
          className,
        )}
        style={{ "--an-table-min-width": minWidth }}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className = "", ...props }) {
  return (
    <thead className={joinClassNames("an-table__head", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "", ...props }) {
  return (
    <tbody className={joinClassNames("an-table__body", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  children,
  interactive = false,
  className = "",
  ...props
}) {
  return (
    <tr
      className={joinClassNames(
        "an-table__row",
        interactive && "an-table__row--interactive",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  sortable = false,
  direction = null,
  onSort,
  align = "left",
  className = "",
  ...props
}) {
  const ariaSort = direction === "asc"
    ? "ascending"
    : direction === "desc"
      ? "descending"
      : "none";

  return (
    <th
      className={joinClassNames(
        "an-table__header-cell",
        `an-table__header-cell--${align}`,
        className,
      )}
      aria-sort={sortable ? ariaSort : undefined}
      {...props}
    >
      {sortable ? (
        <button type="button" className="an-table__sort" onClick={onSort}>
          <span>{children}</span>
          <ChevronsUpDown
            aria-hidden="true"
            className={joinClassNames(
              "an-table__sort-icon",
              direction && "is-active",
              direction === "desc" && "is-descending",
            )}
          />
        </button>
      ) : children}
    </th>
  );
}

export function TableCell({
  children,
  label = "",
  align = "left",
  className = "",
  ...props
}) {
  return (
    <td
      className={joinClassNames(
        "an-table__cell",
        `an-table__cell--${align}`,
        className,
      )}
      data-label={label || undefined}
      {...props}
    >
      {children}
    </td>
  );
}

export function TablePrimaryCell({
  title,
  meta = "",
  onClick = null,
  className = "",
}) {
  const titleContent = onClick ? (
    <button type="button" className="an-table__primary-link" onClick={onClick}>
      {title}
    </button>
  ) : (
    <strong className="an-table__primary-title">{title}</strong>
  );

  return (
    <div className={joinClassNames("an-table__primary", className)}>
      {titleContent}
      {meta && <span className="an-table__meta">{meta}</span>}
    </div>
  );
}

export function TableActions({ children, className = "", ...props }) {
  return (
    <div className={joinClassNames("an-table__actions", className)} {...props}>
      {children}
    </div>
  );
}

export function TableIconButton({
  children,
  label,
  className = "",
  ...props
}) {
  return (
    <button
      type="button"
      className={joinClassNames("an-table__icon-button", className)}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function TableEmpty({
  colSpan,
  title = "Sin resultados",
  description = "No hay registros que mostrar.",
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="an-table__empty-cell">
        <div className="an-table__empty">
          <strong>{title}</strong>
          <span>{description}</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function TablePagination({
  page,
  pageCount,
  onPageChange,
  label = "Página",
  className = "",
}) {
  const safePageCount = Math.max(Number(pageCount) || 1, 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), safePageCount);

  return (
    <nav
      className={joinClassNames("an-table__pagination", className)}
      aria-label="Paginación de resultados"
    >
      <span>{label} {safePage} de {safePageCount}</span>
      <div>
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safePageCount}
          aria-label="Página siguiente"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
