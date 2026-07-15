import React, { useState } from 'react';
import MonthSelector from '../../components/MonthSelector';
import {
  PageHeader, Alert, FormSelect, SubmitButton, FormRow, FormInput, toUserMessage,
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
          ? `Descarga lista: inventario snapshot actual`
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
        subtitle="Exporta un módulo a la vez — mes o rango libre"
        moduleId="descargas"
      />

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section downloads-form-card">
        <form onSubmit={exportar}>
          <FormSelect
            label="Periodo"
            value={modoPeriodo}
            onChange={(v) => setModoPeriodo(v as 'mes' | 'rango')}
            options={[
              { value: 'mes', label: 'Por mes' },
              { value: 'rango', label: 'Rango de fechas' },
            ]}
          />
          <FormRow actions>
            {modoPeriodo === 'mes' ? (
              <MonthSelector value={mesKey} onChange={setMesKey} label="Mes" />
            ) : (
              <>
                <FormInput label="Desde" type="date" value={desde} onChange={setDesde} required />
                <FormInput label="Hasta" type="date" value={hasta} onChange={setHasta} required />
              </>
            )}
            <FormSelect
              label="Módulo"
              value={modulo}
              onChange={(v) => setModulo(v as ExportModuloId)}
              options={EXPORT_MODULOS.map((m) => ({ value: m.id, label: m.title }))}
              required
            />
          </FormRow>

          <div className="downloads-period-info">
            <span className="material-icons-round">info</span>
            <span>
              {modulo === 'inventario' ? (
                <>Inventario = <strong>snapshot de hoy</strong> (no usa el periodo).</>
              ) : (
                <>Periodo: <strong>{periodLabel}</strong></>
              )}
            </span>
          </div>

          {meta && (
            <div className="downloads-modulo-preview">
              <span className="material-icons-round">{meta.icon}</span>
              <div>
                <strong>{meta.title}</strong>
                <p>{meta.subtitle}</p>
              </div>
            </div>
          )}

          <div className="downloads-form-actions">
            <SubmitButton loading={exporting} label="Descargar Excel" icon="download" />
          </div>
        </form>
      </div>
    </div>
  );
};

export default DownloadsPage;
