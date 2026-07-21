import React, { useState } from 'react';
import MonthSelector from '../../components/MonthSelector';
import {
  PageHeader, Alert, SubmitButton, FormRow, FormInput, toUserMessage,
} from '../../components/ui';
import { mesActualKey } from '../../utils/periodoMes';
import { downloadExcelWorkbook } from '../../utils/excelExport';
import {
  EXPORT_MODULOS,
  buildExportSheet,
  exportFilename,
  rangoFromMes,
  getModuloMeta,
  type ExportModuloId,
} from '../../services/exportDataService';
import { hoyYmd, inicioMesYmd } from '../../utils/fechaLocal';

const DownloadsPage: React.FC = () => {
  const [modoPeriodo, setModoPeriodo] = useState<'mes' | 'rango'>('mes');
  const [mesKey, setMesKey] = useState(mesActualKey());
  const [desde, setDesde] = useState(inicioMesYmd());
  const [hasta, setHasta] = useState(hoyYmd());
  const [modulo, setModulo] = useState<ExportModuloId>('ventas');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rangoMesInfo = rangoFromMes(mesKey);
  const meta = getModuloMeta(modulo);
  const periodLabel = modoPeriodo === 'mes'
    ? rangoMesInfo.label
    : `${desde} → ${hasta}`;

  const exportar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modoPeriodo === 'rango' && desde > hasta) {
      setError('La fecha desde no puede ser posterior a hasta.');
      return;
    }
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const override = modoPeriodo === 'rango'
        ? { desde, hasta, label: periodLabel }
        : undefined;
      const sheet = await buildExportSheet(mesKey, modulo, override);
      const fileKey = modoPeriodo === 'mes' ? mesKey : `${desde}_${hasta}`;
      await downloadExcelWorkbook([sheet], exportFilename(fileKey, modulo));
      setSuccess(
        modulo === 'inventario'
          ? 'Descarga lista: inventario snapshot actual'
          : `Descarga lista: ${meta?.title ?? modulo} — ${periodLabel}`,
      );
    } catch (err) {
      setError(toUserMessage(err, 'Error al generar Excel'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="animate-in downloads-page">
      <PageHeader
        title="Descargas"
        subtitle="Exporta un módulo a Excel — elige periodo y tipo de reporte"
        moduleId="descargas"
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <form className="card downloads-panel" onSubmit={exportar}>
        <div className="downloads-panel-grid">
          <section className="downloads-panel-section" aria-labelledby="downloads-period-heading">
            <h3 id="downloads-period-heading" className="downloads-section-title">
              <span className="material-icons-round">calendar_month</span>
              Periodo
            </h3>

            <div className="downloads-period-modes" role="group" aria-label="Tipo de periodo">
              <button
                type="button"
                className={`downloads-mode-btn ${modoPeriodo === 'mes' ? 'active' : ''}`}
                onClick={() => setModoPeriodo('mes')}
              >
                Por mes
              </button>
              <button
                type="button"
                className={`downloads-mode-btn ${modoPeriodo === 'rango' ? 'active' : ''}`}
                onClick={() => setModoPeriodo('rango')}
              >
                Rango de fechas
              </button>
            </div>

            {modoPeriodo === 'mes' ? (
              <MonthSelector value={mesKey} onChange={setMesKey} label="Mes" />
            ) : (
              <FormRow>
                <FormInput label="Desde" type="date" value={desde} onChange={setDesde} required />
                <FormInput label="Hasta" type="date" value={hasta} onChange={setHasta} required />
              </FormRow>
            )}

            <p className="downloads-period-info">
              <span className="material-icons-round">info</span>
              <span>
                {modulo === 'inventario' ? (
                  <>Inventario = <strong>snapshot de hoy</strong> (no usa el periodo).</>
                ) : (
                  <>Periodo seleccionado: <strong>{periodLabel}</strong></>
                )}
              </span>
            </p>
          </section>

          <section className="downloads-panel-section" aria-labelledby="downloads-module-heading">
            <h3 id="downloads-module-heading" className="downloads-section-title">
              <span className="material-icons-round">folder_open</span>
              Módulo a exportar
            </h3>

            <div className="downloads-module-grid" role="radiogroup" aria-label="Módulo">
              {EXPORT_MODULOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={modulo === m.id}
                  className={`downloads-module-card ${modulo === m.id ? 'active' : ''}`}
                  onClick={() => setModulo(m.id)}
                >
                  <span className="material-icons-round">{m.icon}</span>
                  <span className="downloads-module-card-text">
                    <strong>{m.title}</strong>
                    <small>{m.subtitle}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="downloads-panel-footer">
          <div className="downloads-footer-summary">
            {meta && (
              <>
                <span className="material-icons-round">{meta.icon}</span>
                <div>
                  <strong>{meta.title}</strong>
                  <p>
                    {modulo === 'inventario'
                      ? 'Snapshot actual de stock'
                      : `Excel · ${periodLabel}`}
                  </p>
                </div>
              </>
            )}
          </div>
          <SubmitButton loading={exporting} label="Descargar Excel" icon="download" />
        </div>
      </form>
    </div>
  );
};

export default DownloadsPage;
