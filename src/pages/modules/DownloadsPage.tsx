import React, { useState } from 'react';
import MonthSelector from '../../components/MonthSelector';
import {
  PageHeader, Alert, FormSelect, SubmitButton, FormRow, toUserMessage,
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

const DownloadsPage: React.FC = () => {
  const [mesKey, setMesKey] = useState(mesActualKey());
  const [modulo, setModulo] = useState<ExportModuloId>('ventas');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rango = rangoFromMes(mesKey);
  const meta = getModuloMeta(modulo);

  const exportar = async (e: React.FormEvent) => {
    e.preventDefault();
    setExporting(true);
    setError(null);
    setSuccess(null);
    try {
      const sheet = await buildExportSheet(mesKey, modulo);
      await downloadExcelWorkbook([sheet], exportFilename(mesKey, modulo));
      setSuccess(`Descarga lista: ${meta?.title ?? modulo} — ${rango.label}`);
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
        subtitle="Exporta un módulo a la vez — elige mes y tipo de información"
        moduleId="descargas"
      />


      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section downloads-form-card">
        <form onSubmit={exportar}>
          <FormRow actions>
            <MonthSelector value={mesKey} onChange={setMesKey} label="Mes" />
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
              Periodo: <strong>{rango.desde}</strong> al <strong>{rango.hasta}</strong>
              {rango.esMesActual && ' (mes en curso)'}
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
            <SubmitButton
              loading={exporting}
              label="Descargar Excel"
              icon="download"
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default DownloadsPage;
