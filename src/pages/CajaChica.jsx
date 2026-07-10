import { Wallet } from 'lucide-react';

const FONT = '"Inter","SF Pro Display",system-ui,sans-serif';

export default function CajaChica() {
  return (
    <div
      className="flex flex-col h-[100dvh] items-center justify-center"
      style={{ background: '#080E1A', fontFamily: FONT }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}
      >
        <Wallet size={28} className="text-indigo-400" />
      </div>
      <h2 className="text-white font-black text-base mb-1">Caja Chica</h2>
      <p className="text-slate-500 text-sm text-center px-8">
        Próximamente: registro de ingresos, gastos y cuadre diario.
      </p>
    </div>
  );
}
