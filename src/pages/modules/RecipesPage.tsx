import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getRecetas, createRecetaLinea, createRecetaLineas, updateRecetaLinea,
  deleteRecetaLinea, deleteRecetasDePt,
} from '../../services/apiProvider';
import {
  PageHeader, PageLoader, Alert, DataTable, EmptyState, FormSelect, FormInput,
  SubmitButton, FormSection, toUserMessage, fmtNum,
} from '../../components/ui';
import Modal from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { useCatalog } from '../../context/CatalogContext';
import { isAdminRole } from '../../config/moduleRegistry';
import type { MaItem, RecReceta } from '../../types';

const TIPO_ORDER: Record<string, number> = {
  GRANEL: 0,
  INSUMO: 1,
  MATERIAL: 2,
  EMPAQUE: 3,
};

function sortLines(lines: RecReceta[]): RecReceta[] {
  return [...lines].sort((a, b) => {
    const ta = (a.componente ?? a.ma_item_componente)?.tipo ?? '';
    const tb = (b.componente ?? b.ma_item_componente)?.tipo ?? '';
    const oa = TIPO_ORDER[ta] ?? 9;
    const ob = TIPO_ORDER[tb] ?? 9;
    if (oa !== ob) return oa - ob;
    const ca = (a.componente ?? a.ma_item_componente)?.codigo ?? '';
    const cb = (b.componente ?? b.ma_item_componente)?.codigo ?? '';
    return ca.localeCompare(cb);
  });
}

interface DraftLine {
  key: string;
  componenteId: string;
  cantidad: string;
  esVariable: boolean;
}

