import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SENTINEL_ID } from '../db/database';
import {
  Search, X, PackagePlus, PackageMinus, Layers, Calendar,
  ChevronDown, DollarSign, CreditCard, Banknote, Edit2, ArrowLeftRight, Landmark, FileText
} from 'lucide-react';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';
const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1);

/* ─── Resolver nombre socio (soporta centinela) ─── */
function resolveNombreSocio(mov, socioMap) {
  // Operación rápida: el nombre completo ya está formateado en socio_nombre_temporal
  if (mov.id_socio === SENTINEL_ID) {
    return mov.socio_nombre_temporal || (mov.tipo === 'venta' ? 'Venta Rápida' : 'Compra Rápida');
  }
  // Socio frecuente: buscar en mapa
  return socioMap[mov.id_socio]?.nombre || 'Socio desvinculado';
}

function getLum(hex) {
  const c = (hex || '#000').replace('#', '');
  if (c.length < 6) return 0;
  const L = x => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * L(c.slice(0, 2)) + 0.7152 * L(c.slice(2, 4)) + 0.0722 * L(c.slice(4, 6));
}
const txColor = hex => getLum(hex) > 0.35 ? '#0f172a' : '#fff';

/* ── PagoModal ── */
function PagoModal({ mov, pagos, onClose, onPago, onEditar }) {
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const total = mov._totalDinero || 0;
  const pagado = pagos.reduce((a, p) => a + (p.monto || 0), 0);
  const pend = Math.max(0, total - pagado);

  const isCompra = mov.tipo === 'compra';
  const sectionTitle = isCompra ? 'REGISTRAR PAGO' : 'REGISTRAR COBRO';
  const actionLabel = isCompra ? 'Pagar' : 'Cobrar';

  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);

  const guardar = () => {
    const v = parseFloat(monto);
    if (!v || v <= 0) return;
    onPago({ id_movimiento: mov.uuid, id_socio: mov.id_socio, monto: v, metodo, fecha: new Date().toISOString().split('T')[0], timestamp: Date.now() });
    setMonto('');
  };

  const handleTodo = () => {
    if (pend > 0) {
      setMonto(pend.toFixed(2));
    } else {
      setMonto('0.00');
    }
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    touchCurrentY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const deltaY = touchCurrentY.current - touchStartY.current;
    if (deltaY > 80) {
      onClose();
    }
    touchStartY.current = 0;
    touchCurrentY.current = 0;
  };

  const getMetodoIconAndLabel = (m) => {
    if (m === 'yape') return '📱 Yape';
    if (m === 'deposito') return '🏦 Depósito';
    return '💵 Efectivo';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--overlay-backdrop)' }} onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl flex flex-col pb-10 shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-card)', borderBottom: 'none' }}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          type="button"
        >
          <X size={18} />
        </button>
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing w-full"
        >
          <div className="w-8 h-1 rounded-full" style={{ background: 'var(--text-tertiary)' }} />
        </div>
        <div className="px-4 pt-3 pb-4">
          <p className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Actualizar Operación</p>
          <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--white-alpha-3)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between text-xs mb-1"><span style={{ color: 'var(--text-secondary)' }}>Total</span><span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>S/ {total.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs mb-1"><span style={{ color: 'var(--text-secondary)' }}>Pagado</span><span className="text-emerald-500 dark:text-emerald-400 font-mono font-bold">S/ {pagado.toFixed(2)}</span></div>
            <div className="flex justify-between text-xs"><span style={{ color: 'var(--text-secondary)' }}>Pendiente</span><span className={`font-mono font-bold ${pend > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>S/ {pend.toFixed(2)}</span></div>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>{sectionTitle}</p>
          <div className="flex gap-2 mb-3">
            {[
              { k: 'efectivo', l: '💵 Efectivo', I: Banknote },
              { k: 'yape', l: '📱 Yape', I: CreditCard },
              { k: 'deposito', l: '🏦 Depósito', I: Landmark }
            ].map(({ k, l, I: Icon }) => {
              const isSelected = metodo === k;
              return (
                <button key={k} onClick={() => setMetodo(k)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none font-sans"
                  style={{
                    background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--white-alpha-3)',
                    borderColor: isSelected ? 'rgba(99,102,241,0.4)' : 'var(--border-subtle)',
                    color: isSelected ? '#818cf8' : 'var(--text-secondary)'
                  }}>
                  {Icon({ size: 13 })} {l}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleTodo}
              disabled={pend <= 0}
              className="px-4 py-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-black transition-all hover:bg-indigo-600/30 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              TODO
            </button>
            <input
              type="number"
              placeholder={`Max S/ ${pend.toFixed(2)}`}
              value={monto}
              max={pend}
              onChange={e => {
                const val = e.target.value;
                const parsed = parseFloat(val);
                if (!isNaN(parsed) && parsed > pend) {
                  setMonto(pend.toFixed(2));
                } else {
                  setMonto(val);
                }
              }}
              disabled={pend <= 0}
              className="flex-1 border rounded-xl px-3 py-2.5 text-sm outline-none font-mono focus:border-indigo-500/50 disabled:opacity-40"
              style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
            />
            <button
              onClick={guardar}
              disabled={!monto || parseFloat(monto) <= 0 || pend <= 0}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-all"
            >
              {actionLabel}
            </button>
          </div>

          {pagos.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Historial de Pagos</p>
              <div className="space-y-1 max-h-28 overflow-y-auto mb-3">
                {pagos.map(p => (
                  <div key={p.id_pago} className="flex justify-between items-center px-3 py-1.5 rounded-lg" style={{ background: 'var(--white-alpha-3)' }}>
                    <span style={{ color: 'var(--text-secondary)' }} className="text-xs">{getMetodoIconAndLabel(p.metodo)} · {p.fecha}</span>
                    <span className="text-emerald-550 dark:text-emerald-400 font-mono text-xs font-bold">S/ {(p.monto || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Botón Editar - Secundario */}
          <button onClick={() => { onClose(); onEditar(mov); }}
            className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5"
            style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <Edit2 size={12} /> Editar Registro Completo (Solo correcciones)
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SacosGrid ── */
function SacosGrid({ sacos, color, showSum }) {
  const nC = Math.ceil(sacos.length / 5);
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5 mb-4">
      {Array.from({ length: nC }).map((_, ci) => {
        const lote = sacos.slice(ci * 5, (ci + 1) * 5);
        const sum = lote.reduce((a, s) => a + s.peso, 0);
        return (
          <div key={ci} className="rounded-xl overflow-hidden flex flex-col" style={{ background: 'var(--white-alpha-3)', border: '1px solid var(--border-subtle)' }}>
            {/* Peso sacos */}
            {lote.map((saco, si) => (
              <div key={saco.id_saco || si} className="text-center font-mono font-bold text-sm py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                {saco.peso.toFixed(1)}
              </div>
            ))}
            {/* Rellenar vacíos para mantener 5 filas */}
            {Array.from({ length: 5 - lote.length }).map((_, i) => (
              <div key={i} className="text-center text-[10px] py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-tertiary)' }}>·</div>
            ))}
            {/* Subtotal columna */}
            {showSum && (
              <div className="text-center font-black text-xs py-1.5 font-mono" style={{ color: color, background: `${color}18` }}>
                {sum.toFixed(1)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── DetalleTicketModal ── */
function DetalleTicketModal({ mov, sacos, varMap, onClose }) {
  if (!mov) return null;

  const esCompra = mov.tipo === 'compra';
  const esTransbordo = mov.es_transbordo === 1;

  // Formato de fecha y hora
  const fechaPE = mov.fecha ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const horaPE = mov.timestamp ? new Date(mov.timestamp).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

  // Agrupar sacos por variedad
  const varIds = [...new Set(sacos.map(s => s.id_variedad))];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'var(--overlay-backdrop)' }} onClick={onClose} />
      
      {/* Content Container */}
      <div className="relative w-full max-w-4xl rounded-t-3xl sm:rounded-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl" style={{ background: 'var(--modal-bg)', border: '1px solid var(--border-card)' }}>
        {/* Drag handle for mobile */}
        <div className="flex justify-center pt-2 sm:hidden flex-shrink-0"><div className="w-8 h-1 rounded-full" style={{ background: 'var(--text-tertiary)' }} /></div>
        
        {/* Cabecera */}
        <div className="px-5 pt-4 pb-3 flex justify-between items-start flex-shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded-md uppercase ${
                esTransbordo
                  ? 'bg-amber-600/20 text-amber-500 dark:text-amber-300'
                  : (esCompra ? 'bg-blue-600/20 text-blue-500 dark:text-blue-300' : 'bg-emerald-600/20 text-emerald-500 dark:text-emerald-300')
              }`}>
                {esTransbordo ? 'Transbordo' : (esCompra ? 'Compra' : 'Venta')}
              </span>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{fechaPE} · {horaPE}</span>
            </div>
            <h2 className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{mov._nombreSocioResolv || 'Socio'}</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Total de sacos registrados: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{mov._sacos}</span></p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full transition-all active:scale-95" style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {varIds.map(vid => {
            const v = varMap[vid] || { nombre: `Variedad ${vid}`, color: '#6366F1', codigo_corto: 'V' };
            const sacosVar = sacos.filter(s => s.id_variedad === vid);
            
            // Calcular neto
            const bruto = sacosVar.reduce((a, s) => a + s.peso, 0);
            const info = mov.variedades?.[vid] || {};
            const tipo = info.tipo_ajuste || 'NINGUNO';
            const kilos = info.kilos_ajuste || 0;
            const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);

            return (
              <div key={vid} className="mb-4">
                {/* Variedad Banner */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-2" style={{ backgroundColor: `${v.color}15`, borderLeft: `4px solid ${v.color}` }}>
                  <span className="font-bold text-xs uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>{v.codigo_corto} - {v.nombre}</span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    {sacosVar.length} sacos · {neto.toFixed(1)} kg {tipo !== 'NINGUNO' ? `(Neto)` : ''}
                  </span>
                </div>

                {/* Weights Grid */}
                <SacosGrid sacos={sacosVar} color={v.color} showSum={sacosVar.length >= 5} />
              </div>
            );
          })}

          {/* Resumen Financiero */}
          <div className="mt-6 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-secondary)' }}>Resumen Financiero</p>
            
            <div className="flex justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal de Variedades</span>
              <span className="font-semibold font-mono" style={{ color: 'var(--text-primary)' }}>S/ {mov._subtotal.toFixed(2)}</span>
            </div>

            {mov.flete_activo === 1 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Flete ({mov._totalPeso.toFixed(1)} kg x S/ {(mov.flete_precio_kg || 0).toFixed(2)})</span>
                <span className={`font-mono font-semibold ${mov.flete_tipo_signo === 'SUMAR' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {mov.flete_tipo_signo === 'SUMAR' ? '+' : '−'} S/ {(mov.flete_monto_total || 0).toFixed(2)}
                </span>
              </div>
            )}

            {Array.isArray(mov._adicionales) && mov._adicionales.map((a, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>{a.descripcion}</span>
                <span className={`font-mono font-semibold ${a.tipo === 'suma' ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {a.tipo === 'suma' ? '+' : '−'} S/ {a.monto.toFixed(2)}
                </span>
              </div>
            ))}

            {mov.fecha_edicion && (
              <div className="text-[10px] italic mt-2" style={{ color: 'var(--text-tertiary)' }}>
                Última edición: {new Date(mov.fecha_edicion).toLocaleString('es-PE')}
              </div>
            )}

            <div className="flex justify-between items-center pt-3 mt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>MONTO FINAL</span>
              <span className="text-emerald-500 dark:text-emerald-400 font-black text-2xl font-mono">S/ {mov._totalDinero.toFixed(2)}</span>
            </div>
          </div>

          {/* Close button inside scroll for mobile compatibility */}
          <button onClick={onClose}
            className="w-full mt-6 py-3 rounded-xl font-bold text-sm active:scale-95 transition-all"
            style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}




