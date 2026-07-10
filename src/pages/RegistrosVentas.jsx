import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import {
  ChevronLeft, Printer, Plus, X, Trash2,
  ShoppingBag, ArrowLeftRight, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

/* ─── Modal Gastos / Extras ─── */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-16">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl flex flex-col" style={{ background: '#1A2438', maxHeight: '70vh' }}>
        <div className="flex justify-center pt-2"><div className="w-8 h-1 rounded-full bg-slate-600" /></div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-white font-bold text-sm">Gastos / Extras</span>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/8 text-slate-400"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-2 space-y-2">
          {extras.map(ex => (
            <div key={ex.id_extra} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-white text-sm">{ex.descripcion}</span>
              <div className="flex items-center space-x-3">
                <span className="text-amber-400 font-mono font-bold text-sm">S/ {Number(ex.monto).toFixed(2)}</span>
                <button onClick={() => db.extras.delete(ex.id_extra)} className="text-red-400 opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {extras.length === 0 && <p className="text-slate-600 text-sm text-center py-4">Sin extras</p>}
        </div>
        <div className="px-4 pb-5 pt-2 border-t border-white/5">
          <div className="flex space-x-2 mb-3">
            <input type="text" placeholder="Descripción (Estiba, Flete...)" value={desc} onChange={e => setDesc(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs outline-none" />
            <input type="number" placeholder="Monto" value={monto} onChange={e => setMonto(e.target.value)}
              className="w-24 bg-white/5 border border-white/10 text-white placeholder-slate-600 rounded-xl px-3 py-2 text-xs outline-none" />
          </div>
          <button onClick={add} className="w-full py-2.5 rounded-xl bg-amber-600/80 text-white font-bold text-xs active:scale-95 transition-all">
            + Agregar Gasto
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Editar Saco ─── */
function EditSacoModal({ saco, onClose }) {
  const [peso, setPeso] = useState(String(saco.peso));
  const save = async () => {
    const w = parseFloat(peso);
    if (!w || w <= 0) return;
    await db.sacos.update(saco.id_saco, { peso: w });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xs rounded-2xl p-5" style={{ background: '#1A2438', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-white font-bold text-sm mb-3">Editar peso (kg)</p>
        <input type="number" value={peso} onChange={e => setPeso(e.target.value)}
          className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/50 text-white rounded-xl px-3 py-2.5 text-sm outline-none mb-3 font-mono" />
        <div className="flex space-x-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl text-slate-400 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
          <button onClick={save} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold active:scale-95 transition-all">Guardar</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistrosVentas() {
  const navigate = useNavigate();
  const uuid = localStorage.getItem('venta_activa_uuid') || '';

  // Filtramos sacos estrictamente por uuid_movimiento (nuevo índice)
  // Fallback a id_movimiento para compatibilidad con registros migrados
  const sacos = useLiveQuery(
    () => uuid
      ? db.sacos.where('uuid_movimiento').equals(uuid).sortBy('timestamp')
      : Promise.resolve([]),
    [uuid]
  ) || [];
  const extras     = useLiveQuery(() => uuid ? db.extras.where('id_movimiento').equals(uuid).toArray() : [], [uuid]) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];
  const socios     = useLiveQuery(() => db.socios.toArray()) || [];

  const [precios, setPrecios] = useState({});
  const [showGastos, setShowGastos] = useState(false);
  const [editSaco, setEditSaco] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const varMap = useMemo(() => Object.fromEntries(variedades.map(v => [v.id_variedad, v])), [variedades]);
  const variedadesIds = useMemo(() => [...new Set(sacos.map(s => s.id_variedad))], [sacos]);

  const totalPeso = sacos.reduce((a, s) => a + s.peso, 0);
  const totalExtras = extras.reduce((a, e) => a + (Number(e.monto) || 0), 0);
  const totalDinero = variedadesIds.reduce((acc, vid) => {
    const peso = sacos.filter(s => s.id_variedad === vid).reduce((a, s) => a + s.peso, 0);
    return acc + peso * parseFloat(precios[vid] || 0);
  }, 0);

  const deleteSaco = async (id) => { await db.sacos.delete(id); setConfirmDel(null); };

  const generarPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(5, 150, 105);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('SISGECO MVP — Comprobante de Venta', 14, 10);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-PE')}`, 14, 17);

    let y = 30;
    doc.setTextColor(30, 30, 30);

    variedadesIds.forEach(vid => {
      const v = varMap[vid];
      const sacosV = sacos.filter(s => s.id_variedad === vid);
      const numCols = Math.ceil(sacosV.length / 5);
      doc.setFontSize(10); doc.setFont('helvetica', 'bold');
      doc.text(`Variedad: ${v?.nombre || vid} (${sacosV.length} sacos)`, 14, y); y += 6;

      const bodyRows = Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: numCols }, (__, col) => {
          const saco = sacosV[col * 5 + row];
          return saco ? saco.peso.toFixed(1) : '';
        })
      );
      const subRow = Array.from({ length: numCols }, (_, col) => {
        const lote = sacosV.slice(col * 5, (col + 1) * 5);
        return lote.reduce((s, x) => s + x.peso, 0).toFixed(1);
      });
      bodyRows.push(subRow);

      autoTable(doc, {
        startY: y,
        head: [Array.from({ length: numCols }, (_, i) => `Lote ${i + 1}`)],
        body: bodyRows,
        styles: { fontSize: 8, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    });

    const resumenRows = variedadesIds.map(vid => {
      const v = varMap[vid];
      const sacosV = sacos.filter(s => s.id_variedad === vid);
      const pesoT = sacosV.reduce((a, s) => a + s.peso, 0);
      const precio = parseFloat(precios[vid] || 0);
      return [v?.nombre || vid, sacosV.length, pesoT.toFixed(1) + ' kg', 'S/ ' + precio.toFixed(2), 'S/ ' + (pesoT * precio).toFixed(2)];
    });
    extras.forEach(e => resumenRows.push([e.descripcion, '—', '—', '—', '- S/ ' + Number(e.monto).toFixed(2)]));

    autoTable(doc, {
      startY: y + 4,
      head: [['Variedad/Concepto', 'Sacos', 'Peso Total', 'Precio/kg', 'Subtotal']],
      body: resumenRows,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
      foot: [['', '', '', 'TOTAL NETO', 'S/ ' + (totalDinero - totalExtras).toFixed(2)]],
      footStyles: { fillColor: [209, 250, 229], textColor: [5, 150, 105], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });

    doc.save(`Venta_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const finalizar = async () => {
    if (uuid) {
      await db.movimientos.where('uuid').equals(uuid).modify({ estado: 'finalizado' });
      localStorage.removeItem('venta_activa_uuid');
    }
    navigate('/');
  };

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden" style={{ background: '#080E1A', fontFamily: FONT }}>
      {showGastos && <GastosModal uuid={uuid} onClose={() => setShowGastos(false)} />}
      {editSaco && <EditSacoModal saco={editSaco} onClose={() => setEditSaco(null)} />}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDel(null)} />
          <div className="relative w-full max-w-xs rounded-2xl p-5 text-center" style={{ background: '#1A2438' }}>
            <Trash2 size={28} className="text-red-400 mx-auto mb-3" />
            <p className="text-white font-bold text-sm mb-4">¿Eliminar este saco?</p>
            <div className="flex space-x-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2 rounded-xl text-slate-400 text-sm font-bold" style={{ background: 'rgba(255,255,255,0.05)' }}>Cancelar</button>
              <button onClick={() => deleteSaco(confirmDel)} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 flex items-center space-x-3 px-4 pt-4 pb-3" style={{ background: 'linear-gradient(180deg,rgba(30,41,59,0.9) 0%,rgba(8,14,26,0) 100%)' }}>
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white"><ChevronLeft size={18} /></button>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-white font-bold text-base">Registros Venta</span>
          </div>
          <p className="text-slate-500 text-[11px] mt-0.5">{sacos.length} sacos · {totalPeso.toFixed(1)} kg</p>
        </div>
        <button onClick={() => navigate('/venta')} className="w-8 h-8 rounded-full bg-white/8 flex items-center justify-center text-white"><ShoppingBag size={16} /></button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0 space-y-4">
        {/* Tabla financiera */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="grid text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white/3 px-3 py-2" style={{ gridTemplateColumns: '2fr 1fr 2fr 2fr 2fr' }}>
            <span>Variedad</span><span className="text-center">Sacos</span><span className="text-right">Peso</span><span className="text-right">S//kg</span><span className="text-right">Subtotal</span>
          </div>
          {variedadesIds.map(vid => {
            const v = varMap[vid];
            const sacosV = sacos.filter(s => s.id_variedad === vid);
            const pesoT = sacosV.reduce((a, s) => a + s.peso, 0);
            const precio = parseFloat(precios[vid] || 0);
            const subtotal = pesoT * precio;
            return (
              <div key={vid} className="grid items-center px-3 py-2.5 border-b border-white/5" style={{ gridTemplateColumns: '2fr 1fr 2fr 2fr 2fr' }}>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: v?.color || '#10b981' }} />
                  <span className="text-white text-xs font-semibold truncate">{v?.codigo_corto || vid}</span>
                </div>
                <span className="text-center text-white text-xs font-bold">{sacosV.length}</span>
                <span className="text-right text-slate-300 text-xs font-mono">{pesoT.toFixed(1)}</span>
                <div className="flex justify-end">
                  <input type="number" placeholder="0.00" value={precios[vid] || ''}
                    onChange={e => setPrecios(p => ({ ...p, [vid]: e.target.value }))}
                    className="w-16 bg-white/5 border border-white/10 focus:border-emerald-500/40 text-white text-xs text-right rounded-lg px-1.5 py-1 outline-none font-mono" />
                </div>
                <span className="text-right text-emerald-400 text-xs font-bold font-mono">
                  {subtotal > 0 ? `S/ ${subtotal.toFixed(2)}` : '—'}
                </span>
              </div>
            );
          })}
          {extras.map(e => (
            <div key={e.id_extra} className="grid items-center px-3 py-2 border-b border-white/5" style={{ gridTemplateColumns: '2fr 1fr 2fr 2fr 2fr' }}>
              <span className="text-amber-300 text-xs col-span-4">{e.descripcion}</span>
              <span className="text-right text-red-400 text-xs font-bold font-mono">-S/ {Number(e.monto).toFixed(2)}</span>
            </div>
          ))}
          <div className="grid items-center px-3 py-3" style={{ gridTemplateColumns: '2fr 1fr 2fr 2fr 2fr', background: 'rgba(5,150,105,0.1)' }}>
            <span className="text-emerald-300 text-xs font-black uppercase col-span-3">Total General</span>
            <span className="text-center text-white text-xs font-bold">{sacos.length} sac.</span>
            <span className="text-right text-emerald-300 text-sm font-black font-mono">
              S/ {(totalDinero - totalExtras).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Grid de sacos por variedad */}
        {variedadesIds.map(vid => {
          const v = varMap[vid];
          const sacosV = sacos.filter(s => s.id_variedad === vid);
          const numCols = Math.ceil(sacosV.length / 5);
          return (
            <div key={vid} className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center space-x-2 px-3 py-2.5" style={{ backgroundColor: `${v?.color || '#10b981'}22`, borderBottom: `1px solid ${v?.color || '#10b981'}30` }}>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: v?.color }} />
                <span className="text-white font-bold text-xs">{v?.nombre || vid}</span>
                <span className="text-slate-500 text-[10px]">({sacosV.length} sacos)</span>
              </div>
              <div className="p-2 overflow-x-auto">
                <div className="flex space-x-2" style={{ minWidth: 'max-content' }}>
                  {Array.from({ length: numCols }).map((_, cIdx) => {
                    const lote = sacosV.slice(cIdx * 5, (cIdx + 1) * 5);
                    const sub = lote.reduce((a, s) => a + s.peso, 0);
                    return (
                      <div key={cIdx} className="rounded-xl overflow-hidden flex flex-col" style={{ minWidth: 68, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {lote.map((saco, i) => (
                          <button key={i} onClick={() => setEditSaco(saco)}
                            className="text-center font-mono font-bold text-xs py-1.5 border-b border-white/5 transition-all hover:bg-white/8"
                            style={{ color: v?.color || '#10b981' }}>
                            {saco.peso.toFixed(1)}
                          </button>
                        ))}
                        {Array.from({ length: 5 - lote.length }).map((_, i) => (
                          <div key={i} className="text-center text-slate-800 text-[10px] py-1.5 border-b border-white/3">·</div>
                        ))}
                        <div className="text-center font-black text-xs py-1.5 font-mono" style={{ color: v?.color, background: `${v?.color}15` }}>
                          {sub.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {variedadesIds.length === 0 && (
          <div className="flex flex-col items-center justify-center h-36 space-y-2">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <ShoppingBag size={22} className="text-slate-700" />
            </div>
            <p className="text-slate-600 text-sm">Sin sacos registrados aún</p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 flex items-center space-x-2 px-3 py-2.5 border-t border-white/5" style={{ background: 'rgba(8,14,26,0.95)' }}>
        <button onClick={() => setShowGastos(true)}
          className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl text-amber-400 text-xs font-bold transition-all active:scale-95"
          style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <Plus size={14} /><span>Extras</span>
        </button>
        <button onClick={generarPDF}
          className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl text-emerald-400 text-xs font-bold transition-all active:scale-95"
          style={{ background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)' }}>
          <Printer size={14} /><span>PDF</span>
        </button>
        <button onClick={finalizar}
          className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-white text-sm font-black transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#059669,#047857)', boxShadow: '0 4px 12px rgba(5,150,105,0.35)' }}>
          <Check size={16} /><span>FINALIZAR OPERACIÓN</span>
        </button>
      </div>
    </div>
  );
}
