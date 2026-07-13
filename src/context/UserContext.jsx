import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/database';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState({
    id_usuario: 1,
    username: 'admin',
    rol: 'Administrador',
    pin: '1234',
    estado: 'Activo'
  });

  // Load actual seeded admin on mount to get the correct database ID
  useEffect(() => {
    const loadDefaultAdmin = async () => {
      try {
        const admin = await db.usuarios.where('username').equals('admin').first();
        if (admin) {
          setCurrentUser(admin);
        }
      } catch (err) {
        console.warn('[UserSession] No se pudo cargar el administrador de DB:', err);
      }
    };
    loadDefaultAdmin();
  }, []);

  // Sync active user credentials to global variables so Dexie hooks can access them synchronously
  useEffect(() => {
    if (currentUser) {
      window.activeUserId = currentUser.id_usuario;
      window.activeUsername = currentUser.username;
    } else {
      window.activeUserId = null;
      window.activeUsername = null;
    }
  }, [currentUser]);

  return (
    <UserContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
