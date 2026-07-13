import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, SENTINEL_ID, resolveNombreSocio } from '../db/database';
import { useUser } from '../context/UserContext';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Scale,
  Award,
  Users,
  TrendingDown,
  List,
  BarChart3
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const FONT = '"Inter", "SF Pro Display", system-ui, sans-serif';

// Custom Tooltip for Recharts inside Dark Theme
const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#11192E]/95 border border-white/10 p-3 rounded-xl shadow-xl backdrop-blur-md text-[11px]">
        <p className="text-white font-bold mb-1.5">{label}</p>
        {payload.map((item, idx) => {
          let valueText = '';
          if (unit === 'S/ ') {
            valueText = `S/ ${Number(item.value).toFixed(2)}`;
          } else if (unit === ' kg') {
            valueText = `${Number(item.value).toFixed(1)} kg`;
          } else if (unit === ' sacos') {
            valueText = `${Number(item.value)} sacos`;
          } else {
            valueText = `${item.value}${unit}`;
          }
          return (
            <p key={idx} style={{ color: item.color }} className="font-semibold">
              {item.name}: {valueText}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Finanzas() {
  const navigate = useNavigate();
  const { currentUser } = useUser();

  useEffect(() => {
    if (!currentUser || currentUser.rol !== 'Administrador') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  if (!currentUser || currentUser.rol !== 'Administrador') {
    return (
      <div className="min-h-screen bg-[#080E1A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="bg-[#1A2438] border border-white/5 p-8 rounded-3xl max-w-sm space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400 text-lg">⚠️</div>
          <h2 className="text-white font-bold text-base">Acceso Denegado</h2>
          <p className="text-slate-400 text-xs">Esta sección está restringida únicamente para administradores.</p>
        </div>
      </div>
    );
  }

  const [temporalFilter, setTemporalFilter] = useState('semanal'); // 'semanal' | 'mensual' | 'anual'
  
  // Calculate current year and current month in Lima timezone
  const [currentYear, currentMonth] = useMemo(() => {
    const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    return hoyStr.split('-').map(Number);
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Section view modes: 'text' (default) or 'chart'
  const [showKpiChart, setShowKpiChart] = useState(false);
  const [showVarietyChart, setShowVarietyChart] = useState(false);
  const [showSocioChart, setShowSocioChart] = useState(false);
  const [showDeudoresChart, setShowDeudoresChart] = useState(false);
  const [showAcreedoresChart, setShowAcreedoresChart] = useState(false);

  // Sub-metric for comparison chart: 'sacos' | 'kilos' | 'dinero'
  const [kpiMetric, setKpiMetric] = useState('sacos');

  // Tabs inside sections
  const [varietyTab, setVarietyTab] = useState('vendidas'); // 'vendidas' | 'compradas'
  const [socioTab, setSocioTab] = useState('compradores'); // 'compradores' | 'vendedores'

  // Load raw data from Dexie
  const socios = useLiveQuery(() => db.socios.toArray()) || [];
  const variedades = useLiveQuery(() => db.variedades.toArray()) || [];
  const movimientos = useLiveQuery(() => db.movimientos.toArray()) || [];
  const sacos = useLiveQuery(() => db.sacos.toArray()) || [];
  const pagos = useLiveQuery(() => db.transacciones_pago.toArray()) || [];
  const extras = useLiveQuery(() => db.extras.toArray()) || [];

  // Date range helper for query
  const dateRange = useMemo(() => {
    const hoyStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    
    if (temporalFilter === 'semanal') {
      const today = new Date(hoyStr + 'T00:00:00');
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const end = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1);
      return { start, end };
    }
    if (temporalFilter === 'mensual') {
      const start = new Date(Date.UTC(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(selectedYear, selectedMonth, 0, 23, 59, 59, 999));
      return { start, end };
    }
    // 'anual'
    const start = new Date(Date.UTC(selectedYear, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));
    return { start, end };
  }, [temporalFilter, selectedMonth, selectedYear]);

  // Date and filter helper variables
  const calculations = useMemo(() => {
    if (!movimientos.length && !sacos.length && !pagos.length && !extras.length) {
      return {
        sales: { sacos: 0, kilos: 0, dinero: 0 },
        purchases: { sacos: 0, kilos: 0, dinero: 0 },
        diff: { sacos: 0, kilos: 0, dinero: 0 },
        topVarSales: [],
        topVarPurchases: [],
        topBuyers: [],
        topSellers: [],
        cobrosPendientesHistorico: 0,
        pagosPendientesHistorico: 0,
        topDeudores: [],
        topAcreedores: [],
        timeSeriesData: []
      };
    }

    const startIsoStr = dateRange.start.toISOString().split('T')[0];
    const endIsoStr = dateRange.end.toISOString().split('T')[0];

    // Build Maps
    const variedadesMap = Object.fromEntries(variedades.map(v => [v.id_variedad, v]));
    const socioMap = Object.fromEntries(socios.map(s => [s.id_socio, s]));

    // Grouping child records to avoid O(N * M) inside loop
    const sacosByMov = {};
    for (const s of sacos) {
      const key = s.uuid_movimiento || String(s.id_movimiento || '');
      if (!sacosByMov[key]) sacosByMov[key] = [];
      sacosByMov[key].push(s);
    }

    const extrasByMov = {};
    for (const e of extras) {
      const key = e.id_movimiento;
      if (!extrasByMov[key]) extrasByMov[key] = [];
      extrasByMov[key].push(e);
    }

    const pagosByMov = {};
    for (const p of pagos) {
      const key = p.id_movimiento;
      if (key) {
        if (!pagosByMov[key]) pagosByMov[key] = [];
        pagosByMov[key].push(p);
      }
    }

    // Enrich movements
    const enrichedMovs = movimientos.map(mov => {
      const sx = sacosByMov[mov.uuid] || [];
      const exs = extrasByMov[mov.uuid] || [];
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

      const adicionales = mov.adicionales || [];
      const totalAdicionales = adicionales.reduce((acc, a) => a.tipo === 'suma' ? acc + a.monto : acc - a.monto, 0);

      const fleteActivo = mov.flete_activo === 1;
      const fleteMonto = fleteActivo ? (mov.flete_monto_total || 0) : 0;
      const fleteNeto = mov.flete_tipo_signo === 'RESTAR' ? -fleteMonto : fleteMonto;

      const montoNeto = mov.monto_neto_final != null
        ? mov.monto_neto_final
        : subtotalDinero - totalExtras + totalAdicionales + fleteNeto;

      const movementPagos = pagosByMov[mov.uuid] || [];
      const totalPagado = movementPagos.reduce((a, p) => a + (p.monto || 0), 0);
      const saldo = Math.max(0, montoNeto - totalPagado);

      return {
        ...mov,
        _sacos: sx.length,
        _totalPeso: totalPeso,
        _totalDinero: montoNeto,
        _totalPagado: totalPagado,
        _saldo: saldo,
        _varSacosKilos: varIds.map(vid => {
          const sxVar = sx.filter(s => s.id_variedad === vid);
          const bruto = sxVar.reduce((a, s) => a + s.peso, 0);
          const info = mov.variedades?.[vid] || {};
          const tipo = info.tipo_ajuste || 'NINGUNO';
          const kilos = info.kilos_ajuste || 0;
          const neto = tipo === 'RESTAR' ? Math.max(0, bruto - kilos) : (tipo === 'SUMAR' ? bruto + kilos : bruto);
          return { id_variedad: vid, sacos: sxVar.length, kilos: neto };
        })
      };
    });

    // 1. FILTER BY TEMPORAL SELECTOR (only movements with at least 1 saco)
    const filteredMovs = enrichedMovs.filter(m => m._sacos >= 1 && m.fecha >= startIsoStr && m.fecha <= endIsoStr);

    // 2. VENTAS METRICS
    const salesMovs = filteredMovs.filter(m => m.tipo === 'venta');
    const salesSacos = salesMovs.reduce((acc, m) => acc + m._sacos, 0);
    const salesKilos = salesMovs.reduce((acc, m) => acc + m._totalPeso, 0);
    const salesDinero = salesMovs.reduce((acc, m) => acc + m._totalDinero, 0);

    // 3. COMPRAS METRICS
    const purchaseMovs = filteredMovs.filter(m => m.tipo === 'compra');
    const purchaseSacos = purchaseMovs.reduce((acc, m) => acc + m._sacos, 0);
    const purchaseKilos = purchaseMovs.reduce((acc, m) => acc + m._totalPeso, 0);
    const purchaseDinero = purchaseMovs.reduce((acc, m) => acc + m._totalDinero, 0);

    // 4. DIFFERENCE
    const diffSacos = salesSacos - purchaseSacos;
    const diffKilos = salesKilos - purchaseKilos;
    const diffDinero = salesDinero - purchaseDinero;

    // 5. TOP 5 VARIETIES
    // Sales
    const varSales = {};
    salesMovs.forEach(m => {
      m._varSacosKilos.forEach(item => {
        if (!varSales[item.id_variedad]) {
          varSales[item.id_variedad] = { sacos: 0, kilos: 0 };
        }
        varSales[item.id_variedad].sacos += item.sacos;
        varSales[item.id_variedad].kilos += item.kilos;
      });
    });
    const topVarSales = Object.entries(varSales).map(([id, info]) => ({
      id_variedad: id,
      nombre: variedadesMap[id]?.nombre || `Variedad ${id}`,
      codigo_corto: variedadesMap[id]?.codigo_corto || '—',
      sacos: info.sacos,
      kilos: info.kilos
    })).sort((a, b) => b.sacos - a.sacos).slice(0, 5);

    // Purchases
    const varPurchases = {};
    purchaseMovs.forEach(m => {
      m._varSacosKilos.forEach(item => {
        if (!varPurchases[item.id_variedad]) {
          varPurchases[item.id_variedad] = { sacos: 0, kilos: 0 };
        }
        varPurchases[item.id_variedad].sacos += item.sacos;
        varPurchases[item.id_variedad].kilos += item.kilos;
      });
    });
    const topVarPurchases = Object.entries(varPurchases).map(([id, info]) => ({
      id_variedad: id,
      nombre: variedadesMap[id]?.nombre || `Variedad ${id}`,
      codigo_corto: variedadesMap[id]?.codigo_corto || '—',
      sacos: info.sacos,
      kilos: info.kilos
    })).sort((a, b) => b.sacos - a.sacos).slice(0, 5);

    // 6. TOP 5 PARTNERS
    // Buyers
    const buyers = {};
    salesMovs.forEach(m => {
      const key = m.id_socio;
      if (!buyers[key]) {
        buyers[key] = { dinero: 0, peso: 0, sacos: 0, id_socio: key, nombre: resolveNombreSocio(m, socioMap) };
      }
      buyers[key].dinero += m._totalDinero;
      buyers[key].peso += m._totalPeso;
      buyers[key].sacos += m._sacos;
    });
    const topBuyers = Object.values(buyers).sort((a, b) => b.dinero - a.dinero).slice(0, 5);

    // Sellers
    const sellers = {};
    purchaseMovs.forEach(m => {
      const key = m.id_socio;
      if (!sellers[key]) {
        sellers[key] = { dinero: 0, peso: 0, sacos: 0, id_socio: key, nombre: resolveNombreSocio(m, socioMap) };
      }
      sellers[key].dinero += m._totalDinero;
      sellers[key].peso += m._totalPeso;
      sellers[key].sacos += m._sacos;
    });
    const topSellers = Object.values(sellers).sort((a, b) => b.dinero - a.dinero).slice(0, 5);

    // 7. HISTORICAL DEBT BALANCE (Global)
    const cobrosPendientesHistorico = enrichedMovs
      .filter(m => m.tipo === 'venta' && m._sacos >= 1)
      .reduce((acc, m) => acc + m._saldo, 0);

    const pagosPendientesHistorico = enrichedMovs
      .filter(m => m.tipo === 'compra' && m._sacos >= 1)
      .reduce((acc, m) => acc + m._saldo, 0);

    // 8. DEBTORS AND CREDITORS RANKINGS (Historical)
    const deudores = {};
    enrichedMovs.filter(m => m.tipo === 'venta' && m._sacos >= 1).forEach(m => {
      const key = m.id_socio;
      if (!deudores[key]) {
        deudores[key] = { id_socio: key, nombre: resolveNombreSocio(m, socioMap), saldo: 0 };
      }
      deudores[key].saldo += m._saldo;
    });
    const topDeudores = Object.values(deudores)
      .filter(d => d.saldo > 0.01)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5);

    const acreedores = {};
    enrichedMovs.filter(m => m.tipo === 'compra' && m._sacos >= 1).forEach(m => {
      const key = m.id_socio;
      if (!acreedores[key]) {
        acreedores[key] = { id_socio: key, nombre: resolveNombreSocio(m, socioMap), saldo: 0 };
      }
      acreedores[key].saldo += m._saldo;
    });
    const topAcreedores = Object.values(acreedores)
      .filter(a => a.saldo > 0.01)
      .sort((a, b) => b.saldo - a.saldo)
      .slice(0, 5);

    // 9. TIME SERIES GENERATOR FOR GROUPED BAR CHART
    let timeSeriesData = [];
    if (temporalFilter === 'semanal') {
      const list = [];
      const endMs = dateRange.end.getTime();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(endMs - i * 24 * 60 * 60 * 1000);
        const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);
        const label = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', timeZone: 'America/Lima' });
        list.push({ dateStr, label });
      }

      timeSeriesData = list.map(item => {
        const dayMovs = enrichedMovs.filter(m => m.fecha === item.dateStr && m._sacos >= 1);
        const sales = dayMovs.filter(m => m.tipo === 'venta');
        const purchases = dayMovs.filter(m => m.tipo === 'compra');

        return {
          name: item.label,
          Ventas: sales,
          Compras: purchases
        };
      });
    } else if (temporalFilter === 'mensual') {
      const numDays = new Date(selectedYear, selectedMonth, 0).getDate();
      const list = [];
      for (let i = 1; i <= numDays; i++) {
        const dayStr = String(i).padStart(2, '0');
        const monthStr = String(selectedMonth).padStart(2, '0');
        const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
        list.push({ dateStr, label: `${i}` });
      }

      timeSeriesData = list.map(item => {
        const dayMovs = enrichedMovs.filter(m => m.fecha === item.dateStr && m._sacos >= 1);
        const sales = dayMovs.filter(m => m.tipo === 'venta');
        const purchases = dayMovs.filter(m => m.tipo === 'compra');

        return {
          name: item.label,
          Ventas: sales,
          Compras: purchases
        };
      });
    } else if (temporalFilter === 'anual') {
      const months = [
        { num: 1, label: 'Ene' }, { num: 2, label: 'Feb' }, { num: 3, label: 'Mar' },
        { num: 4, label: 'Abr' }, { num: 5, label: 'May' }, { num: 6, label: 'Jun' },
        { num: 7, label: 'Jul' }, { num: 8, label: 'Ago' }, { num: 9, label: 'Sep' },
        { num: 10, label: 'Oct' }, { num: 11, label: 'Nov' }, { num: 12, label: 'Dic' }
      ];

      timeSeriesData = months.map(mItem => {
        const monthMovs = enrichedMovs.filter(m => {
          if (!m.fecha || m._sacos < 1) return false;
          const [y, mVal] = m.fecha.split('-').map(Number);
          return y === selectedYear && mVal === mItem.num;
        });

        const sales = monthMovs.filter(m => m.tipo === 'venta');
        const purchases = monthMovs.filter(m => m.tipo === 'compra');

        return {
          name: mItem.label,
          Ventas: sales,
          Compras: purchases
        };
      });
    }

    return {
      sales: { sacos: salesSacos, kilos: salesKilos, dinero: salesDinero },
      purchases: { sacos: purchaseSacos, kilos: purchaseKilos, dinero: purchaseDinero },
      diff: { sacos: diffSacos, kilos: diffKilos, dinero: diffDinero },
      topVarSales,
      topVarPurchases,
      topBuyers,
      topSellers,
      cobrosPendientesHistorico,
      pagosPendientesHistorico,
      topDeudores,
      topAcreedores,
      timeSeriesData
    };
  }, [movimientos, sacos, pagos, extras, socios, variedades, dateRange, selectedMonth, selectedYear, temporalFilter]);

  const {
    sales,
    purchases,
    diff,
    topVarSales,
    topVarPurchases,
    topBuyers,
    topSellers,
    cobrosPendientesHistorico,
    pagosPendientesHistorico,
    topDeudores,
    topAcreedores,
    timeSeriesData
  } = calculations;

  // Render processed data for grouped KPI chart based on selected metric
  const kpiChartData = useMemo(() => {
    return timeSeriesData.map(item => {
      const getSum = (movList) => {
        if (kpiMetric === 'sacos') {
          return movList.reduce((acc, m) => acc + m._sacos, 0);
        } else if (kpiMetric === 'kilos') {
          return movList.reduce((acc, m) => acc + m._totalPeso, 0);
        } else {
          return movList.reduce((acc, m) => acc + m._totalDinero, 0);
        }
      };

      return {
        name: item.name,
        Ventas: getSum(item.Ventas),
        Compras: getSum(item.Compras)
      };
    });
  }, [timeSeriesData, kpiMetric]);

  // Debt Balance calculation
  const totalDebts = cobrosPendientesHistorico + pagosPendientesHistorico;
  const percentCobrar = totalDebts > 0 ? (cobrosPendientesHistorico / totalDebts) * 100 : 50;
  const percentPagar = totalDebts > 0 ? (pagosPendientesHistorico / totalDebts) * 100 : 50;

  // Horizontal rankings data mappings (reversing for rendering highest rank first from top to bottom)
  const varietyChartData = useMemo(() => {
    const list = varietyTab === 'vendidas' ? topVarSales : topVarPurchases;
    return list.map(v => ({ name: v.nombre, value: v.sacos, kilos: v.kilos })).reverse();
  }, [topVarSales, topVarPurchases, varietyTab]);

  const socioChartData = useMemo(() => {
    const list = socioTab === 'compradores' ? topBuyers : topSellers;
    return list.map(s => ({ name: s.nombre, value: s.dinero, peso: s.peso, sacos: s.sacos })).reverse();
  }, [topBuyers, topSellers, socioTab]);

  const deudoresChartData = useMemo(() => {
    return topDeudores.map(d => ({ name: d.nombre, value: d.saldo })).reverse();
  }, [topDeudores]);

  const acreedoresChartData = useMemo(() => {
    return topAcreedores.map(a => ({ name: a.nombre, value: a.saldo })).reverse();
  }, [topAcreedores]);

  // Balance formatting helper for text row list
  const renderBalanceRow = (label, diffValue, type = 'sacos') => {
    const isPositive = diffValue > 0;
    const isNegative = diffValue < 0;
    const sign = isPositive ? '+' : '';
    
    let colorClass = 'text-slate-400';
    if (isPositive) colorClass = 'text-emerald-400';
    if (isNegative) colorClass = 'text-rose-500';

    let formattedVal = '';
    if (type === 'dinero') {
      formattedVal = isPositive
        ? `+S/ ${diffValue.toFixed(2)}`
        : isNegative
        ? `-S/ ${Math.abs(diffValue).toFixed(2)}`
        : `S/ 0.00`;
    } else if (type === 'kilos') {
      formattedVal = isPositive
        ? `+${diffValue.toFixed(1)} kg`
        : isNegative
        ? `-${Math.abs(diffValue).toFixed(1)} kg`
        : `0.0 kg`;
    } else {
      formattedVal = isPositive
        ? `+${diffValue} sacos`
        : isNegative
        ? `-${Math.abs(diffValue)} sacos`
        : `0 sacos`;
    }

    return (
      <div className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
        <span className="text-slate-400 text-xs font-medium">{label}</span>
        <span className={`font-mono text-sm font-black ${colorClass}`}>
          {formattedVal}
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#080E1A] text-slate-100 p-4 pb-24 flex flex-col" style={{ fontFamily: FONT }}>
      
      {/* ── HEADER & TEMPORAL FILTERS ── */}
      <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-2">
        <div className="flex items-center space-x-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Finanzas</h1>
            <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mt-1 flex items-center gap-1">
              <TrendingUp size={12} className="text-blue-400" />
              Inteligencia Comercial
            </p>
          </div>
        </div>

        {/* Temporal Filters Group */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Buttons: Semanal, Mensual, Anual */}
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/8">
            {['semanal', 'mensual', 'anual'].map((t) => (
              <button
                key={t}
                onClick={() => setTemporalFilter(t)}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition-all capitalize ${
                  temporalFilter === t
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Contextual Selects */}
          {temporalFilter === 'mensual' && (
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value={1} className="bg-[#11192E] text-white">Enero</option>
                <option value={2} className="bg-[#11192E] text-white">Febrero</option>
                <option value={3} className="bg-[#11192E] text-white">Marzo</option>
                <option value={4} className="bg-[#11192E] text-white">Abril</option>
                <option value={5} className="bg-[#11192E] text-white">Mayo</option>
                <option value={6} className="bg-[#11192E] text-white">Junio</option>
                <option value={7} className="bg-[#11192E] text-white">Julio</option>
                <option value={8} className="bg-[#11192E] text-white">Agosto</option>
                <option value={9} className="bg-[#11192E] text-white">Septiembre</option>
                <option value={10} className="bg-[#11192E] text-white">Octubre</option>
                <option value={11} className="bg-[#11192E] text-white">Noviembre</option>
                <option value={12} className="bg-[#11192E] text-white">Diciembre</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer"
              >
                <option value={2024} className="bg-[#11192E] text-white">2024</option>
                <option value={2025} className="bg-[#11192E] text-white">2025</option>
                <option value={2026} className="bg-[#11192E] text-white">2026</option>
              </select>
            </div>
          )}

          {temporalFilter === 'anual' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/50 cursor-pointer"
            >
              <option value={2024} className="bg-[#11192E] text-white">2024</option>
              <option value={2025} className="bg-[#11192E] text-white">2025</option>
              <option value={2026} className="bg-[#11192E] text-white">2026</option>
            </select>
          )}
        </div>
      </div>

      {/* ── KPI SECTION HEADER WITH TOGGLE ── */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Resumen Financiero</h3>
        <button 
          onClick={() => setShowKpiChart(!showKpiChart)} 
          className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 text-slate-400 hover:text-white transition flex items-center gap-1.5 text-[11px] font-bold"
        >
          {showKpiChart ? <List size={14} /> : <BarChart3 size={14} />}
          <span>{showKpiChart ? 'Ver Tarjetas' : 'Ver Gráfico'}</span>
        </button>
      </div>

      {/* ── KPI AREA ── */}
      {!showKpiChart ? (
        /* Text view: KPI Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          
          {/* Card A: Total Ventas */}
          <div className="bg-[#11192E] p-4 rounded-2xl border border-white/8 relative overflow-hidden shadow-xl shadow-black/30">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
            <h2 className="text-white font-black text-sm flex items-center gap-2 mb-4">
              📈 Total Ventas
            </h2>
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-xs font-medium">Sacos vendidos</span>
                <span className="font-mono text-lg font-black text-white">{sales.sacos.toLocaleString('es-PE')}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-xs font-medium">Kilos totales</span>
                <span className="font-mono text-lg font-black text-white">{sales.kilos.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                <span className="text-emerald-400 text-xs font-bold">Total Facturado</span>
                <span className="font-mono text-xl font-black text-emerald-400">S/ {sales.dinero.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Card B: Total Compras */}
          <div className="bg-[#11192E] p-4 rounded-2xl border border-white/8 relative overflow-hidden shadow-xl shadow-black/30">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
            <h2 className="text-white font-black text-sm flex items-center gap-2 mb-4">
              📉 Total Compras
            </h2>
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-xs font-medium">Sacos comprados</span>
                <span className="font-mono text-lg font-black text-white">{purchases.sacos.toLocaleString('es-PE')}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400 text-xs font-medium">Kilos totales</span>
                <span className="font-mono text-lg font-black text-white">{purchases.kilos.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                <span className="text-rose-400 text-xs font-bold">Total Invertido</span>
                <span className="font-mono text-xl font-black text-rose-400">S/ {purchases.dinero.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Card C: Balance de Operación */}
          <div className="bg-[#11192E] p-4 rounded-2xl border border-white/8 relative overflow-hidden shadow-xl shadow-black/30">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500" />
            <h2 className="text-white font-black text-sm flex items-center gap-2 mb-2">
              ⚖️ Balance de Operación
            </h2>
            <div className="flex flex-col">
              {renderBalanceRow('Sacos', diff.sacos, 'sacos')}
              {renderBalanceRow('Kilos', diff.kilos, 'kilos')}
              {renderBalanceRow('Dinero', diff.dinero, 'dinero')}
            </div>
          </div>
        </div>
      ) : (
        /* Chart view: Grouped Bar Chart */
        <div className="bg-[#11192E] p-5 rounded-2xl border border-white/8 shadow-xl shadow-black/30 mb-6 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h4 className="text-white font-bold text-xs">Comparativa Temporal: Ventas vs Compras</h4>
            {/* Sub-metric Selection */}
            <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 max-w-xs self-start text-[10px]">
              {['sacos', 'kilos', 'dinero'].map((m) => (
                <button
                  key={m}
                  onClick={() => setKpiMetric(m)}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all capitalize ${
                    kpiMetric === m
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m === 'dinero' ? 'Montos (S/)' : m}
                </button>
              ))}
            </div>
          </div>

          <div className="w-full">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={kpiChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  content={<CustomTooltip unit={kpiMetric === 'dinero' ? 'S/ ' : kpiMetric === 'kilos' ? ' kg' : ' sacos'} />} 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <Bar name="Ventas (Ingresos)" dataKey="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar name="Compras (Egresos)" dataKey="Compras" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── COMMERCIAL RANKINGS (TOP 5) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Top 5 Variedades */}
        <div className="bg-[#11192E]/60 p-5 rounded-2xl border border-white/8 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Award size={18} className="text-amber-400" />
              Top 5 Variedades
            </h3>
            
            <div className="flex items-center space-x-3">
              {/* Text/Graph Toggle */}
              <button
                onClick={() => setShowVarietyChart(!showVarietyChart)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-white transition"
                title={showVarietyChart ? 'Ver Lista' : 'Ver Gráfico'}
              >
                {showVarietyChart ? <List size={14} /> : <BarChart3 size={14} />}
              </button>

              {/* Tabs */}
              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-[10px]">
                <button
                  onClick={() => setVarietyTab('vendidas')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    varietyTab === 'vendidas' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Más Vendidas
                </button>
                <button
                  onClick={() => setVarietyTab('compradas')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    varietyTab === 'compradas' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Más Compradas
                </button>
              </div>
            </div>
          </div>

          {!showVarietyChart ? (
            /* List mode */
            <div className="space-y-2">
              {varietyTab === 'vendidas' ? (
                topVarSales.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-xs">Sin registros de ventas en este periodo</p>
                ) : (
                  topVarSales.map((v, idx) => (
                    <div key={v.id_variedad} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                      <div className="flex items-center space-x-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-amber-400/20 text-amber-300' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : 'bg-slate-700/20 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white text-xs font-semibold">{v.nombre}</span>
                        {v.codigo_corto && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono uppercase">{v.codigo_corto}</span>}
                      </div>
                      <span className="font-mono text-xs text-slate-300">
                        {v.sacos} sacos / {v.kilos.toFixed(0)} kg
                      </span>
                    </div>
                  ))
                )
              ) : (
                topVarPurchases.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-xs">Sin registros de compras en este periodo</p>
                ) : (
                  topVarPurchases.map((v, idx) => (
                    <div key={v.id_variedad} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                      <div className="flex items-center space-x-3">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-amber-400/20 text-amber-300' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : 'bg-slate-700/20 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white text-xs font-semibold">{v.nombre}</span>
                        {v.codigo_corto && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded font-mono uppercase">{v.codigo_corto}</span>}
                      </div>
                      <span className="font-mono text-xs text-slate-300">
                        {v.sacos} sacos / {v.kilos.toFixed(0)} kg
                      </span>
                    </div>
                  ))
                )
              )}
            </div>
          ) : (
            /* Graph mode (Horizontal Bar Chart) */
            <div className="w-full">
              {varietyChartData.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">Sin registros para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={varietyChartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip unit=" sacos" />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar 
                      dataKey="value" 
                      fill={varietyTab === 'vendidas' ? '#10b981' : '#3b82f6'} 
                      radius={[0, 4, 4, 0]} 
                      name="Sacos" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Top 5 Socios */}
        <div className="bg-[#11192E]/60 p-5 rounded-2xl border border-white/8 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users size={18} className="text-blue-400" />
              Top 5 Socios
            </h3>
            
            <div className="flex items-center space-x-3">
              {/* Text/Graph Toggle */}
              <button
                onClick={() => setShowSocioChart(!showSocioChart)}
                className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-white transition"
                title={showSocioChart ? 'Ver Lista' : 'Ver Gráfico'}
              >
                {showSocioChart ? <List size={14} /> : <BarChart3 size={14} />}
              </button>

              {/* Tabs */}
              <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/5 text-[10px]">
                <button
                  onClick={() => setSocioTab('compradores')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    socioTab === 'compradores' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Compradores
                </button>
                <button
                  onClick={() => setSocioTab('vendedores')}
                  className={`px-3 py-1 rounded-md font-bold transition-all ${
                    socioTab === 'vendedores' ? 'bg-blue-600 text-white' : 'text-slate-400'
                  }`}
                >
                  Vendedores
                </button>
              </div>
            </div>
          </div>

          {!showSocioChart ? (
            /* List mode */
            <div className="space-y-2">
              {socioTab === 'compradores' ? (
                topBuyers.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-xs">Sin registros de ventas en este periodo</p>
                ) : (
                  topBuyers.map((s, idx) => (
                    <div key={s.id_socio} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          idx === 0 ? 'bg-amber-400/20 text-amber-300' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : 'bg-slate-700/20 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white text-xs font-semibold truncate">{s.nombre}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-xs font-bold text-emerald-400">S/ {s.dinero.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{s.sacos} sacos ({s.peso.toFixed(0)} kg)</p>
                      </div>
                    </div>
                  ))
                )
              ) : (
                topSellers.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-xs">Sin registros de compras en este periodo</p>
                ) : (
                  topSellers.map((s, idx) => (
                    <div key={s.id_socio} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                          idx === 0 ? 'bg-amber-400/20 text-amber-300' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : 'bg-slate-700/20 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="text-white text-xs font-semibold truncate">{s.nombre}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-xs font-bold text-blue-400">S/ {s.dinero.toFixed(2)}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{s.sacos} sacos ({s.peso.toFixed(0)} kg)</p>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          ) : (
            /* Graph mode (Horizontal Bar Chart) */
            <div className="w-full">
              {socioChartData.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">Sin registros para graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={socioChartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip unit="S/ " />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar 
                      dataKey="value" 
                      fill={socioTab === 'compradores' ? '#10b981' : '#3b82f6'} 
                      radius={[0, 4, 4, 0]} 
                      name="Monto" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── HISTORICAL DEBT BALANCE (Cuentas por Cobrar vs por Pagar) ── */}
      <div className="bg-[#11192E] p-5 rounded-2xl border border-white/8 shadow-xl shadow-black/25 mb-6">
        <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
          <Scale size={18} className="text-indigo-400" />
          Balance General de Deudas (Histórico)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-white/5">
            <span className="text-slate-400 text-xs font-medium">Cuentas por Cobrar (Ventas pendientes)</span>
            <p className="font-mono text-xl font-black text-emerald-400 mt-1">S/ {cobrosPendientesHistorico.toFixed(2)}</p>
          </div>
          <div className="bg-slate-900/40 p-3.5 rounded-xl border border-white/5">
            <span className="text-slate-400 text-xs font-medium">Cuentas por Pagar (Debemos a productores)</span>
            <p className="font-mono text-xl font-black text-rose-500 mt-1">S/ {pagosPendientesHistorico.toFixed(2)}</p>
          </div>
        </div>

        {/* Graphical Balance Bar */}
        <div className="space-y-2">
          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-800">
            {totalDebts === 0 ? (
              <div className="w-full bg-slate-700 h-full" />
            ) : (
              <>
                <div style={{ width: `${percentCobrar}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                <div style={{ width: `${percentPagar}%` }} className="bg-rose-500 h-full transition-all duration-500" />
              </>
            )}
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 font-bold">
            <span>Cobros ({totalDebts > 0 ? percentCobrar.toFixed(0) : 50}%)</span>
            <span>Pagos ({totalDebts > 0 ? percentPagar.toFixed(0) : 50}%)</span>
          </div>
        </div>
      </div>

      {/* ── LIQUIDITY & RISK RANKINGS (Top 5 Deudores / Acreedores) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Top 5 Deudores */}
        <div className="bg-[#11192E]/60 p-5 rounded-2xl border border-white/8 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <TrendingDown size={18} className="text-emerald-400" />
              Top 5 Mayores Deudores (Nos deben)
            </h3>
            
            {/* Text/Graph Toggle */}
            <button
              onClick={() => setShowDeudoresChart(!showDeudoresChart)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-white transition"
              title={showDeudoresChart ? 'Ver Lista' : 'Ver Gráfico'}
            >
              {showDeudoresChart ? <List size={14} /> : <BarChart3 size={14} />}
            </button>
          </div>

          {!showDeudoresChart ? (
            /* List mode */
            <div className="space-y-2">
              {topDeudores.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">No hay cuentas pendientes por cobrar</p>
              ) : (
                topDeudores.map((d, idx) => (
                  <button
                    key={d.id_socio}
                    onClick={() => navigate(`/estado-cuenta/${d.id_socio}?tipoFlujo=venta`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5 cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 bg-emerald-500/10 text-emerald-400">
                        {idx + 1}
                      </span>
                      <span className="text-white text-xs font-semibold truncate">{d.nombre}</span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      <span className="font-mono text-xs font-black text-emerald-400">
                        S/ {d.saldo.toFixed(2)}
                      </span>
                      <ChevronRight size={14} className="text-slate-500" />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Graph mode (Horizontal Bar Chart) */
            <div className="w-full">
              {deudoresChartData.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">No hay deudas por graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={deudoresChartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip unit="S/ " />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar 
                      dataKey="value" 
                      fill="#f43f5e" 
                      radius={[0, 4, 4, 0]} 
                      name="Deuda" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Top 5 Acreedores */}
        <div className="bg-[#11192E]/60 p-5 rounded-2xl border border-white/8 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <TrendingDown size={18} className="text-rose-500" />
              Top 5 Mayores Acreedores (Debemos)
            </h3>
            
            {/* Text/Graph Toggle */}
            <button
              onClick={() => setShowAcreedoresChart(!showAcreedoresChart)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-white transition"
              title={showAcreedoresChart ? 'Ver Lista' : 'Ver Gráfico'}
            >
              {showAcreedoresChart ? <List size={14} /> : <BarChart3 size={14} />}
            </button>
          </div>

          {!showAcreedoresChart ? (
            /* List mode */
            <div className="space-y-2">
              {topAcreedores.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">No hay cuentas pendientes por pagar</p>
              ) : (
                topAcreedores.map((a, idx) => (
                  <button
                    key={a.id_socio}
                    onClick={() => navigate(`/estado-cuenta/${a.id_socio}?tipoFlujo=compra`)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/2 border border-white/5 cursor-pointer hover:bg-white/5 active:scale-[0.99] transition-all text-left"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 bg-rose-500/10 text-rose-400">
                        {idx + 1}
                      </span>
                      <span className="text-white text-xs font-semibold truncate">{a.nombre}</span>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      <span className="font-mono text-xs font-black text-rose-400">
                        S/ {a.saldo.toFixed(2)}
                      </span>
                      <ChevronRight size={14} className="text-slate-500" />
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Graph mode (Horizontal Bar Chart) */
            <div className="w-full">
              {acreedoresChartData.length === 0 ? (
                <p className="text-slate-500 text-center py-6 text-xs">No hay deudas por pagar por graficar</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart layout="vertical" data={acreedoresChartData} margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip unit="S/ " />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    <Bar 
                      dataKey="value" 
                      fill="#60a5fa" 
                      radius={[0, 4, 4, 0]} 
                      name="Pendiente" 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
