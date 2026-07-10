import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, touchMovimiento, genUUID, SENTINEL_ID, getOcasionalCorrelativo } from '../db/database';
import {
  ChevronLeft, Plus, X, Search, Check, Delete, Trash2,
  RotateCcw, Settings2, CheckCircle, DollarSign, Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

/* ─── Contraste dinámico ─── */
function getLum(hex) {
  const c = (hex || '#000').replace('#', '');
  if (c.length < 6) return 0;
  const L = x => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * L(c.slice(0, 2)) + 0.7152 * L(c.slice(2, 4)) + 0.0722 * L(c.slice(4, 6));
}
const fg = hex => getLum(hex) > 0.35 ? '#0f172a' : '#ffffff';

/* ─── GastosModal ─── */
function GastosModal({ uuid, onClose }) {
  const extras = useLiveQuery(() => db.extras.where('id_movimiento').equals(uuid).toArray(), [uuid]) || [];
  const [desc, setDesc] = useState('');
  const [monto, setMonto] = useState('');
  const add = async () => {
    if (!desc.trim() || !monto) return;
    await db.extras.add({ id_movimiento: uuid, descripcion: desc.trim(), monto: parseFloat(monto) });
    setDesc(''); setMonto('');
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl flex flex-col pb-36" style={{ background: '#1A2438', maxHeight: '65vh' }}>
        <div className="flex justify-center pt-2"><div className="w-8 h-1 rounded-full bg-slate-600" /></div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-white font-bold text-sm">Gastos / Extras</span>
          <button onClick={onClose}><X size={15} className="text-slate-400" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-2 min-h-0">
          {extras.map(ex => (
            <div key={ex.id_extra} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-white text-sm">{ex.descripcion}</span>
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-mono font-bold text-sm">S/ {Number(ex.monto).toFixed(2)}</span>
                <button onClick={() => db.extras.delete(ex.id_extra)}><Trash2 size={13} className="text-red-400" /></button>
              </div>
            </div>
          ))}
          {extras.length === 0 && <p className="text-slate-600 text-sm text-center py-4">Sin gastos aún</p>}
        </div>
        <div className="px-4 pb-5 pt-2 border-t border-white/5">
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="Flete, Estiba..." value={desc} onChange={e => setDesc(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="number" placeholder="S/" value={monto} onChange={e => setMonto(e.target.value)}
              className="w-20 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs outline-none" />
          </div>
          <button onClick={add} className="w-full py-2.5 rounded-xl bg-amber-600/80 text-white font-bold text-xs active:scale-95 transition-all">+ Agregar</button>
        </div>
      </div>
    </div>
  );
}

/* ─── EditSacoModal ─── */
function EditSacoModal({ saco, onClose }) {
  const [p, setP] = useState(String(saco.peso));
  const save = async () => {
    const w = parseFloat(p);
    if (!w || w <= 0) return;
    await db.sacos.update(saco.id_saco, { peso: w });
    if (saco.uuid_movimiento) touchMovimiento(saco.uuid_movimiento);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs rounded-2xl p-5" style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-bold text-sm mb-3">Editar peso (kg)</p>
        <input autoFocus type="number" value={p} onChange={e => setP(e.target.value)}
          className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 text-white rounded-xl px-3 py-2.5 text-sm outline-none mb-3 font-mono" />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-slate-400 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
          <button onClick={save} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95">Guardar</button>
        </div>
      </div>
    </div>
  );
}


function AjustePesoModal({ vid, pesoBruto, tipoAjusteInicial, kilosAjusteInicial, onClose, onApply, colorTema = 'blue' }) {
  const [kilos, setKilos] = useState(kilosAjusteInicial || 0);
  const [tipo, setTipo] = useState(tipoAjusteInicial || 'NINGUNO');

  const pesoNeto = useMemo(() => {
    const k = parseFloat(kilos) || 0;
    if (tipo === 'RESTAR') return Math.max(0, pesoBruto - k);
    if (tipo === 'SUMAR') return pesoBruto + k;
    return pesoBruto;
  }, [pesoBruto, kilos, tipo]);

  const handleApply = () => {
    const k = parseFloat(kilos) || 0;
    onApply(vid, k > 0 ? tipo : 'NINGUNO', k > 0 ? k : 0);
    onClose();
  };

  const themeConfig = {
    blue: { bgActive: 'bg-blue-600/30 border border-blue-500/50 text-blue-300', btnBg: 'bg-blue-600' },
    emerald: { bgActive: 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300', btnBg: 'bg-emerald-600' }
  };
  const th = themeConfig[colorTema] || themeConfig.blue;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs rounded-2xl p-5" style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-bold text-sm mb-3">Ajustar Peso</p>
        <div className="text-slate-300 text-xs mb-3">
          Peso Balanza: <span className="font-mono font-bold">{pesoBruto.toFixed(1)} kg</span>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            type="number"
            placeholder="Kilos"
            value={kilos || ''}
            onChange={e => {
              const val = e.target.value;
              setKilos(val);
              if (tipo === 'NINGUNO') setTipo('RESTAR');
            }}
            className="flex-1 bg-white/5 border border-white/10 focus:border-blue-500/50 text-white rounded-xl px-3 py-2 text-sm outline-none font-mono"
          />
          <div className="flex flex-col gap-1 w-28">
            <button
              onClick={() => setTipo('RESTAR')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                tipo === 'RESTAR' ? 'bg-red-600/30 border border-red-500/50 text-red-300' : 'bg-white/5 border border-white/10 text-slate-400'
              }`}
            >
              [-] Restar
            </button>
            <button
              onClick={() => setTipo('SUMAR')}
              className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all ${
                tipo === 'SUMAR' ? 'bg-emerald-600/30 border border-emerald-500/50 text-emerald-300' : 'bg-white/5 border border-white/10 text-slate-400'
              }`}
            >
              [+] Sumar
            </button>
          </div>
        </div>
        <div className="text-slate-400 text-xs mb-4">
          Peso Neto Final: <span className="text-white font-mono font-bold">{pesoNeto.toFixed(1)} kg</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-slate-400 text-sm font-bold bg-white/5">
            Cancelar
          </button>
          <button onClick={handleApply} className={`flex-1 py-2 rounded-xl text-white text-sm font-bold active:scale-95 ${th.btnBg}`}>
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── VariedadModal ─── */
function VariedadModal({ variedades, excluir = [], onSelect, onClose, uuidActivo }) {
  const [q, setQ] = useState('');
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ nombre: '', codigo_corto: '', color: '#10B981' });
  const ref = useRef(null);

  const COLORES = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#06b6d4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'];

  useEffect(() => { if (!creando) ref.current?.focus(); }, [creando]);

  const lista = variedades.filter(v =>
    !excluir.includes(v.id_variedad) &&
    (v.nombre.toLowerCase().includes(q.toLowerCase()) || (v.codigo_corto || '').toLowerCase().includes(q.toLowerCase()))
  );

  const startCreate = () => {
    let propCode = q.substring(0, 2).toUpperCase();
    if (q.includes(' ')) {
      const parts = q.split(' ');
      if (parts[1]) propCode = (parts[0][0] + parts[1][0]).toUpperCase();
    }
    setForm({ nombre: q, codigo_corto: propCode, color: COLORES[Math.floor(Math.random() * COLORES.length)] });
    setCreando(true);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.codigo_corto.trim()) return;

    let id;
    await db.transaction('rw', db.variedades, db.movimientos, async () => {
      id = await db.variedades.add({
        nombre: form.nombre.trim(),
        codigo_corto: form.codigo_corto.trim().toUpperCase(),
        color: form.color
      });

      if (uuidActivo) {
        const mov = await db.movimientos.where('uuid').equals(uuidActivo).first();
        if (mov) {
          const activas = new Set(mov.ids_variedades_activas || []);
          activas.add(id);
          await db.movimientos.where('uuid').equals(uuidActivo).modify({
            ultima_variedad_id: id,
            ids_variedades_activas: Array.from(activas)
          });
        }
      }
    });

    const nuevaVar = { id_variedad: id, ...form, codigo_corto: form.codigo_corto.trim().toUpperCase() };
    onSelect(nuevaVar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg flex flex-col h-full" style={{ background: '#1A2438' }}>
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-white font-bold text-sm">{creando ? 'Nueva Variedad' : 'Seleccionar Variedad'}</span>
          <button onClick={onClose}><X size={15} className="text-slate-400" /></button>
        </div>

        {creando ? (
          <div className="px-4 pb-6 space-y-3 overflow-y-auto">
            <div>
              <label className="text-slate-400 text-xs font-bold mb-1 block">Nombre y tamaño de la Variedad</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500/50" autoFocus />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold mb-1 block">Código Corto (Max 8 carácteres)</label>
              <input type="text" maxLength={8} value={form.codigo_corto} onChange={e => setForm({ ...form, codigo_corto: e.target.value })} className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500/50 uppercase" />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold mb-2 block">Color Distintivo</label>
              <div className="flex flex-wrap gap-2">
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90" style={{ backgroundColor: c, border: form.color === c ? '2px solid white' : '2px solid transparent' }}>
                    {form.color === c && <Check size={14} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button onClick={() => setCreando(false)} className="flex-1 py-2.5 rounded-xl text-slate-400 text-sm font-bold bg-white/5">Cancelar</button>
              <button onClick={handleSave} disabled={!form.nombre.trim() || !form.codigo_corto.trim()} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black disabled:opacity-50">Guardar y Usar</button>
            </div>
          </div>
        ) : (
          <>
            {/* Buscador fijo */}
            <div className="px-4 pt-3 mb-2 flex-shrink-0">
              <div className="flex items-center bg-black/30 rounded-xl px-3 py-2.5 border border-white/10 focus-within:border-emerald-500/50">
                <Search size={14} className="text-slate-500 mr-2 flex-shrink-0" />
                <input ref={ref} type="text" placeholder="Buscar..." className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
            {/* Lista scrollable */}
            <div className="overflow-y-auto flex-1 px-4 space-y-1.5 min-h-0 pb-4">
              {lista.map(v => (
                <button key={v.id_variedad} onClick={() => { onSelect(v); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-[2.5rem] px-1.5 h-10 flex-shrink-0 rounded-xl flex items-center justify-center font-black text-xs"
                    style={{ backgroundColor: v.color, color: fg(v.color), boxShadow: `0 3px 10px ${v.color}60` }}>
                    {v.codigo_corto}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{v.nombre}</p>
                  </div>
                </button>
              ))}
            </div>
            {/* Botón Crear — siempre pegado al fondo */}
            <div className="flex-shrink-0 px-4 pt-2 pb-8 border-t border-white/5">
              <button onClick={startCreate} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98]" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400">
                  <Plus size={14} />
                </div>
                <div className="text-left">
                  <p className="text-emerald-400 font-bold text-sm truncate">
                    {variedades.length === 0 ? 'Crear tu primera variedad' : (q.trim() ? `Crear "${q.trim()}"` : 'Crear nueva variedad')}
                  </p>
                  <p className="text-emerald-500/70 text-xs">Nueva variedad en catálogo</p>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── BuscadorSocioModal ─── */
function BuscadorSocioModal({ socios, term = '', onClose, onSelect, onNuevaFrecuente, onNuevaOcasional, colorTema = 'emerald', tipoRapida = 'venta', fechaSeleccionada }) {
  const [q, setQ] = useState(term);
  const [creando, setCreando] = useState(false);
  const [form, setForm] = useState({ nombre: '', documento: '', telefono: '' });
  const [correlativo, setCorrelativo] = useState(1);
  const ref = useRef(null);

  useEffect(() => { if (!creando) ref.current?.focus(); }, [creando]);

  // Calcular correlativo del día al abrir el modal
  useEffect(() => {
    getOcasionalCorrelativo(tipoRapida, fechaSeleccionada).then(n => setCorrelativo(n));
  }, [tipoRapida, fechaSeleccionada]);

  // Excluir el centinela del sistema de la lista de búsqueda
  const lista = socios.filter(s =>
    String(s.id_socio) !== SENTINEL_ID &&
    (s.nombre.toLowerCase().includes(q.toLowerCase()) ||
    s.documento?.toLowerCase().includes(q.toLowerCase()) ||
    s.telefono?.toLowerCase().includes(q.toLowerCase()))
  );

  const themeColors = {
    emerald: { bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/50', lightBg: 'bg-emerald-500/20', focus: 'focus-within:border-emerald-500/50' },
    blue: { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500/50', lightBg: 'bg-blue-500/20', focus: 'focus-within:border-blue-500/50' }
  };
  const th = themeColors[colorTema] || themeColors.emerald;

  const handleStartCreate = (nombre) => {
    setForm({ nombre, documento: '', telefono: '' });
    setCreando(true);
  };

  const handleSaveFrecuente = () => {
    if (!form.nombre.trim()) return;
    onNuevaFrecuente(form);
  };

  // Texto del botón rápido: nombre final que se guardará en socio_nombre_temporal
  const labelRapida = q.trim()
    ? `Venta Rápida (${q.trim()})`
    : `Venta Rápida (Cliente ${correlativo})`;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg flex flex-col h-full" style={{ background: '#1A2438' }}>
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-white font-bold text-sm">{creando ? 'Nuevo Socio Frecuente' : 'Buscar o Crear'}</span>
          <button onClick={onClose}><X size={15} className="text-slate-400" /></button>
        </div>

        {creando ? (
          <div className="px-4 pb-8 pt-4 space-y-3 overflow-y-auto">
            <div>
              <label className="text-slate-400 text-xs font-bold mb-1 block">Nombre Completo o Razón Social</label>
              <input type="text" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className={`w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:${th.border}`} autoFocus />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-bold mb-1 block">DNI / RUC (Opcional)</label>
                <input type="text" value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} className={`w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:${th.border}`} />
              </div>
              <div className="flex-1">
                <label className="text-slate-400 text-xs font-bold mb-1 block">Teléfono (Opcional)</label>
                <input type="text" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={`w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm outline-none focus:${th.border}`} />
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <button onClick={() => setCreando(false)} className="flex-1 py-3 rounded-xl text-slate-400 text-sm font-bold bg-white/5 active:scale-95 transition-transform">Cancelar</button>
              <button onClick={handleSaveFrecuente} disabled={!form.nombre.trim()} className={`flex-1 py-3 rounded-xl ${th.bg} text-white text-sm font-black disabled:opacity-50 active:scale-95 transition-transform`}>Guardar Socio</button>
            </div>
          </div>
        ) : (
          <>
            {/* Buscador fijo — SIN autoFocus para no abrir teclado automáticamente */}
            <div className="px-4 pt-3 mb-2 flex-shrink-0">
              <div className={`flex items-center bg-black/30 rounded-xl px-3 py-2.5 border border-white/10 ${th.focus}`}>
                <Search size={14} className="text-slate-500 mr-2 flex-shrink-0" />
                <input ref={ref} type="text" placeholder="Escribe nombre, DNI o celular..." className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-sm font-medium" value={q} onChange={e => setQ(e.target.value)} />
              </div>
            </div>
            {/* Lista scrollable */}
            <div className="overflow-y-auto flex-1 px-4 space-y-1.5 min-h-0 pb-4">

              {/* 1. OPERACION RAPIDA — siempre primero */}
              <button onClick={() => onNuevaOcasional(q.trim())} className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all active:scale-[0.98] mb-2" style={{ background: 'rgba(250,204,21,0.15)', border: '1px solid rgba(250,204,21,0.3)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400/20 text-yellow-500 font-black">⚡</div>
                  <div className="text-left">
                    <p className="text-yellow-400 font-bold text-sm">{labelRapida}</p>
                    <p className="text-yellow-500/80 text-xs">Sin registro permanente en socios</p>
                  </div>
                </div>
              </button>

              {/* 2. SI LISTA VACIA Y NO SE ESTA BUSCANDO */}
              {!q.trim() && socios.length === 0 && (
                <div className="py-6 flex justify-center">
                  <button onClick={() => handleStartCreate('')} className="w-full max-w-[260px] py-4 rounded-xl flex flex-col items-center justify-center transition-all active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                    <Plus size={24} className="text-slate-400 mb-2" />
                    <p className="text-white font-bold text-sm">Crear primer Socio Frecuente</p>
                    <p className="text-slate-500 text-xs mt-1">Con DNI y registro permanente</p>
                  </button>
                </div>
              )}

              {/* 3. RESULTADOS DE BUSQUEDA */}
              {lista.map(c => {
                const isOcasional = c.es_ocasional === 1;
                return (
                  <button key={c.id_socio} onClick={() => { onSelect(c); onClose(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs" style={{ background: isOcasional ? 'rgba(250,204,21,0.1)' : 'rgba(100,116,139,0.3)', color: isOcasional ? '#FACC15' : '#cbd5e1' }}>
                      {isOcasional ? '⚡' : c.nombre[0].toUpperCase()}
                    </div>
                    <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
                      <p className="text-white text-sm font-semibold truncate leading-tight">{c.nombre}</p>
                      {c.documento && <p className="text-slate-400 text-[11px] font-mono mt-0.5">{c.documento} {c.telefono && `• ${c.telefono}`}</p>}
                      {!c.documento && c.telefono && <p className="text-slate-400 text-[11px] font-mono mt-0.5">{c.telefono}</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Botón Crear Frecuente — siempre pegado al fondo */}
            {(socios.length > 0 || q.trim()) && (
              <div className="flex-shrink-0 px-4 pt-2 pb-8 border-t border-white/5">
                <button onClick={() => handleStartCreate(q.trim())} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${th.lightBg} ${th.text}`}><Plus size={14} /></div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm truncate">{q.trim() ? `Crear a "${q.trim()}" como Frecuente` : 'Crear nuevo Socio Frecuente'}</p>
                    <p className="text-slate-400 text-[11px]">Se agregará a tu directorio</p>
                  </div>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PreLiquidadorModal({
  sacos,
  activeMov,
  varIds,
  varMap,
  preciosIniciales,
  extras,
  adicsCommitted,
  totalPesoNeto,
  onCancel,
  onConfirm,
  tipoMov = 'venta'
}) {
  const [preciosLocales, setPreciosLocales] = useState({ ...preciosIniciales });
  const [pagoMetodo, setPagoMetodo] = useState('efectivo');
  const [pagoMonto, setPagoMonto] = useState('');

  const getVarietyNetWeight = (vid) => {
    const sx = sacos.filter(s => s.id_variedad === vid);
    const bruto = sx.reduce((a, s) => a + s.peso, 0);
    const info = activeMov?.variedades?.[vid] || {};
    const tipo = info.tipo_ajuste || 'NINGUNO';
    const kilos = info.kilos_ajuste || 0;
    return tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
  };

  const totalDineroLocal = useMemo(() => {
    return varIds.reduce((acc, vid) => {
      const neto = getVarietyNetWeight(vid);
      const p = parseFloat(preciosLocales[vid] || 0);
      const info = activeMov?.variedades?.[vid] || {};
      const unit = info.unidad_precio || 'KG';
      const sub = unit === 'ARROBA' ? (neto / 11.5) * p : neto * p;
      return acc + sub;
    }, 0);
  }, [sacos, activeMov, preciosLocales, varIds]);

  const totalExtras = extras.reduce((a, e) => a + (Number(e.monto) || 0), 0);

  const totalAdicionales = adicsCommitted.reduce((acc, a) => {
    const v = parseFloat(a.monto) || 0;
    return a.op === '+' ? acc + v : acc - v;
  }, 0);

  const montoFinalLocal = useMemo(() => {
    return totalDineroLocal - totalExtras + totalAdicionales;
  }, [totalDineroLocal, totalExtras, totalAdicionales]);

  const handleTodo = () => {
    setPagoMonto(montoFinalLocal.toFixed(2));
  };

  const handleFinalizar = () => {
    onConfirm(preciosLocales, montoFinalLocal, pagoMetodo, pagoMonto);
  };

  const labelPago = 'REGISTRAR COBRO';

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      
      <div className="relative w-full max-w-xl md:max-w-2xl bg-[#1A2438] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] border border-white/5">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="text-white text-base font-black uppercase tracking-wider">Liquidación y Cierre</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-2">Variedad</th>
                    <th className="py-2 text-center">Sacos</th>
                    <th className="py-2 text-right">Peso Neto</th>
                    <th className="py-2 text-center">Precio</th>
                    <th className="py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-xs">
                  {varIds.map(vid => {
                    const v = varMap[vid];
                    const sx = sacos.filter(s => s.id_variedad === vid);
                    const neto = getVarietyNetWeight(vid);
                    const info = activeMov?.variedades?.[vid] || {};
                    const unit = info.unidad_precio || 'KG';
                    const price = parseFloat(preciosLocales[vid] || 0);
                    const sub = unit === 'ARROBA' ? (neto / 11.5) * price : neto * price;

                    return (
                      <tr key={vid} className="hover:bg-white/3 transition-colors">
                        <td className="py-3 flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: v?.color || '#10b981' }} />
                          <span className="font-bold text-white">{v?.nombre || vid}</span>
                        </td>
                        <td className="py-3 text-center font-bold text-white">{sx.length}</td>
                        <td className="py-3 text-right font-mono font-bold text-slate-400">{neto.toFixed(1)} kg</td>
                        <td className="py-3 text-center">
                          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 focus-within:border-emerald-500/50">
                            <span className="text-[10px] text-slate-500 font-bold">S/</span>
                            <input
                              type="number"
                              step="any"
                              value={preciosLocales[vid] ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreciosLocales(prev => ({ ...prev, [vid]: val }));
                              }}
                              className="w-16 bg-transparent border-none text-white text-right outline-none font-mono text-xs font-bold"
                            />
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{unit === 'ARROBA' ? '@' : 'kg'}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-white">S/ {sub.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-emerald-600/5 font-bold text-white border-t-2 border-emerald-500/20">
                    <td className="py-3 px-2 text-emerald-300 text-[10px] font-black uppercase">Total General</td>
                    <td className="py-3 text-center">{sacos.length}</td>
                    <td className="py-3 text-right font-mono">{totalPesoNeto.toFixed(1)} kg</td>
                    <td className="py-3"></td>
                    <td className="py-3 text-right font-mono text-emerald-400">S/ {totalDineroLocal.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 bg-white/3 rounded-xl p-3 border border-white/5 space-y-2">
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-wider border-b border-white/5 pb-1">Conceptos Adicionales</p>
              
              {extras.map(e => (
                <div key={e.id_extra} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{e.descripcion}</span>
                  <span className="font-mono font-bold text-red-400">−S/ {Number(e.monto).toFixed(2)}</span>
                </div>
              ))}

              {adicsCommitted.map(a => (
                <div key={a.id} className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">{a.desc}</span>
                  <span className={`font-mono font-bold ${a.op === '+' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {a.op === '+' ? '+' : '−'}S/ {parseFloat(a.monto).toFixed(2)}
                  </span>
                </div>
              ))}

              {extras.length === 0 && adicsCommitted.length === 0 && (
                <p className="text-slate-600 text-[10px] italic">Ninguno aplicado</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between bg-emerald-600/10 border border-emerald-500/25 rounded-2xl px-4 py-3">
              <span className="text-emerald-300 text-xs font-black uppercase tracking-wider">Monto Final Recalculado</span>
              <span className="text-emerald-400 text-xl font-black font-mono">S/ {montoFinalLocal.toFixed(2)}</span>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{labelPago}</p>
            
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: 'efectivo', l: '💵 Efectivo' },
                { k: 'yape', l: '📱 Yape' },
                { k: 'deposito', l: '🏦 Depósito' }
              ].map(({ k, l }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setPagoMetodo(k)}
                  className="py-2.5 rounded-xl text-xs font-black transition-all border outline-none active:scale-95"
                  style={{
                    backgroundColor: pagoMetodo === k ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                    borderColor: pagoMetodo === k ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)',
                    color: pagoMetodo === k ? '#34d399' : '#94a3b8'
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white/5 border border-white/10 rounded-xl px-3 focus-within:border-emerald-500/50">
                <span className="text-slate-500 font-bold text-xs mr-2">S/</span>
                <input
                  type="number"
                  placeholder={`Max S/ ${montoFinalLocal.toFixed(2)}`}
                  value={pagoMonto}
                  onChange={(e) => setPagoMonto(e.target.value)}
                  className="flex-1 bg-transparent border-none text-white py-3 text-sm outline-none font-mono focus:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={handleTodo}
                className="px-4 py-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-black transition-all hover:bg-emerald-600/30 active:scale-95"
              >
                TODO
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#131b2b] px-6 py-4 flex gap-3 border-t border-white/5">
          <button
            onClick={onCancel}
            type="button"
            className="flex-1 py-3.5 rounded-xl text-slate-400 text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleFinalizar}
            type="button"
            className="flex-1 py-3.5 rounded-xl bg-emerald-600 text-white text-sm font-black transition-all hover:bg-emerald-500 active:scale-[0.98]"
          >
            Finalizar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Btn del teclado ─── */
function Btn({ label, icon, onClick, style = {} }) {
  return (
    <button onClick={onClick} className="rounded-xl flex items-center justify-center text-white text-2xl font-bold transition-all active:scale-95"
      style={{ background: 'linear-gradient(145deg,#1E293B,#162032)', boxShadow: '0 3px 0 #0a1120', ...style }}>
      {icon || label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export default function Venta() {
  const navigate = useNavigate();
  const hiddenRef = useRef(null);
  // Fecha en hora peruana (UTC-5) — toISOString() usaría UTC y el día cambiaría a las 7 PM hora Lima
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

  // UUID dinámico — permite cambiar entre sesiones desde el carrusel
  const [uuidActivo, setUuidActivo] = useState(() => localStorage.getItem('venta_activa_uuid') || '');

  const [clienteId, setClienteId] = useState('');
  const [fecha, setFecha] = useState(() => {
    const activeUuid = localStorage.getItem('venta_activa_uuid') || '';
    return activeUuid ? '' : hoy;
  });
  const [precios, setPrecios] = useState({});

  const [variedadesSeleccionadas, setVariedadesSeleccionadas] = useState([]);
  const [variedadActiva, setVariedadActiva] = useState(null);
  const [modoConfig, setModoConfig] = useState(false);
  const [showVariedadModal, setShowVM] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null);

  const [peso, setPeso] = useState('');
  const [flashOk, setFlashOk] = useState(false);
  const [showBuscadorCliente, setShowBC] = useState(false);
  const [showFinalizar, setShowFin] = useState(false);
  const [showGastos, setShowGastos] = useState(false);
  const [editSaco, setEditSaco] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);   // saco a eliminar
  const [sacoAccion, setSacoAccion] = useState(null);   // { saco, color } — sheet acción
  const [showAjusteModal, setShowAjusteModal] = useState(null); // { vid, pesoBruto, tipoAjuste, kilosAjuste }

  // Adicionales confirmados y fila de input única
  const [adicsCommitted, setAdicsCommitted] = useState([]);
  const [adicDesc, setAdicDesc] = useState('');
  const [adicMonto, setAdicMonto] = useState('');
  const nextAdicId = useRef(1);

  /* ─── Queries ─── */
  const clientes = useLiveQuery(() => db.socios.where('es_cliente').equals(1).toArray()) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];

  // Carrusel: ventas activas de hoy (incluye la activa aunque sea de fecha pasada para que no desaparezca de la UI)
  const ventasHoy = useLiveQuery(async () => {
    const hoyMovs = await db.movimientos.where('fecha').equals(hoy).filter(m => m.tipo === 'venta' && m.estado !== 'finalizado').toArray();
    if (uuidActivo) {
      const active = await db.movimientos.where('uuid').equals(uuidActivo).first();
      if (active && active.fecha !== hoy && active.estado !== 'finalizado' && active.tipo === 'venta') {
        if (!hoyMovs.some(m => m.uuid === uuidActivo)) {
          hoyMovs.push(active);
        }
      }
    }
    return hoyMovs;
  }, [hoy, uuidActivo]) || [];

  // Resumen reactivo de sacos + variedades para TODOS los slots del carrusel
  const sacosResumen = useLiveQuery(async () => {
    if (!ventasHoy.length) return {};
    const uuids = ventasHoy.map(v => v.uuid);
    const todosSacos = await db.sacos
      .where('uuid_movimiento').anyOf(uuids).toArray();
    const res = {};
    for (const uuid of uuids) {
      const sx = todosSacos.filter(s => s.uuid_movimiento === uuid);
      const conteoPorVar = {};
      sx.forEach(s => { conteoPorVar[s.id_variedad] = (conteoPorVar[s.id_variedad] || 0) + 1; });
      res[uuid] = { total: sx.length, conteoPorVar };
    }
    return res;
  }, [ventasHoy.length, ventasHoy.map(v => v.uuid).join(',')]) || {};

  // Carrusel filtrado (sin registros vacíos inactivos) y ordenado más-nuevo primero
  const ventasCarrusel = useMemo(() => {
    return ventasHoy
      .filter(v => {
        const r = sacosResumen[v.uuid];
        return v.uuid === uuidActivo || (r && r.total > 0);
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [ventasHoy, sacosResumen, uuidActivo]);

  const activeMov = useLiveQuery(
    () => uuidActivo ? db.movimientos.where('uuid').equals(uuidActivo).first() : Promise.resolve(null),
    [uuidActivo]
  );

  const sacos = useLiveQuery(
    () => uuidActivo ? db.sacos.where('uuid_movimiento').equals(uuidActivo).sortBy('timestamp') : Promise.resolve([]),
    [uuidActivo]
  ) || [];

  const extras = useLiveQuery(
    () => uuidActivo ? db.extras.where('id_movimiento').equals(uuidActivo).toArray() : Promise.resolve([]),
    [uuidActivo]
  ) || [];

  /* ─── Hidratación al cambiar UUID ─── */
  useEffect(() => {
    if (!uuidActivo || variedades.length === 0) return;
    let canceled = false;
    async function hydrate() {
      const mov = await db.movimientos.where('uuid').equals(uuidActivo).first();
      if (canceled || !mov) return;

      setClienteId(mov.id_socio ? String(mov.id_socio) : '');
      if (mov.fecha) setFecha(mov.fecha);
      if (mov.precios_por_variedad) setPrecios(mov.precios_por_variedad);

      // Restaurar adicionales guardados
      if (Array.isArray(mov.adicionales) && mov.adicionales.length > 0) {
        const restored = mov.adicionales.map((a, i) => ({
          id: i + 1,
          desc: a.descripcion,
          monto: a.monto,
          op: a.tipo === 'suma' ? '+' : '-',
        }));
        setAdicsCommitted(restored);
        nextAdicId.current = restored.length + 1;
      } else {
        setAdicsCommitted([]);
        nextAdicId.current = 1;
      }

      const sx = await db.sacos.where('uuid_movimiento').equals(uuidActivo).toArray();
      // Unir IDs de sacos + IDs guardados como activos
      const idsSacos = sx.map(s => s.id_variedad);
      const idsGuardados = mov.ids_variedades_activas || [];
      const idsUnicos = [...new Set([...idsSacos, ...idsGuardados])];

      const vars = idsUnicos.map(id => variedades.find(v => v.id_variedad === id)).filter(Boolean);

      let nextVar = null;
      if (mov.ultima_variedad_id) {
        nextVar = variedades.find(v => v.id_variedad === mov.ultima_variedad_id) || null;
        if (nextVar && !vars.find(v => v.id_variedad === nextVar.id_variedad)) {
          vars.push(nextVar);
        }
      }

      if (vars.length > 0) {
        setVariedadesSeleccionadas(vars);
        setVariedadActiva(nextVar || vars[0]);
      } else {
        setVariedadesSeleccionadas(nextVar ? [nextVar] : []);
        setVariedadActiva(nextVar || null);
      }
    }
    hydrate();
    return () => { canceled = true; };
  }, [uuidActivo, variedades.length]);

  // Sincronizar automáticamente sacos y variedades en IndexedDB (Dexie)
  useEffect(() => {
    if (!uuidActivo || !activeMov) return;

    const groups = {};
    sacos.forEach(s => {
      groups[s.id_variedad] = (groups[s.id_variedad] || 0) + s.peso;
    });

    const currentVariedades = activeMov.variedades || {};
    let changed = false;
    const nextVariedades = { ...currentVariedades };

    const allVarIds = new Set([
      ...sacos.map(s => s.id_variedad),
      ...(activeMov.ids_variedades_activas || [])
    ]);

    allVarIds.forEach(vid => {
      const bruto = groups[vid] || 0;
      const info = currentVariedades[vid] || {
        tipo_ajuste: 'NINGUNO',
        kilos_ajuste: 0,
        unidad_precio: 'KG'
      };

      let neto = bruto;
      if (info.tipo_ajuste === 'RESTAR') {
        neto = Math.max(0, bruto - (info.kilos_ajuste || 0));
      } else if (info.tipo_ajuste === 'SUMAR') {
        neto = bruto + (info.kilos_ajuste || 0);
      }

      if (
        !currentVariedades[vid] ||
        currentVariedades[vid].peso_bruto !== bruto ||
        currentVariedades[vid].peso_neto !== neto ||
        currentVariedades[vid].tipo_ajuste !== info.tipo_ajuste ||
        currentVariedades[vid].kilos_ajuste !== info.kilos_ajuste ||
        currentVariedades[vid].unidad_precio !== info.unidad_precio
      ) {
        nextVariedades[vid] = {
          peso_bruto: bruto,
          tipo_ajuste: info.tipo_ajuste,
          kilos_ajuste: info.kilos_ajuste || 0,
          peso_neto: neto,
          unidad_precio: info.unidad_precio || 'KG'
        };
        changed = true;
      }
    });

    Object.keys(nextVariedades).forEach(vidStr => {
      const vid = Number(vidStr);
      if (!allVarIds.has(vid)) {
        delete nextVariedades[vid];
        changed = true;
      }
    });

    if (changed) {
      db.movimientos.where('uuid').equals(uuidActivo).modify({
        variedades: nextVariedades
      });
    }
  }, [sacos, uuidActivo, activeMov]);

  const handleApplyAjuste = useCallback(async (vid, tipo_ajuste, kilos_ajuste) => {
    if (!uuidActivo || !activeMov) return;
    const currentVariedades = activeMov.variedades || {};
    const currentVar = currentVariedades[vid] || {
      peso_bruto: 0,
      tipo_ajuste: 'NINGUNO',
      kilos_ajuste: 0,
      peso_neto: 0,
      unidad_precio: 'KG'
    };

    const bruto = currentVar.peso_bruto;
    let neto = bruto;
    if (tipo_ajuste === 'RESTAR') {
      neto = Math.max(0, bruto - kilos_ajuste);
    } else if (tipo_ajuste === 'SUMAR') {
      neto = bruto + kilos_ajuste;
    }

    const nextVariedades = {
      ...currentVariedades,
      [vid]: {
        ...currentVar,
        tipo_ajuste,
        kilos_ajuste,
        peso_neto: neto
      }
    };

    await db.movimientos.where('uuid').equals(uuidActivo).modify({
      variedades: nextVariedades,
      fecha_actualizacion: Date.now()
    });
  }, [uuidActivo, activeMov]);

  const toggleRowUnit = useCallback(async (vid) => {
    if (!uuidActivo || !activeMov) return;
    const currentVariedades = activeMov.variedades || {};
    const currentVar = currentVariedades[vid] || {
      peso_bruto: 0,
      tipo_ajuste: 'NINGUNO',
      kilos_ajuste: 0,
      peso_neto: 0,
      unidad_precio: 'KG'
    };

    const nextUnit = currentVar.unidad_precio === 'ARROBA' ? 'KG' : 'ARROBA';

    const nextVariedades = {
      ...currentVariedades,
      [vid]: {
        ...currentVar,
        unidad_precio: nextUnit
      }
    };

    await db.movimientos.where('uuid').equals(uuidActivo).modify({
      variedades: nextVariedades,
      fecha_actualizacion: Date.now()
    });
  }, [uuidActivo, activeMov]);

  // Effect to handle name reactivity and correlative update on date change
  useEffect(() => {
    if (!uuidActivo || !fecha) return;
    let active = true;

    async function updateCorrelativo() {
      const mov = await db.movimientos.where('uuid').equals(uuidActivo).first();
      if (!mov || !active) return;

      const [year, month, day] = fecha.split('-').map(Number);
      const now = new Date();
      const combinedTime = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
        now.getMilliseconds()
      ).getTime();

      const dateChanged = mov.fecha !== fecha;

      // Update date and timestamp in DB if it changed
      if (dateChanged) {
        await db.movimientos.where('uuid').equals(uuidActivo).modify({
          fecha,
          timestamp: combinedTime,
          fecha_actualizacion: combinedTime
        });
      }

      // Handle Quick Operation (Sentinel) name reactivity
      if (mov.id_socio === SENTINEL_ID) {
        const currentName = mov.socio_nombre_temporal || '';
        const isDefault = !currentName || currentName === 'Venta Rápida';

        if (isDefault || dateChanged) {
          const correlativo = await getOcasionalCorrelativo('venta', fecha);
          const newName = `Venta Rápida (Cliente ${correlativo})`;
          if (newName !== currentName && active) {
            await db.movimientos.where('uuid').equals(uuidActivo).modify({
              socio_nombre_temporal: newName,
              fecha_actualizacion: Date.now()
            });
          }
        }
      }
    }

    updateCorrelativo();
    return () => { active = false; };
  }, [fecha, uuidActivo]);

  /* ─── Computed ─── */
  const sacosDeVariedad = variedadActiva ? sacos.filter(s => s.id_variedad === variedadActiva.id_variedad) : [];
  const totalV = sacosDeVariedad.length;
  const loteActual = totalV % 5 === 0 && totalV > 0 ? sacosDeVariedad.slice(-5) : sacosDeVariedad.slice(-(totalV % 5 || 0));
  const loteNum = Math.floor(totalV / 5) + (totalV % 5 === 0 ? 0 : 1);
  const loteSuma = loteActual.reduce((s, x) => s + x.peso, 0);
  const accent = variedadActiva?.color || '#10B981';

  const varMap = useMemo(() => Object.fromEntries(variedades.map(v => [v.id_variedad, v])), [variedades]);
  const variedadesIds = useMemo(() => [...new Set(sacos.map(s => s.id_variedad))], [sacos]);
  const conteoPorVariedad = useMemo(() => {
    const c = {}; sacos.forEach(s => { c[s.id_variedad] = (c[s.id_variedad] || 0) + 1; }); return c;
  }, [sacos]);

  const totalPeso = sacos.reduce((a, s) => a + s.peso, 0);
  const totalPesoNeto = useMemo(() => {
    return variedadesIds.reduce((acc, vid) => {
      const sx = sacos.filter(s => s.id_variedad === vid);
      const bruto = sx.reduce((a, s) => a + s.peso, 0);
      const info = activeMov?.variedades?.[vid] || {};
      const tipo = info.tipo_ajuste || 'NINGUNO';
      const kilos = info.kilos_ajuste || 0;
      const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
      return acc + neto;
    }, 0);
  }, [sacos, activeMov, variedadesIds]);

  const totalExtras = extras.reduce((a, e) => a + (Number(e.monto) || 0), 0);
  const totalDinero = useMemo(() => {
    return variedadesIds.reduce((acc, vid) => {
      const sx = sacos.filter(s => s.id_variedad === vid);
      const bruto = sx.reduce((a, s) => a + s.peso, 0);
      const info = activeMov?.variedades?.[vid] || {};
      const tipo = info.tipo_ajuste || 'NINGUNO';
      const kilos = info.kilos_ajuste || 0;
      const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
      const p = parseFloat(precios[vid] || 0);
      const unit = info.unidad_precio || 'KG';
      const sub = unit === 'ARROBA' ? (neto / 11.5) * p : neto * p;
      return acc + sub;
    }, 0);
  }, [sacos, activeMov, precios, variedadesIds]);
  // Adicionales confirmados
  const totalAdicionales = adicsCommitted.reduce((acc, a) => {
    const v = parseFloat(a.monto) || 0;
    return a.op === '+' ? acc + v : acc - v;
  }, 0);
  const totalNeto = totalDinero - totalExtras + totalAdicionales;

  // Guardar adicionales en DB (helper interno)
  const saveAdicsToDB = useCallback((list) => {
    if (!uuidActivo) return;
    const guardados = list.map(a => ({ descripcion: a.desc, monto: a.monto, tipo: a.op === '+' ? 'suma' : 'resta' }));
    db.movimientos.where('uuid').equals(uuidActivo).modify({ adicionales: guardados });
  }, [uuidActivo]);

  // Confirmar adicional
  const commitAdic = (op) => {
    const desc = adicDesc.trim();
    const monto = parseFloat(adicMonto);
    if (!desc || !monto || monto <= 0) return;
    const nuevo = { id: nextAdicId.current++, desc, monto, op };
    setAdicsCommitted(prev => {
      const next = [...prev, nuevo];
      saveAdicsToDB(next);
      return next;
    });
    setAdicDesc('');
    setAdicMonto('');
  };

  // Eliminar adicional y persistir
  const removeAdic = useCallback((id) => {
    setAdicsCommitted(prev => {
      const next = prev.filter(x => x.id !== id);
      saveAdicsToDB(next);
      return next;
    });
  }, [saveAdicsToDB]);

  /* ─── Cambiar sesión activa desde carrusel ─── */
  const switchVenta = useCallback((uuid) => {
    localStorage.setItem('venta_activa_uuid', uuid);
    setUuidActivo(uuid);
    setPeso('');
    setFecha('');
    setPrecios({});
    setAdicsCommitted([]);
    nextAdicId.current = 1;
  }, []);

  /* ─── Guardar precio en DB inmediatamente ─── */
  const handlePrecioChange = useCallback(async (vid, valor) => {
    setPrecios(prev => {
      const next = { ...prev, [vid]: valor };
      if (uuidActivo) {
        db.movimientos.where('uuid').equals(uuidActivo).modify({ precios_por_variedad: next });
      }
      return next;
    });
  }, [uuidActivo]);

  /* ─── Crear nueva venta (slot) ─── */
  const crearNuevaVenta = useCallback(async () => {
    const uuid = genUUID();
    // Auto-asignar Venta Rápida por defecto (sin socio = venta rápida)
    const correlativo = await getOcasionalCorrelativo('venta');
    const nombreTemporal = `Venta Rápida (Cliente ${correlativo})`;
    await db.movimientos.add({
      uuid,
      tipo: 'venta',
      fecha: hoy,
      estado: 'activo',
      timestamp: Date.now(),
      fecha_actualizacion: Date.now(),
      id_socio: SENTINEL_ID,
      socio_nombre_temporal: nombreTemporal,
    });
    setClienteId(SENTINEL_ID);
    switchVenta(uuid);
  }, [hoy, switchVenta]);

  /* ─── Auto-focus ─── */
  const refocus = useCallback(() => {
    const active = document.activeElement;
    // No robar el foco si ya está en un input real del usuario (precio, búsqueda, gastos, etc.)
    if (
      active &&
      active !== hiddenRef.current &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') &&
      !active.readOnly
    ) return;
    hiddenRef.current?.focus();
  }, []);
  useEffect(() => {
    const h = () => setTimeout(refocus, 50);
    document.addEventListener('focusout', h);
    return () => document.removeEventListener('focusout', h);
  }, [refocus]);

  /* ─── Teclado ─── */
  const key = useCallback((k) => {
    if (k === 'C') { setPeso(''); return; }
    if (k === 'BACK') { setPeso(p => p.slice(0, -1)); return; }
    if (k === 'ENTER') {
      const w = parseFloat(peso);
      if (!w || w <= 0 || !variedadActiva || !uuidActivo) return;
      db.sacos.add({
        uuid_movimiento: uuidActivo,
        id_movimiento: uuidActivo,
        id_variedad: variedadActiva.id_variedad,
        peso: w, es_transbordo: 0, timestamp: Date.now(),
      }).then(() => touchMovimiento(uuidActivo));
      setPeso('');
      setFlashOk(true); setTimeout(() => setFlashOk(false), 350);
      return;
    }
    if (k === '.' && peso.includes('.')) return;
    if (peso.replace('.', '').length >= 5) return;
    setPeso(p => p + k);
  }, [peso, variedadActiva, uuidActivo]);

  const handlePhysical = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); key('ENTER'); }
    else if (e.key === 'Backspace') { e.preventDefault(); key('BACK'); }
    else if (/^[0-9.]$/.test(e.key)) { e.preventDefault(); key(e.key); }
  };

  const changeVariedadActiva = async (v) => {
    setVariedadActiva(v);
    if (v && uuidActivo) {
      const mov = await db.movimientos.where('uuid').equals(uuidActivo).first();
      if (mov) {
        const activas = new Set(mov.ids_variedades_activas || []);
        activas.add(v.id_variedad);
        await db.movimientos.where('uuid').equals(uuidActivo).modify({
          ultima_variedad_id: v.id_variedad,
          ids_variedades_activas: Array.from(activas)
        });
      }
    }
  };

  const addVariedad = (v) => {
    if (swapTarget !== null) {
      setVariedadesSeleccionadas(vs => vs.map(x => x.id_variedad === swapTarget ? v : x));
      if (variedadActiva?.id_variedad === swapTarget) changeVariedadActiva(v);
      setSwapTarget(null);
    } else {
      setVariedadesSeleccionadas(vs => {
        if (!vs.find(x => x.id_variedad === v.id_variedad)) return [...vs, v];
        return vs;
      });
      changeVariedadActiva(v);
    }
  };
  const removeVariedad = async (id) => {
    if (conteoPorVariedad[id] && conteoPorVariedad[id] > 0) return; // No permitir borrar si ya tiene sacos

    setVariedadesSeleccionadas(vs => {
      const novs = vs.filter(v => v.id_variedad !== id);
      if (variedadActiva?.id_variedad === id) {
        changeVariedadActiva(novs[0] || null);
      }
      return novs;
    });

    if (uuidActivo) {
      const mov = await db.movimientos.where('uuid').equals(uuidActivo).first();
      if (mov) {
        const activas = (mov.ids_variedades_activas || []).filter(vid => vid !== id);
        await db.movimientos.where('uuid').equals(uuidActivo).modify({ ids_variedades_activas: activas });
      }
    }
  };

  const handleClienteChange = async (val) => {
    setClienteId(val);
    if (uuidActivo && val) {
      const cleanVal = String(val) === SENTINEL_ID ? SENTINEL_ID : parseInt(val);
      await db.movimientos.where('uuid').equals(uuidActivo).modify({ id_socio: cleanVal, fecha_actualizacion: Date.now() });
    }
  };

  const finalizarConLiquidacion = async (preciosFinales, montoNetoFinal, pagoMetodo, pagoMonto) => {
    if (uuidActivo) {
      setPrecios(preciosFinales);

      const adicionalesGuardados = adicsCommitted.map(a => ({
        descripcion: a.desc,
        monto: a.monto,
        tipo: a.op === '+' ? 'suma' : 'resta',
      }));

      const existingMov = await db.movimientos.where('uuid').equals(uuidActivo).first();
      const wasFinalizado = existingMov?.estado === 'finalizado';

      // Conservar la fecha y timestamp original si existen en IndexedDB
      const finalFecha = existingMov?.fecha || fecha;
      const finalTimestamp = existingMov?.timestamp || Date.now();

      const updateData = {
        fecha: finalFecha,
        timestamp: finalTimestamp,
        fecha_actualizacion: Date.now(),
        estado: 'finalizado',
        adicionales: adicionalesGuardados,
        precios_por_variedad: preciosFinales,
        monto_neto_final: montoNetoFinal,
      };

      if (wasFinalizado) {
        updateData.fecha_edicion = new Date().toISOString();
      }

      await db.movimientos.where('uuid').equals(uuidActivo).modify(updateData);

      // Registrar cobro en db.transacciones_pago
      const pMonto = parseFloat(pagoMonto);
      if (pMonto > 0) {
        await db.transacciones_pago.add({
          id_movimiento: uuidActivo,
          id_socio: existingMov?.id_socio || clienteId || SENTINEL_ID,
          monto: pMonto,
          metodo: pagoMetodo,
          fecha: finalFecha,
          timestamp: Date.now()
        });
      }

      localStorage.removeItem('venta_activa_uuid');
    }
    navigate('/');
  };

  /* ─── PDF ─── */
  const generarPDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const MARGEN = 8;
    const COLOR = [5, 150, 105];

    const config = await db.ajustes_negocio.get('unico');

    // Elimina tildes y caracteres no-ASCII
    const ascii = s =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '');

    // Formato condicional
    const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1);

    // Datos del cliente
    const cliente = clientes.find(c => String(c.id_socio) === String(clienteId));
    const nombreSocio = ascii(cliente?.nombre || 'Sin asignar');
    const ahora = new Date();
    const horaStr = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;

    // 1. Banner Corporativo de Cabecera
    if (config?.logo) {
      let format = 'PNG';
      if (config.logo.startsWith('data:image/jpeg') || config.logo.startsWith('data:image/jpg')) {
        format = 'JPEG';
      } else if (config.logo.startsWith('data:image/webp')) {
        format = 'WEBP';
      }
      doc.addImage(config.logo, format, MARGEN, 8, 30, 15);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);

    let headerTextY = 8;
    if (config?.nombre) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(5, 150, 105); // Emerald color for Venta
      doc.text(ascii(config.nombre), W - MARGEN, headerTextY, { align: 'right' });
      headerTextY += 4.5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102); // #666666
    if (config?.direccion) {
      doc.text(ascii(config.direccion), W - MARGEN, headerTextY, { align: 'right' });
      headerTextY += 3.5;
    }
    if (config?.telefonos) {
      doc.text(`Telf: ${ascii(config.telefonos)}`, W - MARGEN, headerTextY, { align: 'right' });
      headerTextY += 3.5;
    }
    if (config?.descripcion) {
      doc.text(ascii(config.descripcion), W - MARGEN, headerTextY, { align: 'right' });
    }

    // Título de Operación
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('LIQUIDACIÓN DE VENTA', MARGEN, 29);

    // 2. Metadatos del Ticket (1 línea destacada sin fondo pesado)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`CLIENTE: ${nombreSocio}`, MARGEN, 37);

    doc.setFontSize(10);
    doc.text(`FECHA Y HORA: ${ahora.toLocaleDateString('es-PE')} - ${horaStr}    |    TOTAL: ${sacos.length} sacos`, W - MARGEN, 37, { align: 'right' });

    // Línea divisoria delgada
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, 40, W - MARGEN, 40);

    let y = 43;

    // 3. Tabla resumen final (SUBIDA AL INICIO)
    const resumenRows = [];

    // Etapa 1: Listado de Variedades de Papa
    let totalSacosVar = 0;
    let totalPesoNetoVar = 0;
    let totalDineroVar = 0;

    variedadesIds.forEach(vid => {
      const v = varMap[vid];
      const sx = sacos.filter(s => s.id_variedad === vid);
      const bruto = sx.reduce((a, s) => a + s.peso, 0);
      const info = activeMov?.variedades?.[vid] || {};
      const tipo = info.tipo_ajuste || 'NINGUNO';
      const kilos = info.kilos_ajuste || 0;
      const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
      const pr = parseFloat(precios[vid] || 0);
      const unit = info.unidad_precio || 'KG';
      const sub = unit === 'ARROBA' ? (neto / 11.5) * pr : neto * pr;

      totalSacosVar += sx.length;
      totalPesoNetoVar += neto;
      totalDineroVar += sub;

      const nameDesc = ascii(v?.nombre || String(vid));
      const prUnit = unit === 'ARROBA' ? 'S/ ' + pr.toFixed(2) + ' / @' : 'S/ ' + pr.toFixed(2) + ' / kg';
      const subText = pr > 0 ? 'S/ ' + sub.toFixed(2) : '-';

      resumenRows.push([
        nameDesc,
        sx.length,
        fmt(neto) + ' kg',
        prUnit,
        subText
      ]);
    });

    // Etapa 2: Subtotal de Productos ("TOTAL VARIEDADES")
    if (variedadesIds.length > 1) {
      resumenRows.push([
        'TOTAL VARIEDADES',
        totalSacosVar,
        fmt(totalPesoNetoVar) + ' kg',
        '—',
        'S/ ' + totalDineroVar.toFixed(2)
      ]);
    }

    // Etapa 3: Listado de Descuentos o Conceptos Adicionales
    extras.forEach(e => {
      resumenRows.push([
        ascii(e.descripcion),
        '—',
        '—',
        '—',
        '- S/ ' + Number(e.monto).toFixed(2)
      ]);
    });

    adicsCommitted.forEach(a => {
      const opSign = a.op === '+' ? '+' : '-';
      resumenRows.push([
        ascii(a.desc),
        '—',
        '—',
        '—',
        `${opSign} S/ ${parseFloat(a.monto).toFixed(2)}`
      ]);
    });

    // Etapa 4: Fila de Cierre Financiero ("MONTO FINAL")
    resumenRows.push([
      { content: 'MONTO FINAL', styles: { fontSize: 10, fontStyle: 'bold', halign: 'left' } },
      { content: String(sacos.length), styles: { fontSize: 10, fontStyle: 'bold', halign: 'center' } },
      { content: fmt(totalPesoNeto) + ' kg', styles: { fontSize: 10, fontStyle: 'bold', halign: 'left' } },
      { content: '', styles: { fontSize: 10, fontStyle: 'bold', halign: 'left' } },
      { content: 'S/ ' + totalNeto.toFixed(2), styles: { fontSize: 10, fontStyle: 'bold', halign: 'right' } }
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Variedad', 'Sacos', 'Peso total', 'S//kg', 'Subtotal']],
      body: resumenRows,
      styles: { fontSize: 9, fontStyle: 'bold', cellPadding: 1.3, font: 'helvetica', textColor: [0, 0, 0] },
      headStyles: { fillColor: COLOR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: 'left' },
        1: { halign: 'center' },
        2: { halign: 'left' },
        3: { halign: 'left' },
        4: { halign: 'right' }
      },
      alternateRowStyles: { fillColor: [230, 250, 242] },
      margin: { left: MARGEN, right: MARGEN },
    });

    y = doc.lastAutoTable.finalY + 5;

    // 4. Cuadrículas de Pesos (REGLA RÍGIDA DE 5 FILAS Y 12 COLUMNAS)
    const LOTES_POR_FILA = 12;
    const colW = (W - MARGEN * 2) / LOTES_POR_FILA;

    variedadesIds.forEach(vid => {
      const v = varMap[vid];
      const sx = sacos.filter(s => s.id_variedad === vid);
      if (!sx.length) return;

      const pesoTotal = sx.reduce((a, s) => a + s.peso, 0);
      const pr = parseFloat(precios[vid] || 0);
      const nombre = ascii(v?.nombre || String(vid));
      const codigo = ascii(v?.codigo_corto || '?');

      const info = activeMov?.variedades?.[vid] || {};
      const tipoAjuste = info.tipo_ajuste || 'NINGUNO';
      const kilosAjuste = info.kilos_ajuste || 0;
      const pesoBruto = pesoTotal;
      const pesoNeto = tipoAjuste === 'RESTAR' ? Math.max(0, pesoBruto - kilosAjuste) : (tipoAjuste === 'SUMAR' ? pesoBruto + kilosAjuste : pesoBruto);
      const numBlocks = Math.ceil(sx.length / 60);
      const bodyRows = [];

      // Cabecera de Variedad Simplificada (única por variedad)
      bodyRows.push([{
        content: `${codigo} - ${nombre}  |  ${sx.length} sacos  |  ${fmt(pesoNeto)} kg`,
        colSpan: LOTES_POR_FILA,
        styles: {
          fillColor: [5, 110, 75],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
          font: 'helvetica',
          halign: 'left',
          cellPadding: { top: 1.5, right: 2, bottom: 1.5, left: 2 },
        }
      }]);

      for (let b = 0; b < numBlocks; b++) {
        const blockSacos = sx.slice(b * 60, (b + 1) * 60);
        const numLotesInBlock = Math.ceil(blockSacos.length / 5);
        const numRowsInBlock = Math.min(5, blockSacos.length);

        for (let r = 0; r < numRowsInBlock; r++) {
          const fila = Array.from({ length: LOTES_POR_FILA }, (_, c) => {
            if (c >= numLotesInBlock) return '';
            const idx = c * 5 + r;
            const s = blockSacos[idx];
            return s ? fmt(s.peso) : '';
          });
          bodyRows.push(fila);
        }

        const subFila = Array.from({ length: LOTES_POR_FILA }, (_, c) => {
          if (c >= numLotesInBlock) return '';
          const colSacos = blockSacos.slice(c * 5, c * 5 + 5);
          const sum = colSacos.reduce((a, s) => a + s.peso, 0);
          return colSacos.length > 0 ? fmt(sum) : '';
        });

        const subFilaMapped = subFila.map(val => {
          if (val === '') return '';
          return {
            content: val,
            styles: {
              fillColor: [185, 235, 210],
              fontStyle: 'bold',
              textColor: [0, 80, 40],
              fontSize: 8,
              cellPadding: 1
            }
          };
        });
        bodyRows.push(subFilaMapped);
      }

      autoTable(doc, {
        startY: y,
        head: [Array.from({ length: LOTES_POR_FILA }, () => '')],
        showHead: 'never',
        body: bodyRows,
        styles: {
          fontSize: 8,
          fontStyle: 'bold',
          cellPadding: 1.2,
          halign: 'center',
          font: 'courier',
          textColor: [0, 0, 0],
          lineColor: [200, 200, 200],
          lineWidth: 0.15,
        },
        columnStyles: Object.fromEntries(
          Array.from({ length: LOTES_POR_FILA }, (_, i) => [i, { cellWidth: colW }])
        ),
        margin: { left: MARGEN, right: MARGEN },
      });

      y = doc.lastAutoTable.finalY + 4;
    });

    doc.save(`Venta_${hoy}_${nombreSocio.replace(/\s+/g, '_')}.pdf`);
  };

  /* ─── Guard: sin UUID activo ─── */
  if (!uuidActivo) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center" style={{ background: '#080E1A', fontFamily: FONT }}>
        <p className="text-slate-400 text-sm mb-4">No hay ninguna venta activa.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm active:scale-95">Ir al Inicio</button>
      </div>
    );
  }

  /* ════════════════ RENDER ════════════════ */
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: '#080E1A', fontFamily: FONT }}>

      {/* ── Modals ── */}
      {showGastos && <GastosModal uuid={uuidActivo} onClose={() => setShowGastos(false)} />}
      {editSaco && <EditSacoModal saco={editSaco} onClose={() => setEditSaco(null)} />}
      {showFinalizar && (
        <PreLiquidadorModal
          sacos={sacos}
          activeMov={activeMov}
          varIds={variedadesIds}
          varMap={varMap}
          preciosIniciales={precios}
          extras={extras}
          adicsCommitted={adicsCommitted}
          totalPesoNeto={totalPesoNeto}
          onCancel={() => setShowFin(false)}
          onConfirm={finalizarConLiquidacion}
          tipoMov="venta"
        />
      )}
      {showVariedadModal && (
        <VariedadModal variedades={variedades} uuidActivo={uuidActivo}
          excluir={swapTarget != null ? variedadesSeleccionadas.filter(v => v.id_variedad !== swapTarget).map(v => v.id_variedad) : variedadesSeleccionadas.map(v => v.id_variedad)}
          onSelect={addVariedad} onClose={() => { setShowVM(false); setSwapTarget(null); }} />
      )}
      {showAjusteModal && (
        <AjustePesoModal
          vid={showAjusteModal.vid}
          pesoBruto={showAjusteModal.pesoBruto}
          tipoAjusteInicial={showAjusteModal.tipoAjuste}
          kilosAjusteInicial={showAjusteModal.kilosAjuste}
          onClose={() => setShowAjusteModal(null)}
          onApply={handleApplyAjuste}
          colorTema="emerald"
        />
      )}
      {showBuscadorCliente && (
        <BuscadorSocioModal
          socios={clientes}
          tipoRapida="venta"
          fechaSeleccionada={fecha}
          onClose={() => setShowBC(false)}
          onSelect={c => {
            handleClienteChange(c.id_socio);
            setShowBC(false);
          }}
          onNuevaFrecuente={async (data) => {
            // Crea un socio frecuente real en la tabla socios
            const id = await db.socios.add({ nombre: data.nombre.trim(), documento: data.documento.trim(), telefono: data.telefono.trim(), es_proveedor: 0, es_cliente: 1, es_ocasional: 0, saldo_actual: 0 });
            handleClienteChange(id);
            setShowBC(false);
          }}
          onNuevaOcasional={async (nombre) => {
            // Patrón Centinela: NUNCA inserta en socios.
            const n = nombre.trim();
            const correlativo = await getOcasionalCorrelativo('venta', fecha);
            // Regla de oro: nombre completo formateado desde aquí
            const nombreTemporal = n
              ? `Venta Rápida (${n})`
              : `Venta Rápida (Cliente ${correlativo})`;
            if (uuidActivo) {
              await db.movimientos.where('uuid').equals(uuidActivo).modify({
                id_socio: SENTINEL_ID,
                socio_nombre_temporal: nombreTemporal,
                fecha_actualizacion: Date.now(),
              });
              setClienteId(SENTINEL_ID);
            }
            setShowBC(false);
          }}
        />
      )}
      {/* Action sheet: Editar o Eliminar saco */}
      {sacoAccion && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSacoAccion(null)} />
          <div className="relative w-full max-w-sm rounded-t-3xl pb-8" style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex justify-center pt-2 mb-2"><div className="w-8 h-1 rounded-full bg-slate-600" /></div>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center mb-1">Saco seleccionado</p>
            <p className="text-white text-2xl font-black font-mono text-center mb-4" style={{ color: sacoAccion.color }}>
              {sacoAccion.saco.peso.toFixed(1)} kg
            </p>
            <div className="flex flex-col gap-2 px-4">
              <button onClick={() => { setEditSaco(sacoAccion.saco); setSacoAccion(null); }}
                className="w-full py-3 rounded-2xl text-white text-sm font-bold active:scale-95 transition-all"
                style={{ background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.4)' }}>
                ✏️  Editar peso
              </button>
              <button onClick={() => { setConfirmDel(sacoAccion.saco); setSacoAccion(null); }}
                className="w-full py-3 rounded-2xl text-red-300 text-sm font-bold active:scale-95 transition-all"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                🗑️  Eliminar este registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {confirmDel && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDel(null)} />
          <div className="relative w-full max-w-xs rounded-2xl p-5 text-center" style={{ background: '#1A2438', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Trash2 size={28} className="text-red-400 mx-auto mb-2" />
            <p className="text-white font-black text-base mb-1">¿Eliminar este saco?</p>
            <p className="text-red-300 font-black text-xl font-mono mb-4">{confirmDel.peso?.toFixed(1)} kg</p>
            <p className="text-slate-500 text-xs mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2.5 rounded-xl text-slate-400 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
              <button onClick={async () => { await db.sacos.delete(confirmDel.id_saco); touchMovimiento(uuidActivo); setConfirmDel(null); }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-black active:scale-95">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden input para teclado físico */}
      <input ref={hiddenRef} type="text" inputMode="none" className="absolute w-0 h-0 opacity-0 pointer-events-none" onKeyDown={handlePhysical} readOnly />

      {/* ══════════════════════════════════════
          STICKY HEADER
      ══════════════════════════════════════ */}
      <div className="flex-shrink-0 z-40"
        style={{ background: 'rgba(8,14,26,0.96)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

        {/* Fila 0: Carrusel — botón + FIJO + slots enriquecidos */}
        <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Botón Nueva Venta — siempre visible a la izquierda */}
          <button onClick={crearNuevaVenta}
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center active:scale-90 transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 2px 8px rgba(5,150,105,0.45)' }}>
            <Plus size={16} className="text-white" />
          </button>

          {/* Slots de sesiones */}
          {ventasCarrusel.map((v, idx) => {
            const isA = v.uuid === uuidActivo;
            // Nombre compacto para el carrusel (evita truncación en móvil)
            const nombre = (!v.id_socio || v.id_socio === SENTINEL_ID)
              ? (v.socio_nombre_temporal || 'VR')
                  .replace('Venta Rápida', 'VR')
                  .replace('Compra Rápida', 'CR')
              : (clientes.find(c => c.id_socio === v.id_socio)?.nombre || `Venta ${ventasCarrusel.length - idx}`);
            const inicial = nombre[0].toUpperCase();

            // Hora de creación del movimiento
            const tsCreacion = v.timestamp || 0;
            const horaStr = tsCreacion
              ? (() => { const d = new Date(tsCreacion); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; })()
              : '--:--';

            // Datos de sacos y variedades desde sacosResumen
            const resumen = sacosResumen[v.uuid] || { total: 0, conteoPorVar: {} };
            const sacosCount = isA ? sacos.length : resumen.total;
            // Para la sesión activa usamos los sacosResumen (pero los ids visualizados vienen de variables de entorno activo)
            const varsIds = isA
              ? variedadesSeleccionadas.map(v => v.id_variedad)
              : Object.keys(resumen.conteoPorVar).map(Number).filter(id => resumen.conteoPorVar[id] > 0);
            const conteos = isA ? conteoPorVariedad : resumen.conteoPorVar;

            return (
              <button key={v.uuid} onClick={() => switchVenta(v.uuid)}
                className="flex-shrink-0 flex flex-col gap-0.5 px-2.5 py-1.5 rounded-xl transition-all active:scale-95"
                style={{
                  background: isA ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isA ? '1.5px solid rgba(5,150,105,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  minWidth: 86,
                }}>
                {/* Línea 1: Avatar + Nombre + Hora */}
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 flex-shrink-0 rounded-full flex items-center justify-center font-black"
                    style={{ fontSize: '0.5rem', background: isA ? 'rgba(5,150,105,0.4)' : 'rgba(255,255,255,0.1)', color: isA ? '#34d399' : '#94a3b8' }}>
                    {inicial}
                  </div>
                  <span className="font-bold leading-none truncate" style={{ fontSize: '0.65rem', color: isA ? '#34d399' : '#64748b', maxWidth: 72 }}>
                    {nombre}
                  </span>
                  <span className="flex-shrink-0 font-mono leading-none" style={{ fontSize: '0.55rem', color: isA ? '#6ee7b7' : '#334155' }}>
                    {horaStr}
                  </span>
                </div>
                {/* Línea 2: Sacos + Mini-tags variedades */}
                <div className="flex items-center gap-0.5">
                  <span className="flex-shrink-0 font-black leading-none px-1 py-0.5 rounded"
                    style={{ fontSize: '0.55rem', background: isA ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)', color: isA ? '#6ee7b7' : '#475569', whiteSpace: 'nowrap' }}>
                    {sacosCount}s
                  </span>
                  {varsIds.slice(0, 3).map(vid => {
                    const vr = varMap[vid];
                    const cnt = conteos[vid] || 0;
                    const bg = vr?.color || '#6366f1';
                    return (
                      <span key={vid} className="flex-shrink-0 font-black rounded"
                        style={{ fontSize: '0.5rem', padding: '1px 3px', backgroundColor: bg, color: fg(bg), lineHeight: 1.5 }}>
                        {vr?.codigo_corto || '?'}:{cnt}
                      </span>
                    );
                  })}
                  {varsIds.length > 3 && (
                    <span style={{ fontSize: '0.5rem', color: '#475569' }}>+{varsIds.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fila 1: Back + Título + Fecha */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white"><ChevronLeft size={18} /></button>
          <span className="text-white font-bold text-base flex-1">Venta</span>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="text-[11px] text-slate-300 bg-white/5 border border-white/10 rounded-lg px-2 py-1 outline-none" />
        </div>

        {/* Fila 2: Cliente */}
        <div className="flex gap-1.5 px-3 pb-1.5">
          <button onClick={() => setShowBC(true)} className="flex-1 flex items-center justify-between bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-xs font-medium active:scale-[0.98] transition-all">
            <span className={(clienteId || activeMov?.id_socio) ? "text-white" : "text-slate-400"}>
              {(() => {
                const currentSocioId = clienteId || activeMov?.id_socio;
                if (currentSocioId) {
                  return String(currentSocioId) === SENTINEL_ID
                    ? (activeMov?.socio_nombre_temporal || 'Venta Rápida')
                    : (clientes.find(c => String(c.id_socio) === String(currentSocioId))?.nombre || 'Cliente Seleccionado');
                }
                const idx = ventasCarrusel.findIndex(v => v.uuid === uuidActivo);
                const pos = ventasCarrusel.length - (idx >= 0 ? idx : 0);
                return activeMov?.socio_nombre_temporal || (pos > 0 ? `Cliente ${pos}` : 'Cargando...');
              })()}
            </span>
            <Search size={14} className="text-slate-500" />
          </button>
          <button onClick={() => setShowBC(true)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 active:scale-95 transition-all">
            <Plus size={16} />
          </button>
        </div>

        {/* Fila 3: Variedades */}
        <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {variedadesSeleccionadas.length > 0 && (
            <button onClick={() => setModoConfig(v => !v)} className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: modoConfig ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', border: modoConfig ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)', color: modoConfig ? '#818CF8' : '#64748B' }}>
              <Settings2 size={14} />
            </button>
          )}
          {variedadesSeleccionadas.map(v => {
            const isA = variedadActiva?.id_variedad === v.id_variedad;
            const cnt = conteoPorVariedad[v.id_variedad] || 0;
            return (
              <div key={v.id_variedad} className="flex-shrink-0 flex items-center rounded-lg overflow-hidden"
                style={{ border: isA ? `2px solid ${v.color}` : '2px solid transparent' }}>
                <button onClick={() => { if (modoConfig) { setSwapTarget(v.id_variedad); setShowVM(true); } else changeVariedadActiva(v); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-black rounded-lg"
                  style={{ backgroundColor: isA ? v.color : `${v.color}44`, color: isA ? fg(v.color) : '#e2e8f0' }}>
                  <span>{v.codigo_corto}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded font-black" style={{ background: 'rgba(0,0,0,0.25)', color: isA ? fg(v.color) : '#e2e8f0' }}>{cnt}</span>
                </button>
                {modoConfig && (
                  <button onClick={() => removeVariedad(v.id_variedad)} className="px-1 py-1.5" style={{ backgroundColor: `${v.color}22` }}>
                    <X size={11} className="text-red-400" />
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => { setSwapTarget(null); setShowVM(true); }}
            className="flex-shrink-0 w-8 h-8 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-slate-500">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════
          SCROLLABLE BODY
      ══════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto pb-32 min-h-0">

        {/* ── Display ── */}
        <div className={`mx-3 mt-2 rounded-2xl overflow-hidden transition-all ${flashOk ? 'ring-2 ring-emerald-400' : ''}`}
          style={{ background: 'linear-gradient(135deg,#0D1B2A,#111827)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex p-3">
            {/* Lote actual */}
            <div className="w-[30%] flex flex-col justify-end pr-3 border-r border-white/5">
              {variedadActiva ? (
                <>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1 truncate" style={{ color: `${accent}80` }}>
                    Lote {loteNum} · {variedadActiva.codigo_corto}
                  </p>
                  <div className="space-y-0.5 mb-1.5">
                    {loteActual.map((s, i) => (
                      <div key={s.id_saco || i} className="text-right font-mono font-bold text-xs leading-none" style={{ color: accent }}>{s.peso.toFixed(1)}</div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - loteActual.length) }).map((_, i) => (
                      <div key={`e${i}`} className="text-right font-mono text-xs leading-none text-slate-800">·</div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 pt-1.5 text-right font-mono font-black text-sm" style={{ color: accent }}>
                    {loteSuma > 0 ? loteSuma.toFixed(1) : '—'}
                  </div>
                </>
              ) : (
                <div className="text-slate-700 text-[9px] font-bold uppercase tracking-widest text-center">Sin variedad</div>
              )}
            </div>
            {/* Peso */}
            <div className="flex-1 flex items-end justify-end pl-3 pb-1 relative overflow-hidden">
              {variedadActiva && <div className="absolute right-3 bottom-3 w-20 h-12 rounded-full blur-2xl opacity-20" style={{ backgroundColor: accent }} />}
              <div className="flex items-end gap-1 z-10">
                <span className="font-mono font-black tabular-nums leading-none"
                  style={{ fontSize: peso.length > 4 ? '2.8rem' : '3.8rem', color: variedadActiva ? accent : '#374151', textShadow: variedadActiva ? `0 0 30px ${accent}60` : 'none', transition: 'font-size 0.1s' }}>
                  {peso || (variedadActiva ? '0' : '—')}
                </span>
                <span className="text-slate-600 text-sm font-bold mb-1.5">kg</span>
              </div>
            </div>
          </div>
          <div className="flex items-center px-4 pb-2">
            <span className="text-slate-600 text-[10px] flex-1">
              {sacos.length > 0 ? <><span style={{ color: accent }} className="font-bold">{sacos.length}</span> sacos · {totalPesoNeto.toFixed(1)} kg neto</> : 'Sin registros aún'}
            </span>
          </div>
        </div>

        {/* Accent line */}
        <div className="mx-3 mt-1.5 h-[2px] rounded-full opacity-40" style={{ background: `linear-gradient(90deg,transparent,${accent},transparent)` }} />

        {/* ── Numpad ── */}
        <div className="p-2.5">
          <div className="grid grid-cols-4 gap-2 h-60" style={{ gridTemplateRows: 'repeat(4,1fr)' }}>
            {['7', '8', '9'].map(n => <Btn key={n} label={n} onClick={() => key(n)} />)}
            <Btn icon={<Delete size={20} className="text-amber-200" />} onClick={() => key('BACK')} style={{ background: 'linear-gradient(145deg,#78350f,#92400e)', boxShadow: '0 3px 0 #451a03' }} />
            {['4', '5', '6'].map(n => <Btn key={n} label={n} onClick={() => key(n)} />)}
            <Btn icon={<RotateCcw size={18} className="text-red-200" />} onClick={() => key('C')} style={{ background: 'linear-gradient(145deg,#7f1d1d,#991b1b)', boxShadow: '0 3px 0 #450a0a' }} />
            {['1', '2', '3'].map(n => <Btn key={n} label={n} onClick={() => key(n)} />)}
            <button onClick={() => key('ENTER')} className="row-span-2 rounded-xl flex flex-col items-center justify-center gap-1 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(145deg,#065F46,#047857)', boxShadow: '0 3px 0 #022c22' }}>
              <Check size={26} strokeWidth={3} className="text-emerald-100" />
              <span className="text-[9px] font-black tracking-widest text-emerald-200 uppercase">Enter</span>
            </button>
            <button onClick={() => key('0')} className="col-span-2 rounded-xl text-white text-2xl font-bold active:scale-95 transition-all"
              style={{ background: 'linear-gradient(145deg,#1E293B,#162032)', boxShadow: '0 3px 0 #0a1120' }}>0</button>
            <Btn label="." onClick={() => key('.')} />
          </div>
        </div>

        {/* ── Divisor ── */}
        <div className="flex items-center gap-3 px-4 mb-3">
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.08))' }} />
          <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest">Registros en Vivo</span>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(270deg,transparent,rgba(255,255,255,0.08))' }} />
        </div>

        {/* ── Tabla de totales LIVE ── */}
        <div className="mx-3 rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid text-[10px] font-black uppercase tracking-wider text-slate-500 px-3 py-2 items-center"
            style={{ gridTemplateColumns: '2fr 1fr 2fr 2.2fr 1.8fr', background: 'rgba(255,255,255,0.03)' }}>
            <span>Variedad</span>
            <span className="text-center">Sacos</span>
            <span className="text-right">Peso</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Subtotal</span>
          </div>
          {variedadesIds.map(vid => {
            const v = varMap[vid]; const sx = sacos.filter(s => s.id_variedad === vid);
            const bruto = sx.reduce((a, s) => a + s.peso, 0);
            const info = activeMov?.variedades?.[vid] || {};
            const tipo = info.tipo_ajuste || 'NINGUNO';
            const kilos = info.kilos_ajuste || 0;
            const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
            const pr = parseFloat(precios[vid] || 0);
            const unit = info.unidad_precio || 'KG';
            const subtotal = unit === 'ARROBA' ? (neto / 11.5) * pr : neto * pr;
            const placeholder = unit === 'ARROBA' ? 'S//@' : '0.00';

            const displayPeso = unit === 'ARROBA' ? neto / 11.5 : neto;
            const unitLabel = unit === 'ARROBA' ? '@' : 'kg';

            return (
              <div key={vid} className="grid items-center px-3 py-2.5 border-b border-white/5"
                style={{ gridTemplateColumns: '2fr 1fr 2fr 2.2fr 1.8fr' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: v?.color || '#6366f1' }} />
                  <span className="text-white text-xs font-semibold truncate">{v?.codigo_corto || vid}</span>
                </div>
                <span className="text-center text-white text-xs font-bold">{sx.length}</span>
                <button
                  onClick={() => setShowAjusteModal({ vid, pesoBruto: bruto, tipoAjuste: tipo, kilosAjuste: kilos })}
                  className="text-right text-slate-300 hover:text-white text-xs font-mono flex items-center justify-end gap-1 w-full ml-auto group"
                >
                  <span className={tipo !== 'NINGUNO' ? "text-amber-400 font-bold" : ""}>
                    {displayPeso.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">{unitLabel}</span>
                  </span>
                  <span className="text-[10px] opacity-40 group-hover:opacity-100 transition-opacity">✏️</span>
                </button>
                <div className="flex items-center justify-end gap-1">
                  <input type="number" placeholder={placeholder} value={precios[vid] || ''} onChange={e => handlePrecioChange(vid, e.target.value)}
                    className="w-14 bg-white/5 border border-white/10 focus:border-emerald-500/40 text-white text-xs text-right rounded-lg px-1.5 py-1 outline-none font-mono" />
                  <button onClick={() => toggleRowUnit(vid)} className={`px-1 py-0.5 rounded text-[9px] font-black w-6 text-center transition-all ${unit === 'ARROBA' ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30' : 'bg-white/5 text-slate-500 border border-white/10'}`}>
                    {unit === 'ARROBA' ? '@' : 'kg'}
                  </button>
                </div>
                <span className="text-right text-emerald-400 text-xs font-bold font-mono">
                  {subtotal > 0 ? `S/ ${subtotal.toFixed(2)}` : '—'}
                </span>
              </div>
            );
          })}
          {/* Fila Total General */}
          {variedadesIds.length > 0 && (
            <div className="grid items-center px-3 py-2.5" style={{ gridTemplateColumns: '2fr 1fr 2fr 2.2fr 1.8fr', background: 'rgba(16,185,129,0.08)', borderTop: '1px solid rgba(16,185,129,0.15)' }}>
              <span className="text-emerald-300 text-[10px] font-black uppercase">Total General</span>
              <span className="text-center text-white text-xs font-bold">{sacos.length}</span>
              <span className="text-right text-slate-300 text-xs font-mono font-bold">{totalPesoNeto.toFixed(1)} kg</span>
              <span></span>
              <span className="text-right text-emerald-300 text-sm font-black font-mono">S/ {totalDinero.toFixed(2)}</span>
            </div>
          )}
          {/* Divisor Conceptos Adicionales */}
          <div className="flex items-center gap-2 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-slate-600 text-[9px] font-black uppercase tracking-widest">Conceptos Adicionales</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          {adicsCommitted.map(a => (
            <div key={a.id} className="flex items-center px-3 py-2 border-b border-white/5 gap-2">
              <span className="flex-1 text-slate-300 text-xs truncate">{a.desc}</span>
              <button onClick={() => removeAdic(a.id)} className="text-slate-600 hover:text-red-400 transition-colors text-xs px-1">×</button>
              <span className="text-xs font-mono font-bold flex-shrink-0 w-20 text-right" style={{ color: a.op === '+' ? '#34d399' : '#f87171' }}>
                {a.op === '+' ? '+' : '−'}S/ {parseFloat(a.monto).toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-2 py-2 border-b border-white/5">
            <input type="text" placeholder="Flete, Estiba, Sacos..." value={adicDesc} onChange={e => setAdicDesc(e.target.value)} className="flex-1 bg-white/5 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none font-medium min-w-0" />
            <input type="number" placeholder="0.00" value={adicMonto} onChange={e => setAdicMonto(e.target.value)} className="w-16 bg-white/5 border border-white/10 text-white text-xs text-right rounded-lg px-2 py-1.5 outline-none font-mono flex-shrink-0" />
            <button onClick={() => commitAdic('-')} className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 transition-all active:scale-90" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>−</button>
            <button onClick={() => commitAdic('+')} className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 transition-all active:scale-90" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' }}>+</button>
          </div>
          <div className="flex items-center justify-between px-3 py-3" style={{ background: 'rgba(5,150,105,0.1)', borderTop: '1px solid rgba(5,150,105,0.15)' }}>
            <span className="text-emerald-300 text-xs font-black uppercase tracking-wide">Monto Final</span>
            <span className="text-emerald-300 text-sm font-black font-mono">S/ {totalNeto.toFixed(2)}</span>
          </div>
        </div>

        {/* ── Grid de sacos ── */}
        {variedadesIds.map(vid => {
          const v = varMap[vid]; const sx = sacos.filter(s => s.id_variedad === vid);
          const nC = Math.ceil(sx.length / 5);
          return (
            <div key={vid} className="mx-3 mb-3 rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: `${v?.color || '#6366f1'}20`, borderBottom: `1px solid ${v?.color || '#6366f1'}30` }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v?.color }} />
                <span className="text-white font-bold text-xs">{v?.nombre || vid}</span>
                <span className="text-slate-500 text-[10px]">({sx.length} sacos)</span>
              </div>
              <div className="p-2 overflow-x-auto">
                <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                  {Array.from({ length: nC }).map((_, ci) => {
                    const lote = sx.slice(ci * 5, (ci + 1) * 5);
                    return (
                      <div key={ci} className="rounded-xl overflow-hidden flex flex-col" style={{ minWidth: 68, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {lote.map((saco) => (
                          <button key={saco.id_saco}
                            onClick={() => setSacoAccion({ saco, color: v?.color || '#10b981' })}
                            className="text-center font-mono font-bold text-xs py-1.5 border-b border-white/5 active:bg-white/10 transition-all"
                            style={{ color: saco.es_transbordo ? '#F59E0B' : (v?.color || '#10b981') }}>
                            {saco.peso.toFixed(1)}
                          </button>
                        ))}
                        {Array.from({ length: 5 - lote.length }).map((_, i) => (
                          <div key={i} className="text-center text-slate-800 text-[10px] py-1.5 border-b border-white/3">·</div>
                        ))}
                        <div className="text-center font-black text-xs py-1.5 font-mono" style={{ color: v?.color, background: `${v?.color}18` }}>
                          {lote.reduce((a, s) => a + s.peso, 0).toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <div className="h-2" />
      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-950/80 backdrop-blur border-t border-white/5 px-4 py-3 flex gap-2 z-50">
        {/* Botón Izquierdo: PDF */}
        <button onClick={generarPDF} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-cyan-400 text-xs font-bold active:scale-95 transition-all cursor-pointer" style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}>
          <Printer size={14} /><span>🖨️ PDF</span>
        </button>

        {/* Botón Derecho: Finalizar */}
        {(() => {
          const isMontoZero = !totalNeto || totalNeto <= 0;
          return (
            <button onClick={() => setShowFin(true)}
              disabled={isMontoZero}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-black transition-all ${
                isMontoZero ? 'opacity-40 cursor-not-allowed text-slate-500' : 'active:scale-95 cursor-pointer text-white'
              }`}
              style={isMontoZero ? {
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
              } : {
                background: 'linear-gradient(135deg,#059669,#047857)',
                boxShadow: '0 3px 12px rgba(5,150,105,0.4)',
              }}>
              {isMontoZero ? 'Esperando datos...' : `✓ Finalizar • S/ ${totalNeto.toFixed(2)}`}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
