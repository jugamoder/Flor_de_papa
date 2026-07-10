import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col p-4 pb-20">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(-1)} className="p-2 mr-2 bg-white rounded-full shadow-sm hover:bg-gray-100 transition">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Dashboard Financiero</h1>
      </div>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center text-gray-400">
        <p>Los gráficos y métricas se implementarán en la siguiente iteración.</p>
      </div>
    </div>
  );
}
