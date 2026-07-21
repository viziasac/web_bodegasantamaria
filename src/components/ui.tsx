import React, { useState, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal';
import { getModuleGuide } from '../config/moduleGuides';

export const PageLoader: React.FC = () => (
  <div className="loader-container" style={{ height: '50vh', width: '100%' }}>
    <div className="loader" />
  </div>
);

export const Alert: React.FC<{
  type?: 'error' | 'success' | 'info';
  message?: string;
  children?: React.ReactNode;
  onClose?: () => void;
}> = ({
  type = 'info',
  message,
  children,
  onClose,
}) => (
  <div className={`alert alert-${type}`} role="alert">
    <span>{message ?? children}</span>
    {onClose && (
      <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
        <span className="material-icons-round">close</span>
      </button>
    )}
  </div>
);

/** Botón info (esquina) + modal con guía del módulo. */
export const ModuleInfoButton: React.FC<{ moduleId: string }> = ({ moduleId }) => {
  const [open, setOpen] = useState(false);
  const guide = getModuleGuide(moduleId);
  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        className="module-info-btn"
        title={`Cómo funciona: ${guide.title}`}
        aria-label={`Información de ${guide.title}`}
        onClick={() => setOpen(true)}
      >
        <span className="material-icons-round">info</span>
      </button>
      <Modal title={guide.title} isOpen={open} onClose={() => setOpen(false)}>
        <div className="module-guide">
          <p className="module-guide-summary">{guide.summary}</p>
          <h4>Cómo usarlo</h4>
          <ol className="module-guide-steps">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {guide.tips && guide.tips.length > 0 && (
            <>
              <h4>Notas</h4>
              <ul className="module-guide-tips">
                {guide.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          )}
          {guide.related && guide.related.length > 0 && (
            <>
              <h4>Relacionado</h4>
              <div className="module-guide-related">
                {guide.related.map((r) => (
                  <Link
                    key={r.path}
                    to={r.path}
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOpen(false)}
                  >
                    {r.label}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
};

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Si se pasa, muestra el botón info con la guía del módulo. */
  moduleId?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, moduleId }) => (
  <div className="page-header">
    <div className="header-title">
      <div className="header-title-row">
        <h1>{title}</h1>
        {moduleId && <ModuleInfoButton moduleId={moduleId} />}
      </div>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {action && <div className="page-header-actions">{action}</div>}
  </div>
);

export const TabBar: React.FC<{
  tabs: { id: string; label: string; icon?: string }[];
  active: string;
  onChange: (id: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="tabs module-tabs">
    {tabs.map((t) => (
      <button
        key={t.id}
        type="button"
        className={`tab-button ${active === t.id ? 'active' : ''}`}
        onClick={() => onChange(t.id)}
      >
        {t.icon && <span className="material-icons-round tab-icon">{t.icon}</span>}
        {t.label}
      </button>
    ))}
  </div>
);

export const EmptyState: React.FC<{
  icon?: string;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}> = ({
  icon = 'inbox',
  title,
  hint,
  action,
}) => (
  <div className="empty-state padded">
    <span className="material-icons-round">{icon}</span>
    <h3>{title}</h3>
    {hint && <small>{hint}</small>}
    {action && <div className="empty-state-action">{action}</div>}
  </div>
);

export const StatusBadge: React.FC<{ ok: boolean; okLabel?: string; failLabel?: string }> = ({
  ok,
  okLabel = 'OK',
  failLabel = 'Falta',
}) => (
  <span className={`status-tag ${ok ? 'status-ok' : 'status-danger'}`}>{ok ? okLabel : failLabel}</span>
);

export const StockBar: React.FC<{ value: number; max: number; danger?: boolean }> = ({
  value,
  max,
  danger,
}) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="stock-bar">
      <div
        className={`stock-bar-fill ${danger ? 'danger' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
};

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
  /** Solo se usa si ninguna opción trae value "". */
  placeholder?: string;
  /**
   * Si true y el value no está en options, limpia el estado.
   * Por defecto false: conserva el valor con una opción temporal (evita clears al refrescar catálogo).
   */
  clearInvalid?: boolean;
}

/**
 * Select controlado seguro:
 * - deduplica values
 * - no duplica la opción vacía
 * - si value no está en options: opción temporal “no disponible” (sin borrar estado, salvo clearInvalid)
 */
export const FormSelect: React.FC<FormSelectProps> = ({
  label, value, onChange, options, required, disabled,
  placeholder = '— Seleccionar —',
  clearInvalid = false,
}) => {
  const seen = new Set<string>();
  const normalized = options.filter((o) => {
    const key = String(o.value ?? '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((o) => ({ value: String(o.value ?? ''), label: o.label }));

  const hasEmpty = normalized.some((o) => o.value === '');
  const valueInList = normalized.some((o) => o.value === value);
  const orphan = !valueInList && value !== '';

  useLayoutEffect(() => {
    if (clearInvalid && orphan) onChange('');
  }, [clearInvalid, orphan, onChange]);

  const displayOptions = orphan && !clearInvalid
    ? [{ value, label: '(Valor no disponible en lista)' }, ...normalized]
    : normalized;

  return (
    <label className="form-group">
      <span className="form-label">{label}</span>
      <select
        className="form-input"
        value={orphan && clearInvalid ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
      >
        {!hasEmpty && <option value="">{placeholder}</option>}
        {displayOptions.map((o) => (
          <option key={o.value === '' ? '__empty__' : o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
};

interface FormInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  min?: number;
  step?: string | number;
  placeholder?: string;
  maxLength?: number;
}

export const FormInput: React.FC<FormInputProps> = ({
  label, type = 'text', value, onChange, required, min, step, placeholder, maxLength,
}) => (
  <label className="form-group">
    <span className="form-label">{label}</span>
    <input
      className="form-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      min={min}
      step={step}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  </label>
);

export const SearchInput: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({
  value,
  onChange,
  placeholder = 'Buscar…',
}) => (
  <div className="search-input-wrap">
    <span className="material-icons-round">search</span>
    <input
      className="form-input search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

export const SubmitButton: React.FC<{ loading?: boolean; label: string; icon?: string }> = ({
  loading, label, icon = 'save',
}) => (
  <button type="submit" className="btn btn-primary" disabled={loading}>
    <span className="material-icons-round">{loading ? 'hourglass_empty' : icon}</span>
    {loading ? 'Procesando…' : label}
  </button>
);

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="filter-bar card">{children}</div>
);

export const fmtNum = (n: number, decimals = 0) =>
  n.toLocaleString('es-PE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export const fmtMoney = (n: number) =>
  `S/ ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
};

export { toUserMessage } from '../utils/erpErrors';

export const FormRow: React.FC<{ children: React.ReactNode; actions?: boolean; className?: string }> = ({
  children, actions, className = '',
}) => (
  <div className={`form-row ${actions ? 'form-row--actions' : ''} ${className}`.trim()}>{children}</div>
);

export const DataTable: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children, className = '',
}) => (
  <div className="table-scroll">
    <table className={`data-table data-table-hover ${className}`.trim()}>{children}</table>
  </div>
);

export const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="card card-section">
    <h3 className="card-section-title">{title}</h3>
    {children}
  </div>
);

/** Tip corto opcional — la guía completa vive en ModuleInfoButton. */
export const ModuleHelp: React.FC<{ message: string }> = ({ message }) => (
  <div className="module-help" role="note">
    <span className="material-icons-round">info</span>
    <span>{message}</span>
  </div>
);