const emptyDraft = (): DraftLine => ({
  key: `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  componenteId: '',
  cantidad: '',
  esVariable: false,
});

const RecipesPage: React.FC = () => {
  const { user } = useAuth();
  const { items, ensureCatalogLoaded, refreshCatalog } = useCatalog();
  const isAdmin = isAdminRole(user?.role);

  const [recetas, setRecetas] = useState<RecReceta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterPt, setFilterPt] = useState('');

  const [bomModal, setBomModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editLine, setEditLine] = useState<RecReceta | null>(null);
  const [ptId, setPtId] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLine[]>([emptyDraft()]);
  const [editCantidad, setEditCantidad] = useState('');
  const [editVariable, setEditVariable] = useState(false);
  const [saving, setSaving] = useState(false);

  const pts = useMemo(() => items.filter((i) => i.tipo === 'PT'), [items]);
  const componentes = useMemo(
    () => items.filter((i) => i.tipo !== 'PT' && i.activo !== false)
      .sort((a, b) => {
        const oa = TIPO_ORDER[a.tipo] ?? 9;
        const ob = TIPO_ORDER[b.tipo] ?? 9;
        if (oa !== ob) return oa - ob;
        return a.codigo.localeCompare(b.codigo);
      }),
    [items],
  );
  const compById = useMemo(() => {
    const m = new Map<string, MaItem>();
    for (const c of componentes) m.set(c.id, c);
    return m;
  }, [componentes]);

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

  const usedByPt = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const r of recetas) {
      if (!map.has(r.item_producido_id)) map.set(r.item_producido_id, new Set());
      map.get(r.item_producido_id)!.add(r.componente_id);
    }
    return map;
  }, [recetas]);

  const ptsConReceta = useMemo(() => new Set(recetas.map((r) => r.item_producido_id)), [recetas]);
  const ptsSinReceta = useMemo(
    () => pts.filter((p) => !ptsConReceta.has(p.id)),
    [pts, ptsConReceta],
  );

  const grouped = useMemo(() => {
    const filtered = filterPt
      ? recetas.filter((r) => r.item_producido_id === filterPt)
      : recetas;
    const acc: Record<string, { label: string; codigo?: string; lines: RecReceta[] }> = {};
    for (const r of filtered) {
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
    }
    for (const g of Object.values(acc)) g.lines = sortLines(g.lines);
    return acc;
  }, [recetas, filterPt]);

  const availableForPt = useCallback((targetPt: string, excludeDraftKeys?: Set<string>) => {
    const used = usedByPt.get(targetPt) ?? new Set<string>();
    const pickedInDraft = new Set(
      draftLines
        .filter((d) => !excludeDraftKeys?.has(d.key) && d.componenteId)
        .map((d) => d.componenteId),
    );
    return componentes.filter((c) => !used.has(c.id) && !pickedInDraft.has(c.id));
  }, [componentes, usedByPt, draftLines]);

  const openBom = (presetPt?: string) => {
    setPtId(presetPt ?? filterPt ?? '');
    setDraftLines([emptyDraft()]);
    setBomModal(true);
  };

  const openEdit = (line: RecReceta) => {
    setEditLine(line);
    setEditCantidad(String(line.cantidad));
    setEditVariable(!!line.es_variable);
    setEditModal(true);
  };

  const updateDraft = (key: string, patch: Partial<DraftLine>) => {
    setDraftLines((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDraft = (key: string) => {
    setDraftLines((prev) => (prev.length <= 1 ? [emptyDraft()] : prev.filter((d) => d.key !== key)));
  };

  const handleSaveBom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!ptId) throw new Error('Seleccione el producto terminado.');
      const lines = draftLines
        .filter((d) => d.componenteId)
        .map((d) => {
          const qty = parseFloat(d.cantidad);
          if (!Number.isFinite(qty) || qty <= 0) {
            throw new Error('Cada línea necesita cantidad > 0 (por botella).');
          }
          return {
            componenteId: d.componenteId,
            cantidad: qty,
            esVariable: d.esVariable,
          };
        });
      if (lines.length === 0) throw new Error('Agregue al menos un material con cantidad.');

      if (lines.length === 1) {
        await createRecetaLinea({
          itemProducidoId: ptId,
          componenteId: lines[0].componenteId,
          cantidad: lines[0].cantidad,
          esVariable: lines[0].esVariable,
        });
      } else {
        await createRecetaLineas(ptId, lines);
      }
      setSuccess(
        lines.length === 1
          ? 'Componente agregado a la receta.'
          : `${lines.length} componentes agregados a la receta.`,
      );
      setBomModal(false);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo guardar la receta'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLine) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const qty = parseFloat(editCantidad);
      await updateRecetaLinea({
        id: editLine.id,
        cantidad: qty,
        esVariable: editVariable,
      });
      setSuccess('Línea de receta actualizada.');
      setEditModal(false);
      setEditLine(null);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo actualizar la línea'));
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

  const handleDeleteRecipe = async (itemProducidoId: string, label: string) => {
    if (!confirm(`¿Eliminar toda la receta de "${label}"? Se quitarán todas las líneas BOM. Los materiales del catálogo no se eliminan.`)) {
      return;
    }
    setError(null);
    try {
      await deleteRecetasDePt(itemProducidoId);
      setSuccess(`Receta de ${label} eliminada.`);
      await load();
    } catch (err) {
      setError(toUserMessage(err, 'No se pudo eliminar la receta'));
    }
  };

  const editComp = editLine
    ? (editLine.componente ?? editLine.ma_item_componente)
    : null;

  const filterPtItem = pts.find((p) => p.id === filterPt);
  const filterHasNoBom = !!filterPt && !ptsConReceta.has(filterPt);

  return (
    <div className="animate-in">
      <PageHeader
        title="Recetas"
        subtitle={isAdmin
          ? 'BOM por botella — armar y editar con materiales del catálogo'
          : 'Fórmulas por botella (consulta)'}
        moduleId="recetas"
      />
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="card card-section">
        <div className="form-row form-row--end">
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
            <button type="button" className="btn btn-primary" onClick={() => openBom(filterPt || undefined)}>
              <span className="material-icons-round">playlist_add</span>
              Armar / agregar BOM
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
      ) : (
        <>
          {isAdmin && ptsSinReceta.length > 0 && !filterPt && (
            <div className="card card-section">
              <h3 className="card-section-title">PT sin receta ({ptsSinReceta.length})</h3>
              <p className="kpi-sub" style={{ marginBottom: '0.75rem' }}>
                Productos terminados del catálogo sin líneas BOM. Ármelos antes de producir.
              </p>
              <div className="recipes-pt-chips">
                {ptsSinReceta.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openBom(p.id)}
                  >
                    <code className="code-tag">{p.codigo}</code>
                    {p.nombre}
                    <span className="material-icons-round" style={{ fontSize: 16 }}>add</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {Object.keys(grouped).length === 0 ? (
            <EmptyState
              icon="menu_book"
              title={filterHasNoBom
                ? `Sin BOM para ${filterPtItem?.codigo ?? 'este PT'}`
                : 'Sin recetas'}
              hint={isAdmin
                ? (filterHasNoBom
                  ? 'Arme la receta con materiales existentes y cantidades por botella.'
                  : 'Elija un PT y agregue componentes (granel, empaque, insumos).')
                : undefined}
              action={isAdmin ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => openBom(filterPt || undefined)}
                >
                  <span className="material-icons-round">playlist_add</span>
                  Armar receta
                </button>
              ) : undefined}
            />
          ) : (
            Object.entries(grouped).map(([ptKey, group]) => (
              <div className="card card-section" key={ptKey}>
                <div className="recipes-group-header">
                  <h3>
                    {group.codigo && <code className="code-tag">{group.codigo}</code>}
                    {group.label}
                    <span className="kpi-sub" style={{ marginLeft: 8 }}>
                      {group.lines.length} componente{group.lines.length === 1 ? '' : 's'}
                    </span>
                  </h3>
                  {isAdmin && (
                    <div className="cell-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openBom(ptKey)}>
                        <span className="material-icons-round">add</span>
                        Agregar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Eliminar toda la receta"
                        onClick={() => handleDeleteRecipe(ptKey, group.codigo ?? group.label)}
                      >
                        <span className="material-icons-round">delete_outline</span>
                      </button>
                    </div>
                  )}
                </div>
                <DataTable>
                  <thead>
                    <tr>
                      <th>Componente</th>
                      <th>Tipo</th>
                      <th>Cantidad / botella</th>
                      <th>UM</th>
                      <th>Variable</th>
                      {isAdmin && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {group.lines.map((r) => {
                      const comp = r.componente ?? r.ma_item_componente;
                      return (
                        <tr key={r.id}>
                          <td>
                            {comp?.codigo && <code className="code-tag">{comp.codigo}</code>}
                            {' '}
                            {comp?.nombre ?? '—'}
                          </td>
                          <td><span className="status-tag status-neutral">{comp?.tipo ?? '—'}</span></td>
                          <td className="cell-num">{fmtNum(r.cantidad, 4)}</td>
                          <td>{comp?.unidad_medida ?? '—'}</td>
                          <td>{r.es_variable ? 'Sí' : 'No'}</td>
                          {isAdmin && (
                            <td className="cell-actions">
                              <button type="button" className="btn-icon" title="Editar" onClick={() => openEdit(r)}>
                                <span className="material-icons-round">edit</span>
                              </button>
                              <button type="button" className="btn-icon" title="Quitar" onClick={() => handleDeleteLine(r)}>
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
        </>
      )}

      <Modal
        title="Armar / agregar BOM"
        isOpen={bomModal}
        onClose={() => setBomModal(false)}
      >
        <form onSubmit={handleSaveBom}>
          <FormSection title="Producto terminado">
            <FormSelect
              label="PT (ya debe existir en Materiales)"
              value={ptId}
              onChange={setPtId}
              required
              options={pts.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` }))}
            />
            {ptId && (usedByPt.get(ptId)?.size ?? 0) > 0 && (
              <p className="kpi-sub">
                Esta receta ya tiene {usedByPt.get(ptId)!.size} componente(s). Solo se listan materiales aún no usados.
              </p>
            )}
          </FormSection>

          <FormSection title="Componentes (cantidad por 1 botella)">
            {draftLines.map((d) => {
              const comp = d.componenteId ? compById.get(d.componenteId) : undefined;
              const opts = availableForPt(ptId, new Set([d.key]));
              const stillInList = comp && opts.some((o) => o.id === comp.id);
              const selectOpts = [
                ...(comp && !stillInList
                  ? [{ value: comp.id, label: `${comp.codigo} — ${comp.nombre} (${comp.tipo})` }]
                  : []),
                ...opts.map((c) => ({
                  value: c.id,
                  label: `${c.codigo} — ${c.nombre} (${c.tipo} · ${c.unidad_medida})`,
                })),
              ];
              return (
                <div key={d.key} className="recipes-draft-row">
                  <FormSelect
                    label="Material"
                    value={d.componenteId}
                    onChange={(v) => updateDraft(d.key, { componenteId: v })}
                    required
                    options={selectOpts}
                  />
                  <FormInput
                    label={comp ? `Cantidad (${comp.unidad_medida})` : 'Cantidad'}
                    type="number"
                    value={d.cantidad}
                    onChange={(v) => updateDraft(d.key, { cantidad: v })}
                    required
                    min={0.0001}
                    step="any"
                  />
                  <FormSelect
                    label="Variable"
                    value={d.esVariable ? '1' : '0'}
                    onChange={(v) => updateDraft(d.key, { esVariable: v === '1' })}
                    options={[
                      { value: '0', label: 'Fija' },
                      { value: '1', label: 'Variable' },
                    ]}
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    title="Quitar fila"
                    onClick={() => removeDraft(d.key)}
                  >
                    <span className="material-icons-round">close</span>
                  </button>
                </div>
              );
            })}
            <div className="form-actions form-actions--flat">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!ptId || availableForPt(ptId).length === 0}
                onClick={() => setDraftLines((prev) => [...prev, emptyDraft()])}
              >
                <span className="material-icons-round">add</span>
                Otra línea
              </button>
            </div>
            <p className="qty-base-summary">
              Ej.: granel 0.75 L · botella/tapa/etiqueta 1 Unidad. UM tomada del catálogo del material.
            </p>
          </FormSection>

          <div className="form-actions">
            <SubmitButton loading={saving} label="Guardar en receta" icon="save" />
          </div>
        </form>
      </Modal>

      <Modal
        title="Editar línea de receta"
        isOpen={editModal}
        onClose={() => { setEditModal(false); setEditLine(null); }}
      >
        <form onSubmit={handleSaveEdit}>
          {editComp && (
            <p className="kpi-sub" style={{ marginBottom: '1rem' }}>
              <code className="code-tag">{editComp.codigo}</code>
              {' '}
              {editComp.nombre}
              {' · '}
              {editComp.tipo}
              {' · UM: '}
              <strong>{editComp.unidad_medida}</strong>
            </p>
          )}
          <FormInput
            label={editComp ? `Cantidad por botella (${editComp.unidad_medida})` : 'Cantidad por botella'}
            type="number"
            value={editCantidad}
            onChange={setEditCantidad}
            required
            min={0.0001}
            step="any"
          />
          <FormSelect
            label="Cantidad variable"
            value={editVariable ? '1' : '0'}
            onChange={(v) => setEditVariable(v === '1')}
            options={[
              { value: '0', label: 'Fija' },
              { value: '1', label: 'Variable (ajustable en producción)' },
            ]}
          />
          <div className="form-actions">
            <SubmitButton loading={saving} label="Guardar cambios" icon="save" />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RecipesPage;
