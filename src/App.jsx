import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Inicio from './pages/Inicio';
import Socios from './pages/Socios';
import Variedades from './pages/Variedades';
import Finanzas from './pages/Finanzas';
import Reportes from './pages/Reportes';
import CajaChica from './pages/CajaChica';
import Compra from './pages/Compra';
import Venta from './pages/Venta';
import Login from './pages/Login';
import Registro from './pages/Registro';
import RegistrosCompras from './pages/RegistrosCompras';
import RegistrosVentas from './pages/RegistrosVentas';
import EstadoCuenta from './pages/EstadoCuenta';
import Usuarios from './pages/Usuarios';
import { seedSentinelSocio, seedDefaultUsuarios } from './db/database';
import { UserProvider } from './context/UserContext';

function ProtectedRoute({ children }) {
  const isAuth = localStorage.getItem('isAuth') === 'true';
  return isAuth ? children : <Navigate to="/login" />;
}

function Layout({ children }) {
  return (
    <div className="flex flex-col h-screen bg-gray-50 pb-16">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  /* ── Garantiza que el registro centinela SOCIO-OCASIONAL-000 siempre exista ── */
  useEffect(() => {
    seedSentinelSocio();
    seedDefaultUsuarios();
  }, []);

  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />

          {/* Protected Routes con BottomNav */}
          <Route path="/" element={<ProtectedRoute><Layout><Inicio /></Layout></ProtectedRoute>} />
          <Route path="/socios" element={<ProtectedRoute><Layout><Socios /></Layout></ProtectedRoute>} />
          <Route path="/variedades" element={<ProtectedRoute><Layout><Variedades /></Layout></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Layout><Finanzas /></Layout></ProtectedRoute>} />
          <Route path="/reportes" element={<ProtectedRoute><Layout><Reportes /></Layout></ProtectedRoute>} />
          <Route path="/caja-chica" element={<ProtectedRoute><Layout><CajaChica /></Layout></ProtectedRoute>} />

          {/* Operational Views - Sin BottomNav */}
          <Route path="/compra" element={<ProtectedRoute><Compra /></ProtectedRoute>} />
          <Route path="/venta" element={<ProtectedRoute><Venta /></ProtectedRoute>} />
          <Route path="/registros_compras" element={<ProtectedRoute><RegistrosCompras /></ProtectedRoute>} />
          <Route path="/registros_ventas" element={<ProtectedRoute><RegistrosVentas /></ProtectedRoute>} />
          <Route path="/estado-cuenta/:idSocio" element={<ProtectedRoute><EstadoCuenta /></ProtectedRoute>} />
          <Route path="/admin-usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;
