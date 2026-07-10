import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../db/database';

export default function Registro() {
  const [formData, setFormData] = useState({
    negocio: '',
    nombre: '',
    usuario: '',
    password: '',
    confirm: ''
  });
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if(formData.password !== formData.confirm) {
      alert('Las contraseñas no coinciden');
      return;
    }
    
    // Auto-create Empresa y Usuario
    const empId = await db.empresas.add({ nombre_comercial: formData.negocio });
    await db.usuarios.add({ 
      id_empresa: empId, 
      username: formData.usuario, 
      nombre_completo: formData.nombre 
    });

    alert('Registro exitoso. Inicie sesión.');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-blue-900 to-sky-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-xl pb-8 pt-6 px-8 rounded-3xl shadow-2xl border border-white/20 w-full max-w-md">
        <h2 className="text-3xl font-extrabold text-white mb-6 text-center">Crear cuenta</h2>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <input 
              type="text" 
              placeholder="Nombre de tu negocio"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={formData.negocio}
              onChange={(e) => setFormData({...formData, negocio: e.target.value})}
              required
            />
          </div>
          <div>
            <input 
              type="text" 
              placeholder="Nombre completo"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={formData.nombre}
              onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              required
            />
          </div>
          <div>
            <input 
              type="text" 
              placeholder="Nombre de usuario"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={formData.usuario}
              onChange={(e) => setFormData({...formData, usuario: e.target.value})}
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Contraseña"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="Confirmar contraseña"
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-sky-400"
              value={formData.confirm}
              onChange={(e) => setFormData({...formData, confirm: e.target.value})}
              required
            />
          </div>
          <button 
            type="submit" 
            className="w-full mt-4 bg-sky-500 hover:bg-sky-400 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all text-lg"
          >
            Registrarse
          </button>
        </form>

        <p className="mt-6 text-center text-blue-200 text-sm">
          <Link to="/login" className="text-white font-bold hover:text-sky-300">Volver al inicio de sesión</Link>
        </p>
      </div>
    </div>
  );
}
