import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../db/database';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    // Simulate auth logic
    if (username.trim()) {
      localStorage.setItem('isAuth', 'true');
      localStorage.setItem('user', username);
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-emerald-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl pb-10 pt-8 px-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">SisgecoMVP</h1>
          <p className="text-blue-200">v1.0.1</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Usuario</label>
            <input 
              type="text" 
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
              placeholder="Ej. admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-100 mb-2">Contraseña</label>
            <input 
              type="password" 
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transform hover:-translate-y-0.5 transition-all text-lg"
          >
            Iniciar Sesión
          </button>
        </form>

        <p className="mt-8 text-center text-blue-200 text-sm">
          ¿No tienes una cuenta? <br/><Link to="/registro" className="text-emerald-400 font-bold hover:text-emerald-300">Regístrate aquí</Link>
        </p>
      </div>
    </div>
  );
}
