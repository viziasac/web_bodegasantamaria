import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getRecetas, createRecetaLinea, updateRecetaLinea, deleteRecetaLinea,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormSelect, FormInput,
  SubmitButton, ModuleHelp, toUserMessage, fmtNum,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { isAdminRole } from '../../config/moduleRegistry';
import type { RecReceta } from '../../types';

const RecipesPage: React.FC = () => {
  const { user } = useAuth();
  const { items, ensureCatalogLoaded, refreshCatalog } = useCatalog();
  const isAdmin = isAdminRole(user?.role);

  const [recetas, setRecetas] = useState<RecReceta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterPt, setFilterPt] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editLine, setEditLine] = useState<RecReceta | null>(null);
  const [ptId, setPtId] = useState('');
  const [componenteId, setComponenteId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [saving, setSaving] = useState(false);

  const pts = useMemo(() => items.filter((i) => i.tipo === 'PT'), [items]);
  const componentes = useMemo(
    () => items.filter((i) => i.tipo !== 'PT'),
    [items],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await ensureCatalogLoaded();
      setRecetas(await getRecetas());
    } catch (err) {
      setError(toUserMessage(err, 'Error cargando recetas'));
    } finally {
      setLoading(false);
    }
  }, [ensureCatalogLoaded]);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const filtered = filterPt
      ? recetas.filter((r) => r.item_producido_id === filterPt)
      : recetas;
    return filtered.reduce<Record<string, { label: string; codigo?: string; lines: RecReceta[] }>>((acc, r) => {
      const key = r.item_producido_id;
      const prod = r.item_producido ?? r.ma_item_producido;
      if (!acc[key]) {
        acc[key] = {
          label: prod?.nombre ?? key,
          codigo: prod?.codigo,
          lines: [],
        };
      }
      acc[key].lines.push(r);
      return acc;
    }, {});
  }, [recetas, filterPt]);

  const openCreate = (presetPt?: string) => {
    setEditLine(null);
    setPtId(presetPt ?? filterPt ?? '');
    setComponenteId('');
    setCantidad('');
    setModalOpen(true);
  };

  const openEdit = (line: RecReceta) => {
    setEditLine(line);
    setPtId(line.item_producido_id);
    setComponenteId(line.componente_id);
    setCantidad(String(line.cantidad));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const qty = parseFloat(cantidad);
      if (editLine) {
        await updateRecetaLinea({ id: editLine.id, cantidad: qty });
        setSuccess('Línea de receta actualizada.');
      } else {
        await createRecetaLinea({
          itemProducidoId: ptId,
          componenteId,
          cantidad: qty,
        });
        setSuccess('Componente agregado a la receta.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar la receta'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLine = async (line: RecReceta) => {
    const nombre = (line.componente ?? line.ma_item_componente)?.nombre ?? 'componente';
    if (!confirm(`¿Quitar "${nombre}" de la receta? Esto no elimina el material del catálogo.`)) return;
    setError(null);
    try {
      await deleteRecetaLinea(line.id);
      setSuccess('Línea eliminada de la receta.');
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo quitar la línea'));
    }
  };

  return (
    <div className="animate-in">
      <PageHeader
        title="Recetas"
        subtitle={isAdmin ? 'Fórmulas por botella — ver, crear y modificar' : 'Fórmulas por botella (consulta)'}
      />
      <ModuleHelp message="Las cantidades son siempre por 1 botella (no por pack). GRANEL se consume desde ALM_GR; el resto desde ALM_MP al completar producción." />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section">
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <FormSelect
            label="Filtrar producto terminado"
            value={filterPt}
            onChange={setFilterPt}
            options={[
              { value: '', label: 'Todos los PT' },
              ...pts.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` })),
            ]}
          />
          {isAdmin && (
            <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
              <span className="material-icons-round">add</span>
              Nueva línea
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => { refreshCatalog(); load(); }}>
            <span className="material-icons-round">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <PageLoader />
      ) : Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon="menu_book"
          title="Sin recetas"
          hint={isAdmin ? 'Cree la primera línea de receta para un PT' : undefined}
        />
      ) : (
        Object.entries(grouped).map(([ptKey, group]) => (
          <div className="card card-section" key={ptKey}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <h3>
                {group.codigo && <code className="code-tag" style={{ marginRight: 8 }}>{group.codigo}</code>}
                {group.label}
              </h3>
              {isAdmin && (
                <button type="button" className="btn btn-ghost" onClick={() => openCreate(ptKey)}>
                  <span className="material-icons-round">add</span>
                  Agregar componente
                </button>
              )}
            </div>
            <DataTable>
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Tipo</th>
                  <th>Cantidad / botella</th>
                  <th>Unidad</th>
                  {isAdmin && <th />}
                </tr>
              </thead>
              <tbody>
                {group.lines.map((r) => {
                  const comp = r.componente ?? r.ma_item_componente;
                  return (
                    <tr key={r.id}>
                      <td>
                        {comp?.codigo && <code className="code-tag" style={{ marginRight: 6 }}>{comp.codigo}</code>}
                        {comp?.nombre ?? '—'}
                      </td>
                      <td>{comp?.tipo ?? '—'}</td>
                      <td className="cell-num">{fmtNum(r.cantidad, 4)}</td>
                      <td>{comp?.unidad_medida ?? '—'}</td>
                      {isAdmin && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button type="button" className="btn-icon" title="Editar cantidad" onClick={() => openEdit(r)}>
                            <span className="material-icons-round">edit</span>
                          </button>
                          <button type="button" className="btn-icon" title="Quitar de receta" onClick={() => handleDeleteLine(r)}>
                            <span className="material-icons-round">remove_circle_outline</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        ))
      )}

      <Modal
        title={editLine ? 'Editar cantidad (por botella)' : 'Nueva línea de receta'}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave}>
          <FormSelect
            label="Producto terminado (PT)"
            value={ptId}
            onChange={setPtId}
            required
            disabled={!!editLine}
            options={pts.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` }))}
          />
          <FormSelect
            label="Componente"
            value={componenteId}
            onChange={setComponenteId}
            required
            disabled={!!editLine}
            options={componentes.map((c) => ({
              value: c.id,
              label: `${c.codigo} — ${c.nombre} (${c.tipo})`,
            }))}
          />
          <FormInput
            label="Cantidad por 1 botella"
            type="number"
            value={cantidad}
            onChange={setCantidad}
            required
            min={0.0001}
            step="any"
          />
          <p className="qty-base-summary">Ej.: granel 0.75 L, botella/tapa/etiqueta 1.</p>
          <div className="form-actions">
            <SubmitButton loading={saving} label={editLine ? 'Guardar cambios' : 'Agregar a receta'} icon="save" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecipesPage;
