import React from 'react';

export const PageLoader: React.FC = () => (
  <div className="loader-container" style={{ height: '50vh', width: '100%' }}>
    <div className="loader" />
  </div>
);

export const Alert: React.FC<{ type?: 'error' | 'success' | 'info'; message: string; onClose?: () => void }> = ({
  type = 'info',
  message,
  onClose,
}) => (
  <div className={`alert alert-${type}`} role="alert">
    <span>{message}</span>
    {onClose && (
      <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar">
        <span className="material-icons-round">close</span>
      </button>
    )}
  </div>
);

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action }) => (
  <div className="page-header">
    <div className="header-title">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
    {action}
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
}

export const FormSelect: React.FC<FormSelectProps> = ({ label, value, onChange, options, required, disabled }) => (
  <label className="form-group">
    <span className="form-label">{label}</span>
    <select className="form-input" value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}>
      <option value="">— Seleccionar —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </label>
);

interface FormInputProps {
  label: string;
  type?: string;
  value: string | number;
  onChange: (v: string) => void;
  required?: boolean;
  min?: number;
  step?: string;
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

export const ModuleHelp: React.FC<{ message: string }> = ({ message }) => (
  <div className="module-help" role="note">
    <span className="material-icons-round">info</span>
    <span>{message}</span>
  </div>
);
