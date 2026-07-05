import React from 'react';

interface DashKpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: string;
  iconTone?: 'green' | 'gold' | 'red' | 'blue';
  accent?: 'gold' | 'danger' | 'success';
  sub?: React.ReactNode;
}

const DashKpiCard: React.FC<DashKpiCardProps> = ({
  label, value, icon, iconTone = 'green', accent, sub,
}) => (
  <div className={`kpi-card${accent ? ` accent-${accent}` : ''}`}>
    <div className={`kpi-icon ${iconTone}`}>
      <span className="material-icons-round">{icon}</span>
    </div>
    <span className="kpi-label">{label}</span>
    <div className="kpi-value">{value}</div>
    {sub && <span className="kpi-sub">{sub}</span>}
  </div>
);

export default DashKpiCard;