/* ── MAIN ── */
export default function Reportes() {
  const navigate = useNavigate();
  const [tipoF, setTipoF] = useState('todos');
  const [estadoF, setEstadoF] = useState('todos');
  const [socioSel, setSocioSel] = useState(null);
  const [busq, setBusq] = useState('');
  const [showSugg, setShowSugg] = useState(false);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [modalMov, setModalMov] = useState(null);
  const [modalDetalle, setModalDetalle] = useState(null);
  const suggRef = useRef(null);

  useEffect(() => {
    const h = e => { if (suggRef.current && !suggRef.current.contains(e.target)) setShowSugg(false); };
    document.addEventListener('mousedown', h); document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, []);

  const socios = useLiveQuery(() => db.socios.toArray()) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];
  const movimientos = useLiveQuery(() => db.movimientos.orderBy('fecha_actualizacion').reverse().toArray()) || [];
  const todosLosSacos = useLiveQuery(() => db.sacos.toArray()) || [];
  const todosLosPagos = useLiveQuery(() => db.transacciones_pago.toArray()) || [];
  const todosLosExtras = useLiveQuery(() => db.extras.toArray()) || [];

  const varMap = useMemo(() => Object.fromEntries(variedades.map(v => [v.id_variedad, v])), [variedades]);
  const socioMap = useMemo(() => Object.fromEntries(socios.map(s => [s.id_socio, s])), [socios]);

  const sacosMovDetalle = useMemo(() => {
    if (!modalDetalle) return [];
    return todosLosSacos.filter(s => s.uuid_movimiento === modalDetalle.uuid).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [modalDetalle, todosLosSacos]);

  // Objeto virtual para "Operaciones Rápidas" (centinela)
  const SOCIO_OCASIONAL_VIRTUAL = { id_socio: SENTINEL_ID, nombre: 'Operaciones Rápidas', _esOcasionalVirtual: true };

  const suggFiltered = useMemo(() => {
    const solosReales = socios.filter(s => !s.es_ocasional && s.id_socio !== SENTINEL_ID);
    if (!busq.trim()) return solosReales;
    const q = busq.toLowerCase();
    const filtrados = solosReales.filter(s => s.nombre?.toLowerCase().includes(q) || s.documento?.toLowerCase().includes(q));
    // Incluir opción centinela si el texto coincide con 'ocasional' o 'rápida'
    const incCentinela = 'operaciones rapidas rápidas ocasional'.includes(q.toLowerCase());
    return incCentinela ? [SOCIO_OCASIONAL_VIRTUAL, ...filtrados] : filtrados;
  }, [socios, busq]);

  // Enriquecer movimientos con totales
  const movsEnriquecidos = useMemo(() => {
    return movimientos.map(mov => {
      const sx = todosLosSacos.filter(s => s.uuid_movimiento === mov.uuid);
      const exs = todosLosExtras.filter(e => e.id_movimiento === mov.uuid);
      const precios = mov.precios_por_variedad || {};
      const varIds = [...new Set(sx.map(s => s.id_variedad))];
      const totalPeso = varIds.reduce((acc, vid) => {
        const sxVar = sx.filter(s => s.id_variedad === vid);
        const bruto = sxVar.reduce((a, s) => a + s.peso, 0);
        const info = mov.variedades?.[vid] || {};
        const tipo = info.tipo_ajuste || 'NINGUNO';
        const kilos = info.kilos_ajuste || 0;
        const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
        return acc + neto;
      }, 0);
      const totalExtras = exs.reduce((a, e) => a + (Number(e.monto) || 0), 0);
      const subtotalDinero = varIds.reduce((acc, vid) => {
        const sxVar = sx.filter(s => s.id_variedad === vid);
        const bruto = sxVar.reduce((a, s) => a + s.peso, 0);
        const info = mov.variedades?.[vid] || {};
        const tipo = info.tipo_ajuste || 'NINGUNO';
        const kilos = info.kilos_ajuste || 0;
        const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
        const p = parseFloat(precios[vid] || 0);
        const unit = info.unidad_precio || 'KG';
        const sub = unit === 'ARROBA' ? (neto / 11.5) * p : neto * p;
        return acc + sub;
      }, 0);

      // Adicionales guardados al finalizar (nuevos registros)
      const adicionales = mov.adicionales || [];
      const totalAdicionales = adicionales.reduce((acc, a) => {
        return a.tipo === 'suma' ? acc + a.monto : acc - a.monto;
      }, 0);

      // Flete automático fallback calculation
      const fleteActivo = mov.flete_activo === 1;
      const fleteMonto = fleteActivo ? (mov.flete_monto_total || 0) : 0;
      const fleteSigno = mov.flete_tipo_signo || 'RESTAR';
      const fleteNeto = fleteSigno === 'RESTAR' ? -fleteMonto : fleteMonto;

      // Monto neto: usar el guardado si existe, sino calcular con fallback
      const montoNeto = mov.monto_neto_final != null
        ? mov.monto_neto_final
        : subtotalDinero - totalExtras + totalAdicionales + fleteNeto;

      const pagos = todosLosPagos.filter(p => p.id_movimiento === mov.uuid);
      const totalPagado = pagos.reduce((a, p) => a + (p.monto || 0), 0);
      const saldo = Math.max(0, montoNeto - totalPagado);
      const varTags = Object.entries(
        sx.reduce((acc, s) => { acc[s.id_variedad] = (acc[s.id_variedad] || 0) + 1; return acc; }, {})
      ).map(([id, cnt]) => ({ v: varMap[id], cnt })).filter(x => x.v);

      return {
        ...mov,
        _sacos: sx.length,
        _totalPeso: totalPeso,
        _totalDinero: montoNeto,        // incluye adicionales
        _subtotal: subtotalDinero,      // subtotal crudo (sin adicionales)
        _adicionales: adicionales,      // array de adicionales guardados
        _totalPagado: totalPagado,
        _saldo: saldo,
        _varTags: varTags,
        _pagos: pagos,
        _nombreSocioResolv: resolveNombreSocio(mov, socioMap),
      };
    });
  }, [movimientos, todosLosSacos, todosLosPagos, todosLosExtras, varMap, socioMap]);

  const activeModalMov = useMemo(() => {
    if (!modalMov) return null;
    return movsEnriquecidos.find(m => m.uuid === modalMov.uuid) || modalMov;
  }, [modalMov, movsEnriquecidos]);

  // Filtrado
  const movsFiltrados = useMemo(() => {
    // Solo movimientos con al menos 1 saco (descartar borradores vacíos)
    let list = movsEnriquecidos.filter(m => m._sacos >= 1);
    if (tipoF !== 'todos') list = list.filter(m => m.tipo === tipoF);
    if (socioSel) {
      if (socioSel.id_socio === SENTINEL_ID) {
        // Filtrar todas las operaciones ocasionales (centinela)
        list = list.filter(m => m.id_socio === SENTINEL_ID);
      } else {
        list = list.filter(m => m.id_socio === socioSel.id_socio);
      }
    }
    if (fechaDesde) list = list.filter(m => m.fecha >= fechaDesde);
    if (fechaHasta) list = list.filter(m => m.fecha <= fechaHasta);
    if (estadoF === 'pagado') list = list.filter(m => m._totalDinero > 0 && m._saldo <= 0);
    else if (estadoF === 'parcial') list = list.filter(m => m._totalPagado > 0 && m._saldo > 0);
    else if (estadoF === 'pendiente') list = list.filter(m => m._totalDinero > 0 && m._totalPagado <= 0);
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [movsEnriquecidos, tipoF, socioSel, fechaDesde, fechaHasta, estadoF]);

  // Deuda consolidada del socio seleccionado
  const deudaSocio = useMemo(() => {
    if (!socioSel) return null;
    const movsSocio = movsEnriquecidos.filter(m => m.id_socio === socioSel.id_socio && m._sacos >= 1);
    const total = movsSocio.reduce((a, m) => a + m._saldo, 0);
    const ops = movsSocio.length;
    return { total, ops };
  }, [socioSel, movsEnriquecidos]);

  const handlePago = async (data) => {
    await db.transacciones_pago.add(data);
  };

  const handleEditar = (mov) => {
    if (mov.tipo === 'compra') { localStorage.setItem('compra_activa_uuid', mov.uuid); navigate('/compra'); }
    else { localStorage.setItem('venta_activa_uuid', mov.uuid); navigate('/venta'); }
  };

  const clearSocio = () => { setSocioSel(null); setBusq(''); };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden" style={{ background: 'var(--surface-base)', color: 'var(--text-primary)', fontFamily: FONT }}>

      {/* HEADER */}
      <div className="flex-shrink-0 px-4 pt-5 pb-2" style={{ background: 'linear-gradient(180deg, var(--gradient-header-start) 0%, var(--gradient-header-end) 100%)' }}>
        <h1 className="text-lg font-black tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>Reportes</h1>

        {/* Buscador de socio */}
        <div className="relative mb-2.5" ref={suggRef}>
          {socioSel ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--icon-bg-indigo)', border: '1px solid rgba(99,102,241,0.3)' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px]" style={{ background: 'rgba(99,102,241,0.3)', color: '#a5b4fc' }}>{socioSel.nombre[0]}</div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{socioSel.nombre}</span>
              </div>
              <button onClick={clearSocio}><X size={14} style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
          ) : (
            <>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
              <input type="text" placeholder="Buscar socio..."
                className="w-full pl-8 pr-3 py-2 text-sm outline-none rounded-xl"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                value={busq} onChange={e => { setBusq(e.target.value); setShowSugg(true); }}
                onFocus={() => setShowSugg(true)} />
              {/* Dropdown: Operaciones Rápidas + socios frecuentes */}
              {showSugg && (
                <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-card)', maxHeight: 240, overflowY: 'auto' }}>
                  {/* Acceso directo a Operaciones Rápidas — siempre visible */}
                  <button
                    onClick={() => { setSocioSel(SOCIO_OCASIONAL_VIRTUAL); setShowSugg(false); setBusq(''); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all active:bg-black/5 dark:active:bg-white/5"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px]" style={{ background: 'rgba(250,204,21,0.15)', color: '#FACC15' }}>⚡</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-yellow-500 dark:text-yellow-300 text-sm font-bold">Operaciones Rápidas</p>
                      <p className="text-yellow-600 dark:text-yellow-500/70 text-[10px]">Ver todas las op. sin socio registrado</p>
                    </div>
                  </button>
                  {/* Socios frecuentes filtrados */}
                  {suggFiltered.map(s => (
                    <button key={s.id_socio} onClick={() => { setSocioSel(s); setBusq(''); setShowSugg(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all active:bg-black/5 dark:active:bg-white/5"
                      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-black text-[10px]" style={{ background: 'rgba(100,116,139,0.3)', color: 'var(--text-secondary)' }}>{s.nombre[0]}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{s.nombre}</p>
                        {s.documento && <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>{s.documento}</p>}
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: s.es_proveedor ? 'rgba(37,99,235,0.15)' : 'rgba(16,185,129,0.15)', color: s.es_proveedor ? '#60a5fa' : '#34d399' }}>
                        {s.es_proveedor ? 'Prov' : 'Cli'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Filtros tipo */}
        <div className="flex gap-1.5 mb-2">
          {[{ k: 'todos', l: 'Todos' }, { k: 'compra', l: 'Compras' }, { k: 'venta', l: 'Ventas' }].map(t => (
            <button key={t.k} onClick={() => setTipoF(t.k)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all font-sans"
              style={{
                background: tipoF === t.k ? 'var(--filter-tab-active-bg)' : 'var(--filter-tab-bg)',
                color: tipoF === t.k ? 'var(--filter-tab-active-text)' : 'var(--filter-tab-text)',
              }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Filtros estado pago */}
        <div className="flex gap-1.5 mb-2">
          {[
            { k: 'todos', l: 'Todos', c: '#94a3b8' },
            { k: 'pagado', l: 'Pagados', c: '#10b981' },
            { k: 'parcial', l: 'Parciales', c: '#f59e0b' },
            { k: 'pendiente', l: 'Pendientes', c: '#ef4444' },
          ].map(t => {
            const isActive = estadoF === t.k;
            return (
              <button key={t.k} onClick={() => setEstadoF(t.k)}
                className="px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border outline-none font-sans"
                style={{
                  background: isActive ? `${t.c}20` : 'var(--white-alpha-3)',
                  color: isActive ? t.c : 'var(--text-secondary)',
                  borderColor: isActive ? `${t.c}40` : 'transparent'
                }}
              >
                {t.l}
              </button>
            );
          })}
        </div>

        {/* Filtros fecha */}
        <div className="flex gap-2 mb-1">
          <div className="flex-1 relative">
            <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
          </div>
          <div className="flex-1 relative">
            <Calendar size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
            <input type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg outline-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', colorScheme: 'dark' }} />
          </div>
          {(fechaDesde || fechaHasta) && (
            <button onClick={() => { setFechaDesde(''); setFechaHasta(''); }} className="px-2" style={{ color: 'var(--text-secondary)' }}><X size={13} /></button>
          )}
        </div>
      </div>

      {/* DEUDA CONSOLIDADA */}
      {deudaSocio && (
        <div className="flex-shrink-0 mx-4 mb-2">
          <div className="p-3 rounded-xl" style={{ background: deudaSocio.total > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', border: `1px solid ${deudaSocio.total > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Saldo Total · {socioSel.nombre}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{deudaSocio.ops} operaciones</p>
              </div>
              <p className={`text-xl font-black font-mono ${deudaSocio.total > 0 ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                S/ {deudaSocio.total.toFixed(2)}
              </p>
            </div>
          </div>
          {/* Botón Estado de Cuenta */}
          <button
            onClick={() => navigate('/estado-cuenta/' + socioSel.id_socio + '?tipoFlujo=' + tipoF)}
            className="w-full mt-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <FileText size={14} />
            📄 Ver Estado de Cuenta
          </button>
        </div>
      )}

      {/* LISTA */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 min-h-0">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>{movsFiltrados.length} registros</p>

        {movsFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Sin resultados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {movsFiltrados.map(mov => {
              const nombreSocio = resolveNombreSocio(mov, socioMap);
              const esCompra = mov.tipo === 'compra';
              const fecha = mov.fecha ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' }) : '';

              return (
                <div key={mov.id_movimiento} className="rounded-2xl p-3 transition-all"
                  style={{ background: 'var(--white-alpha-3)', border: '1px solid var(--border-subtle)' }}>
                  {/* Row 1 */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      mov.es_transbordo === 1
                        ? 'bg-amber-600/20'
                        : (esCompra ? 'bg-blue-600/20' : 'bg-emerald-600/20')
                    }`}>
                      {mov.es_transbordo === 1
                        ? <ArrowLeftRight size={13} className="text-amber-400" />
                        : (esCompra ? <PackagePlus size={13} className="text-blue-400" /> : <PackageMinus size={13} className="text-emerald-400" />)
                      }
                    </div>
                    <span className={`text-[9px] font-black tracking-widest px-1.5 py-0.5 rounded-md uppercase ${
                      mov.es_transbordo === 1
                        ? 'bg-amber-600/30 text-amber-300'
                        : (esCompra ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300')
                    }`}>
                      {mov.es_transbordo === 1 ? 'Transbordo' : (esCompra ? 'Compra' : 'Venta')}
                    </span>
                    <span className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md ${mov.estado === 'activo' ? 'bg-amber-500/20 text-amber-350 dark:text-amber-300' : 'bg-slate-500/20 text-slate-500 dark:text-slate-400'}`}>
                      {mov.estado === 'activo' ? 'Activo' : 'Cerrado'}
                    </span>
                    <span className="text-xs font-bold truncate flex-1" style={{ color: 'var(--text-primary)' }}>{nombreSocio}</span>
                  </div>
                  {/* Row 2: var tags + fecha */}
                  <div className="flex items-center flex-wrap gap-1 mb-2">
                    {mov._varTags.map(({ v, cnt }) => (
                      <span key={v.id_variedad} className="text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5"
                        style={{ backgroundColor: v.color, color: txColor(v.color) }}>
                        {v.codigo_corto}<span className="opacity-70">·{cnt}</span>
                      </span>
                    ))}
                    {fecha && <span className="text-[10px] ml-auto" style={{ color: 'var(--text-tertiary)' }}>{fecha}</span>}
                  </div>
                  {/* Row 3: Resumen de sacos y peso + TOTAL */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Layers size={10} style={{ color: 'var(--text-tertiary)' }} />
                        <span className="font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{mov._sacos}</span>
                        <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>sacos</span>
                      </div>
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{fmt(mov._totalPeso)} kg</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--text-tertiary)' }}>TOTAL</span>
                      <span className="font-mono font-black text-sm block" style={{ color: 'var(--text-primary)' }}>
                        S/ {mov._totalDinero.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Row 4: Barra de Progreso Financiero */}
                  {(() => {
                    const totalDinero = mov._totalDinero || 0;
                    const totalPagado = mov._totalPagado || 0;
                    const porcentaje = totalDinero > 0 ? Math.min(100, Math.round((totalPagado / totalDinero) * 100)) : 100;
                    const isCompraReal = mov.tipo === 'compra' && mov.es_transbordo !== 1;
                    const labelTexto = isCompraReal ? 'PAGADO' : 'COBRADO';
                    const pendiente = Math.max(0, totalDinero - totalPagado);
                    const textFalta = isCompraReal ? 'Falta Pagar' : 'Falta Cobrar';

                    return (
                      <div className="mb-3.5">
                        <div className="flex justify-between items-center text-[9px] font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                          <span>
                            {labelTexto}: S/ {totalPagado.toFixed(2)}
                            {pendiente > 0 && (
                              <span className="text-rose-500 dark:text-rose-400 font-black ml-1.5">
                                · {textFalta}: S/ {pendiente.toFixed(2)}
                              </span>
                            )}
                          </span>
                          <span className="text-emerald-500 dark:text-emerald-400">{porcentaje}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--white-alpha-5)' }}>
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${porcentaje}%` }} />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Row 5: Botones Simétricos (Doble Columna) */}
                  <div className="flex w-full gap-2">
                    <button onClick={() => setModalDetalle(mov)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                      style={{ background: 'var(--white-alpha-5)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      👁️ Detalles
                    </button>
                    <button onClick={() => setModalMov(mov)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                      style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}>
                      💵 Actualizar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {modalMov && (
        <PagoModal
          mov={activeModalMov}
          pagos={activeModalMov?._pagos || []}
          onClose={() => setModalMov(null)}
          onPago={handlePago}
          onEditar={handleEditar}
        />
      )}

      {modalDetalle && (
        <DetalleTicketModal
          mov={modalDetalle}
          sacos={sacosMovDetalle}
          varMap={varMap}
          onClose={() => setModalDetalle(null)}
        />
      )}

    </div>
  );
}
