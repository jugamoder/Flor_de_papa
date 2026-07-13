import { useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SENTINEL_ID } from '../db/database';
import { ArrowLeft, MoreVertical, X, Banknote, CreditCard, Landmark, Calendar, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

export default function EstadoCuenta() {
  const { idSocio } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tipoFlujo = searchParams.get('tipoFlujo') || 'todos';
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [showLiquidarModal, setShowLiquidarModal] = useState(false);

  const parsedIdSocio = useMemo(() => {
    if (idSocio === SENTINEL_ID) return SENTINEL_ID;
    const parsed = parseInt(idSocio, 10);
    return isNaN(parsed) ? idSocio : parsed;
  }, [idSocio]);

  const socio = useLiveQuery(() => db.socios.get(parsedIdSocio), [parsedIdSocio]);
  const movimientos = useLiveQuery(() => db.movimientos.where('id_socio').equals(parsedIdSocio).toArray(), [parsedIdSocio]) || [];
  const todosLosSacos = useLiveQuery(() => db.sacos.toArray()) || [];
  const todosLosPagos = useLiveQuery(() => db.transacciones_pago.where('id_socio').equals(parsedIdSocio).toArray(), [parsedIdSocio]) || [];
  const todosLosExtras = useLiveQuery(() => db.extras.toArray()) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];

  // Enrich partner movements
  const enrichedMovs = useMemo(() => {
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
        return acc + (tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto));
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
        return acc + (info.unidad_precio === 'ARROBA' ? (neto / 11.5) * p : neto * p);
      }, 0);

      const adicionales = mov.adicionales || [];
      const totalAdicionales = adicionales.reduce((acc, a) => a.tipo === 'suma' ? acc + a.monto : acc - a.monto, 0);

      const fleteActivo = mov.flete_activo === 1;
      const fleteMonto = fleteActivo ? (mov.flete_monto_total || 0) : 0;
      const fleteNeto = mov.flete_tipo_signo === 'RESTAR' ? -fleteMonto : fleteMonto;

      const montoNeto = mov.monto_neto_final != null
        ? mov.monto_neto_final
        : subtotalDinero - totalExtras + totalAdicionales + fleteNeto;

      const pagos = todosLosPagos.filter(p => p.id_movimiento === mov.uuid);
      const totalPagado = pagos.reduce((a, p) => a + (p.monto || 0), 0);
      const saldo = Math.max(0, montoNeto - totalPagado);

      return {
        ...mov,
        _sacos: sx.length,
        _totalPeso: totalPeso,
        _totalDinero: montoNeto,
        _totalPagado: totalPagado,
        _saldo: saldo,
      };
    });
  }, [movimientos, todosLosSacos, todosLosPagos, todosLosExtras, variedades]);

  const esVenta = tipoFlujo === 'venta';
  const esCompra = tipoFlujo === 'compra';

  const deudaNeta = useMemo(() => {
    return enrichedMovs.reduce((a, m) => a + (m._saldo || 0), 0);
  }, [enrichedMovs]);

  const operaciones = useMemo(() => {
    return [...enrichedMovs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [enrichedMovs]);

  const abonos = useMemo(() => {
    return [...todosLosPagos].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [todosLosPagos]);

  // Contextual labels
  const isCompraFlow = esCompra || (tipoFlujo === 'todos' && socio?.es_proveedor === 1);
  const labelDeuda = isCompraFlow ? 'Deuda nuestra' : 'Deuda del socio';
  const tituloAbonos = isCompraFlow ? 'Historial de Pagos' : 'Historial de Cobros';
  const labelRapido = isCompraFlow ? '⚡ Registrar Pago' : '⚡ Registrar Cobro';
  
  const accentColor = deudaNeta > 0 ? (esCompra ? '#38bdf8' : '#fb7185') : '#34d399';

  const getMetodoInfo = (m) => {
    if (m === 'yape') return { label: 'Yape', color: '#a855f7', bg: 'rgba(168,85,247,0.15)', emoji: '📱' };
    if (m === 'deposito') return { label: 'Depósito', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', emoji: '🏦' };
    return { label: 'Efectivo', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', emoji: '💵' };
  };

  const initials = socio ? (socio.nombre || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';

  const handleSaveAbono = async (montoAbonoGlobal, metodo, fecha, destino, nota) => {
    const value = parseFloat(montoAbonoGlobal);
    if (isNaN(value) || value <= 0) return;

    // 1. Fetch active movements for this socio of matching type from Dexie
    const movs = await db.movimientos
      .where('id_socio')
      .equals(parsedIdSocio)
      .filter(m => m.tipo === (isCompraFlow ? 'compra' : 'venta') && m.estado === 'activo')
      .toArray();

    // 2. Enrich and filter those with positive pending balance
    const enriched = [];
    for (const m of movs) {
      const sx = await db.sacos.where('uuid_movimiento').equals(m.uuid).toArray();
      const exs = await db.extras.where('id_movimiento').equals(m.uuid).toArray();
      const precios = m.precios_por_variedad || {};
      const varIds = [...new Set(sx.map(s => s.id_variedad))];
      
      const totalExtras = exs.reduce((a, e) => a + (Number(e.monto) || 0), 0);
      
      const subtotalDinero = varIds.reduce((acc, vid) => {
        const sxVar = sx.filter(s => s.id_variedad === vid);
        const bruto = sxVar.reduce((a, s) => a + s.peso, 0);
        const info = m.variedades?.[vid] || {};
        const tipo = info.tipo_ajuste || 'NINGUNO';
        const kilos = info.kilos_ajuste || 0;
        const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
        const p = parseFloat(precios[vid] || 0);
        return acc + (info.unidad_precio === 'ARROBA' ? (neto / 11.5) * p : neto * p);
      }, 0);

      const adicionales = m.adicionales || [];
      const totalAdicionales = adicionales.reduce((acc, a) => a.tipo === 'suma' ? acc + a.monto : acc - a.monto, 0);

      const fleteActivo = m.flete_activo === 1;
      const fleteMonto = fleteActivo ? (m.flete_monto_total || 0) : 0;
      const fleteNeto = m.flete_tipo_signo === 'RESTAR' ? -fleteMonto : fleteMonto;

      const totalDinero = m.monto_neto_final != null
        ? m.monto_neto_final
        : subtotalDinero - totalExtras + totalAdicionales + fleteNeto;

      const pagos = await db.transacciones_pago.where('id_movimiento').equals(m.uuid).toArray();
      const totalPagado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);
      const saldo = Math.max(0, totalDinero - totalPagado);

      if (saldo > 0) {
        enriched.push({
          ...m,
          _saldo: saldo,
          _timestamp: m.timestamp || 0
        });
      }
    }

    // 3. Sort by timestamp strictly ascending (FIFO - oldest first)
    enriched.sort((a, b) => a._timestamp - b._timestamp);

    let saldoRemanente = value;

    // 4. Cascade distribution inside Dexie transaction
    await db.transaction('rw', [db.transacciones_pago, db.movimientos], async () => {
      for (const ticket of enriched) {
        const abonoParcial = Math.min(saldoRemanente, ticket._saldo);
        if (abonoParcial <= 0) continue;

        await db.transacciones_pago.add({
          id_pago: undefined,
          id_socio: parsedIdSocio,
          id_movimiento: ticket.uuid,
          monto: abonoParcial,
          metodo,
          fecha,
          timestamp: Date.now(),
          nota: `[Cobro Rápido FIFO] - Destino: ${destino || 'No especificado'} - Nota original: ${nota || ''}`
        });

        saldoRemanente -= abonoParcial;
        if (saldoRemanente <= 0) break;
      }

      // 5. Advanced payment / excess handler
      if (saldoRemanente > 0) {
        await db.transacciones_pago.add({
          id_pago: undefined,
          id_socio: parsedIdSocio,
          id_movimiento: null,
          monto: saldoRemanente,
          metodo,
          fecha,
          timestamp: Date.now(),
          nota: `[Cobro Rápido FIFO Sobrante] - Destino: ${destino || 'No especificado'} - Nota original: ${nota || ''}`
        });
      }
    });

    setShowAbonoModal(false);
  };

  const handleLiquidarSave = async (selectedIds) => {
    if (selectedIds.length === 0) return;

    await db.transaction('rw', [db.movimientos, db.transacciones_pago, db.sacos, db.extras], async () => {
      for (const id of selectedIds) {
        const mov = await db.movimientos.get(id);
        if (!mov) continue;

        const sx = await db.sacos.where('uuid_movimiento').equals(mov.uuid).toArray();
        const exs = await db.extras.where('id_movimiento').equals(mov.uuid).toArray();
        const precios = mov.precios_por_variedad || {};
        const varIds = [...new Set(sx.map(s => s.id_variedad))];
        
        const subtotalDinero = varIds.reduce((acc, vid) => {
          const sxVar = sx.filter(s => s.id_variedad === vid);
          const bruto = sxVar.reduce((a, s) => a + s.peso, 0);
          const info = mov.variedades?.[vid] || {};
          const tipo = info.tipo_ajuste || 'NINGUNO';
          const kilos = info.kilos_ajuste || 0;
          const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
          const p = parseFloat(precios[vid] || 0);
          return acc + (info.unidad_precio === 'ARROBA' ? (neto / 11.5) * p : neto * p);
        }, 0);

        const totalExtras = exs.reduce((a, e) => a + (Number(e.monto) || 0), 0);
        const adicionales = mov.adicionales || [];
        const totalAdicionales = adicionales.reduce((acc, a) => a.tipo === 'suma' ? acc + a.monto : acc - a.monto, 0);

        const fleteActivo = mov.flete_activo === 1;
        const fleteMonto = fleteActivo ? (mov.flete_monto_total || 0) : 0;
        const fleteNeto = mov.flete_tipo_signo === 'RESTAR' ? -fleteMonto : fleteMonto;

        const totalDinero = mov.monto_neto_final != null
          ? mov.monto_neto_final
          : subtotalDinero - totalExtras + totalAdicionales + fleteNeto;

        const pagos = await db.transacciones_pago.where('id_movimiento').equals(mov.uuid).toArray();
        const totalPagado = pagos.reduce((sum, p) => sum + (p.monto || 0), 0);
        const saldo = Math.max(0, totalDinero - totalPagado);

        if (saldo > 0) {
          // Complete payment on movement
          await db.movimientos.where('id_movimiento').equals(id).modify({
            monto_pagado: totalDinero
          });

          // Insert payment audit log
          await db.transacciones_pago.add({
            id_pago: undefined,
            id_socio: parsedIdSocio,
            id_movimiento: mov.uuid,
            monto: saldo,
            metodo: 'efectivo',
            fecha: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()),
            timestamp: Date.now(),
            nota: `[Liquidación Consolidada Masiva]`
          });
        }
      }
    });

    setShowLiquidarModal(false);
  };

  const generarPdfEstadoCuenta = () => {
    if (!socio) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // 1. Corporate Header
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Flor de Papa Peru', 14, 15);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Mercado Mayorista de Papas, Lima', 14, 20);
    doc.text('Contacto: contacto@flordepapaperu.com', 14, 24);

    // Socio Info (Right)
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Socio: ${socio.nombre}`, pageW - 14, 15, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('SOCIO COMERCIAL', pageW - 14, 19, { align: 'right' });
    doc.text(`Emision: ${new Date().toLocaleString('es-PE')}`, pageW - 14, 23, { align: 'right' });

    // Divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 28, pageW - 14, 28);

    // 2. Table 1: Historial de Operaciones
    let y = 36;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('HISTORIAL DE OPERACIONES (TICKETS)', 14, y);
    y += 4;

    const opRows = operaciones.map(mov => {
      const totalDinero = mov._totalDinero || 0;
      const totalPagado = mov._totalPagado || 0;
      const porcentaje = totalDinero > 0 ? Math.min(100, Math.round((totalPagado / totalDinero) * 100)) : 100;
      
      let estadoTxt = `PENDIENTE (0%)`;
      if (porcentaje >= 100) {
        estadoTxt = 'CUBIERTOS (100%)';
      } else if (porcentaje > 0) {
        estadoTxt = `PARCIAL (${porcentaje}%)`;
      }

      const fechaOp = mov.fecha
        ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE')
        : '—';

      return [
        fechaOp,
        `"${mov.tipo}"`,
        `S/ ${totalDinero.toFixed(2)}`,
        `S/ ${totalPagado.toFixed(2)}`,
        estadoTxt
      ];
    });

    if (opRows.length === 0) {
      opRows.push(['No hay datos registrados para este periodo', '', '', '', '']);
    }

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Operacion', 'Monto Total', 'Monto Cubierto', 'Estado']],
      body: opRows,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    let finalY = doc.lastAutoTable.finalY || y + 10;

    // 3. Table 2: Historial de Abonos
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('HISTORIAL DE ABONOS', 14, finalY + 10);

    const getMetodoLabel = (m) => {
      if (m === 'yape') return 'Yape';
      if (m === 'deposito') return 'Deposito';
      return 'Efectivo';
    };

    const abonoRows = abonos.map(p => {
      const fechaAbono = p.fecha
        ? new Date(p.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE')
        : '—';
      return [
        fechaAbono,
        getMetodoLabel(p.metodo),
        p.nota || '—',
        `S/ ${(p.monto || 0).toFixed(2)}`
      ];
    });

    if (abonoRows.length === 0) {
      abonoRows.push(['No hay datos registrados para este periodo', '', '', '']);
    }

    autoTable(doc, {
      startY: finalY + 15,
      head: [['Fecha', 'Metodo de Pago', 'Destino / Nota', 'Monto Abonado']],
      body: abonoRows,
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    let finalY2 = doc.lastAutoTable.finalY || finalY + 25;

    // 4. Highlighted Debt Recuadro
    y = finalY2 + 12;
    
    // Draw outer rect border
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, pageW - 28, 22, 'FD');

    // Content text logic
    const rectTitle = isCompraFlow ? 'DEUDA NUESTRA (POR PAGAR)' : 'TOTAL DEUDA DEL CLIENTE';
    const rectSub = isCompraFlow
      ? `Se le debe a ${socio.nombre} a la fecha:`
      : `${socio.nombre} debe a la fecha:`;

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(rectTitle, 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(rectSub, 18, y + 14);

    // Large bold amount
    doc.setTextColor(isCompraFlow ? 37 : 225, isCompraFlow ? 99 : 68, isCompraFlow ? 235 : 68); // blue for purchase, red/rose for client
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`S/ ${deudaNeta.toFixed(2)}`, pageW - 20, y + 13, { align: 'right' });

    // 5. Download Trigger
    const cleanSocioName = socio.nombre.replace(/\s+/g, '_');
    const cleanDate = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    doc.save(`Estado_Cuenta_${cleanSocioName}_${cleanDate}.pdf`);
  };

  return (
    <div className="flex flex-col h-[100dvh]" style={{ background: '#060B16', fontFamily: FONT }}>
      
      {/* ═══ FIXED HEADER ═══ */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-5 pb-3 bg-[#080E1A]/80 backdrop-blur-md border-b border-white/5 z-50">
        <button
          onClick={() => navigate('/reportes')}
          className="p-2 rounded-xl text-slate-400 hover:text-white active:scale-95 transition-all bg-white/5 border border-white/10"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-white text-sm font-black tracking-tight">Estado de Cuenta</span>
        <button
          className="p-2 rounded-xl text-slate-400 hover:text-white active:scale-95 transition-all bg-white/5 border border-white/10"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4">
        
        {/* ── COMPACT & SIMPLE HERO CARD (SCROLLS WITH THE PAGE) ── */}
        {socio && (
          <div
            className="p-4 rounded-2xl relative overflow-hidden"
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              border: `1px solid rgba(255, 255, 255, 0.06)`,
              boxShadow: `inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{ background: `${accentColor}12`, color: accentColor, border: `1px solid ${accentColor}25` }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate">{socio.nombre}</p>
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                  {esVenta ? 'Cliente' : esCompra ? 'Proveedor' : 'Socio Comercial'}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t border-white/5 pt-3">
              <span className="text-slate-500 text-[10px] uppercase tracking-wider font-bold">{labelDeuda}</span>
              <span className="font-mono font-black text-2xl" style={{ color: accentColor }}>
                S/ {deudaNeta.toFixed(2)}
              </span>
            </div>
            
            <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
              <span>{operaciones.length} operaciones registradas</span>
              <span>{abonos.length} abonos</span>
            </div>
          </div>
        )}

        {/* ── SECCIÓN A: OPERACIONES ── */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-3 rounded-full" style={{ background: accentColor }} />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Historial de Operaciones</p>
            <span className="text-slate-600 text-[10px] font-mono ml-auto">{operaciones.length}</span>
          </div>

          {operaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-white/5 border border-white/5">
              <p className="text-slate-500 text-xs">Sin operaciones</p>
            </div>
          ) : (
            <div className="space-y-2">
              {operaciones.map(mov => {
                const totalDinero = mov._totalDinero || 0;
                const totalPagado = mov._totalPagado || 0;
                const porcentaje = totalDinero > 0 ? Math.min(100, Math.round((totalPagado / totalDinero) * 100)) : 100;

                let barColor, labelColor, labelText;
                if (porcentaje >= 100) {
                  barColor = '#10b981';
                  labelColor = '#34d399';
                  labelText = 'Cubierto';
                } else if (porcentaje > 0) {
                  barColor = '#f59e0b';
                  labelColor = '#fbbf24';
                  labelText = `Parcial ${porcentaje}%`;
                } else {
                  barColor = '#f43f5e';
                  labelColor = '#fb7185';
                  labelText = 'Pendiente';
                }

                const fechaOp = mov.fecha
                  ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '';
                const esCompraOp = mov.tipo === 'compra';
                const esTransbordo = mov.es_transbordo === 1;
                const tipoLabel = esTransbordo ? 'Transbordo' : (esCompraOp ? 'Compra' : 'Venta');
                const tipoBg = esTransbordo ? 'rgba(245,158,11,0.12)' : (esCompraOp ? 'rgba(59,130,246,0.12)' : 'rgba(16,185,129,0.12)');
                const tipoColor = esTransbordo ? '#fbbf24' : (esCompraOp ? '#60a5fa' : '#34d399');

                return (
                  <div
                    key={mov.id_movimiento}
                    className="rounded-xl overflow-hidden bg-white/5 border border-white/5"
                    style={{ borderLeft: `3px solid ${barColor}` }}
                  >
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white text-xs font-semibold">{fechaOp}</span>
                          <span
                            className="text-[8px] font-bold px-1 py-0.5 rounded uppercase"
                            style={{ background: tipoBg, color: tipoColor }}
                          >
                            {tipoLabel}
                          </span>
                        </div>
                        <span className="font-mono text-sm font-bold text-white">
                          S/ {totalDinero.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(porcentaje, 1)}%`, backgroundColor: barColor }}
                            />
                          </div>
                        </div>
                        <span className="text-[8px] font-black uppercase" style={{ color: labelColor }}>
                          {labelText}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECCIÓN B: ABONOS ── */}
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-3 rounded-full bg-emerald-500" />
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{tituloAbonos}</p>
            <span className="text-slate-600 text-[10px] font-mono ml-auto">{abonos.length}</span>
          </div>

          {abonos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 rounded-xl bg-white/5 border border-white/5">
              <p className="text-slate-500 text-xs">Sin abonos registrados</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {abonos.map(p => {
                const fechaAbono = p.fecha
                  ? new Date(p.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '';
                const metodo = getMetodoInfo(p.metodo);
                return (
                  <div
                    key={p.id_pago}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: metodo.bg, border: `1px solid ${metodo.color}20` }}
                    >
                      {metodo.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold">{fechaAbono}</p>
                      <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: metodo.color }}>{metodo.label}</p>
                    </div>
                    <span className="text-emerald-400 font-mono text-xs font-bold">
                      S/ {(p.monto || 0).toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ═══ STICKY FOOTER ═══ */}
      <div
        className="fixed bottom-0 left-0 w-full flex gap-2 p-4 z-50"
        style={{
          background: 'linear-gradient(180deg, rgba(6,11,22,0) 0%, rgba(6,11,22,0.95) 20%, rgba(6,11,22,0.99) 100%)',
          backdropFilter: 'blur(16px)',
          paddingTop: '1.5rem',
        }}
      >
        <button
          className="flex-[5] py-3 rounded-xl text-[11px] font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(99,102,241,0.15))',
            border: '1px solid rgba(99,102,241,0.35)',
            color: '#a5b4fc',
            boxShadow: '0 2px 12px rgba(99,102,241,0.1)',
          }}
          onClick={() => setShowAbonoModal(true)}
        >
          {labelRapido}
        </button>
        <button
          className="flex-[5] py-3 rounded-xl text-[11px] font-bold transition-all active:scale-[0.97] flex items-center justify-center gap-1.5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
          onClick={() => setShowLiquidarModal(true)}
        >
          ⚖️ Liquidar
        </button>
        <button
          className="flex-[2] py-3 rounded-xl text-[11px] font-bold transition-all active:scale-[0.97] flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
          onClick={generarPdfEstadoCuenta}
        >
          📄
        </button>
      </div>

      {showAbonoModal && socio && (
        <AbonoRapidoModal
          socio={socio}
          isCompra={isCompraFlow}
          onClose={() => setShowAbonoModal(false)}
          onSave={handleSaveAbono}
        />
      )}

      {showLiquidarModal && socio && (
        <LiquidarConsolidadoModal
          socio={socio}
          movsSocio={enrichedMovs}
          isCompra={isCompraFlow}
          onClose={() => setShowLiquidarModal(false)}
          onSave={handleLiquidarSave}
        />
      )}

    </div>
  );
}

/* ── AbonoRapidoModal Component ── */
function AbonoRapidoModal({ socio, isCompra, onClose, onSave }) {
  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()), []);
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [fecha, setFecha] = useState(today);
  const [destino, setDestino] = useState('');
  const [nota, setNota] = useState('');

  const submit = () => {
    const val = parseFloat(monto);
    if (isNaN(val) || val <= 0) return;
    onSave(val, metodo, fecha, destino, nota);
  };

  const actionLabel = isCompra ? 'Pagar' : 'Cobrar';
  const buttonColor = isCompra ? 'bg-blue-600 shadow-blue-600/25' : 'bg-emerald-600 shadow-emerald-600/25';

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl flex flex-col pb-8 z-10" style={{ background: '#131A26', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Mobile handle */}
        <div className="flex justify-center pt-2.5 sm:hidden"><div className="w-8 h-1 rounded-full bg-slate-700" /></div>
        
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex justify-between items-start">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight uppercase sm:text-base">
              {isCompra ? 'Registrar pago' : 'Registrar cobro'}
            </h3>
            <p className="text-slate-500 text-xs mt-0.5 font-bold tracking-wide">
              {socio.nombre} · <span className="opacity-70">sin operación asociada</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-5 pt-2 space-y-4">
          
          {/* Method Tabs */}
          <div className="flex gap-2">
            {[
              { k: 'efectivo', label: '💵 Efectivo', icon: Banknote },
              { k: 'yape', label: '📱 Yape', icon: CreditCard },
              { k: 'deposito', label: '🏦 Depósito', icon: Landmark }
            ].map(tab => {
              const Icon = tab.icon;
              const active = metodo === tab.k;
              return (
                <button
                  key={tab.k}
                  onClick={() => setMetodo(tab.k)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all border outline-none"
                  style={{
                    background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)',
                    border: active ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.06)',
                    color: active ? '#a5b4fc' : '#94a3b8'
                  }}
                >
                  <Icon size={13} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* Amount & Date Picker */}
          <div className="flex gap-3">
            {/* Amount */}
            <div className="flex-[2] relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold pointer-events-none font-mono">S/</div>
              <input
                type="number"
                placeholder="0.00"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                className="w-full pl-9 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-mono font-bold text-sm outline-none focus:border-indigo-500/50"
              />
            </div>
            
            {/* Date */}
            <div className="flex-[1.5] relative">
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full pl-3 pr-3 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-bold outline-none focus:border-indigo-500/50"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Destino Input */}
          <div>
            <input
              type="text"
              placeholder="Destino (opcional) — ej. BCP, Caja Municipal Cusco"
              value={destino}
              onChange={e => setDestino(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-indigo-500/50 placeholder-slate-600 font-medium"
            />
          </div>

          {/* Nota Input */}
          <div>
            <input
              type="text"
              placeholder="Nota (opcional)"
              value={nota}
              onChange={e => setNota(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-indigo-500/50 placeholder-slate-600 font-medium"
            />
          </div>

          {/* Action Button */}
          <button
            onClick={submit}
            disabled={!monto || parseFloat(monto) <= 0}
            className={`w-full py-3.5 rounded-xl font-black text-xs text-white uppercase tracking-wider outline-none active:scale-[0.98] transition-all disabled:opacity-45 ${buttonColor}`}
          >
            {actionLabel}
          </button>

        </div>
      </div>
    </div>
  );
}

/* ── LiquidarConsolidadoModal Component ── */
function LiquidarConsolidadoModal({ socio, movsSocio, isCompra, onClose, onSave }) {
  const [selectedIds, setSelectedIds] = useState([]);

  const pendingMovs = useMemo(() => {
    return movsSocio.filter(m => m._saldo > 0).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [movsSocio]);

  // Compute total selected sum
  const totalMarcado = useMemo(() => {
    return pendingMovs
      .filter(m => selectedIds.includes(m.id_movimiento))
      .reduce((sum, m) => sum + m._saldo, 0);
  }, [pendingMovs, selectedIds]);

  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleLiquidar = () => {
    if (selectedIds.length === 0) return;
    onSave(selectedIds);
  };

  const handlePDF = () => {
    if (selectedIds.length === 0) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    
    // Header banner matching primary branding
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 25, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('SISGECO MVP — Reporte de Liquidacion Consolidada', 14, 11);
    
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Fecha Emision: ${new Date().toLocaleDateString('es-PE')}`, 14, 18);
    doc.text(`Socio: ${socio.nombre}`, 14, 22);

    let y = 35;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(isCompra ? 'COMPRAS LIQUIDADAS' : 'VENTAS LIQUIDADAS', 14, y);
    y += 6;

    const rows = pendingMovs
      .filter(m => selectedIds.includes(m.id_movimiento))
      .map((m, idx) => {
        const fechaOp = m.fecha
          ? new Date(m.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : '';
        return [
          `#${idx + 1}`,
          fechaOp,
          m.es_transbordo === 1 ? 'Transbordo' : m.tipo,
          `${m._sacos} sacos`,
          `S/ ${m._saldo.toFixed(2)}`
        ];
      });

    autoTable(doc, {
      startY: y,
      head: [['Ref', 'Fecha', 'Tipo', 'Cantidad', 'Importe Liquidado']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL LIQUIDADO: S/ ${totalMarcado.toFixed(2)}`, 14, finalY);

    doc.save(`liquidacion_${socio.nombre.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  };

  const labelBoton = isCompra ? 'Pagar Operaciones Seleccionadas' : 'Cobrar Operaciones Seleccionadas';
  const accentColor = isCompra ? '#38bdf8' : '#fb7185';
  const indexUnicode = (idx) => {
    const list = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
    return list[idx] || `(${idx + 1})`;
  };

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-[#060B16]" style={{ fontFamily: FONT }}>
      
      {/* HEADER */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-5 pb-3 bg-[#080E1A]/90 backdrop-blur-md border-b border-white/5 z-50">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white active:scale-95 transition-all bg-white/5 border border-white/10"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-white text-sm font-black tracking-tight flex items-center gap-1.5">
          🏛️ Liquidar Consolidado
        </span>
        <div className="px-3 py-1 rounded-xl text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
          {socio.nombre}
        </div>
      </div>

      {/* BODY LIST */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          {isCompra ? 'COMPRAS PENDIENTES' : 'VENTAS PENDIENTES'}
        </p>

        {pendingMovs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-slate-500 text-xs">Sin operaciones pendientes de liquidación</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingMovs.map((mov, idx) => {
              const selected = selectedIds.includes(mov.id_movimiento);
              const fechaOp = mov.fecha
                ? new Date(mov.fecha + 'T12:00:00-05:00').toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
                : '';
              
              return (
                <div
                  key={mov.id_movimiento}
                  onClick={() => toggleSelect(mov.id_movimiento)}
                  className={`rounded-2xl p-4 transition-all duration-200 border cursor-pointer ${
                    selected ? 'bg-white/5 border-white/20' : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Index circle */}
                    <span className="text-xl text-slate-500 font-medium select-none">
                      {indexUnicode(idx)}
                    </span>
                    
                    {/* Date and details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">{fechaOp}</p>
                      <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                        {mov._sacos} sacos · {mov.es_transbordo === 1 ? 'Transbordo' : mov.tipo}
                      </p>
                    </div>

                    {/* Pending balance */}
                    <span className="text-amber-400 font-mono font-bold text-base whitespace-nowrap">
                      S/ {mov._saldo.toFixed(2)}
                    </span>

                    {/* Custom Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all duration-200 ${
                        selected
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                          : 'border-white/20 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STICKY FOOTER */}
      <div
        className="fixed bottom-0 left-0 w-full flex flex-col p-4 gap-3 z-50"
        style={{
          background: 'linear-gradient(180deg, rgba(6,11,22,0) 0%, rgba(6,11,22,0.95) 20%, rgba(6,11,22,0.99) 100%)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Info label */}
        <div className="flex justify-between items-baseline px-1">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Seleccionado:</span>
          <span className="font-mono text-xl font-black text-white">
            S/ {totalMarcado.toFixed(2)}
          </span>
        </div>

        {/* Action Row */}
        <div className="flex gap-2">
          {/* PDF Button */}
          <button
            onClick={handlePDF}
            disabled={selectedIds.length === 0}
            className="flex-1 py-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#cbd5e1'
            }}
          >
            🖨️ Generar PDF
          </button>
          
          {/* Action Button */}
          <button
            onClick={handleLiquidar}
            disabled={selectedIds.length === 0}
            className="flex-[1.5] py-3 rounded-xl text-xs font-bold transition-all active:scale-[0.97] disabled:opacity-40 flex items-center justify-center gap-1.5"
            style={{
              background: `linear-gradient(135deg, ${accentColor}E0, ${accentColor}B0)`,
              color: '#ffffff',
              boxShadow: `0 4px 14px ${accentColor}20`
            }}
          >
            ⚖️ {labelBoton}
          </button>
        </div>
      </div>

    </div>
  );
}
