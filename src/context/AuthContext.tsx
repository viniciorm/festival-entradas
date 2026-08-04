'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

export interface User {
  uid: string;
  name: string;
  email: string;
  picture?: string;
  provider: 'google' | 'password';
  role: 'admin' | 'organizer';
}

interface GoogleJwtPayload {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithGoogleToken: (credential: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (name: string, email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setDemoUser: () => void;
}

// Strict Whitelist of Authorized Emails
const ALLOWED_EMAILS = [
  'marcos.reyes.m@gmail.com',
  'festivalnac.danzadelvientre@gmail.com',
];

const DEFAULT_ADMIN: User = {
  uid: 'admin-001',
  name: 'María Román',
  email: 'festivalnac.danzadelvientre@gmail.com',
  picture: undefined,
  provider: 'password',
  role: 'admin',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session from LocalStorage on mount (and re-validate against whitelist)
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('fdvc_user_2026');
      if (savedUser) {
        const parsed: User = JSON.parse(savedUser);
        if (ALLOWED_EMAILS.includes(parsed.email.toLowerCase())) {
          setUser(parsed);
        } else {
          localStorage.removeItem('fdvc_user_2026');
        }
      }
    } catch (e) {
      console.error('Error loading user session:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save session state
  const saveSession = (userData: User | null) => {
    setUser(userData);
    if (userData) {
      localStorage.setItem('fdvc_user_2026', JSON.stringify(userData));
    } else {
      localStorage.removeItem('fdvc_user_2026');
    }
  };

  // Google Login via JWT Credential with Whitelist Check
  const loginWithGoogleToken = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const decoded = jwtDecode<GoogleJwtPayload>(credential);
      const email = (decoded.email || '').toLowerCase();

      if (!ALLOWED_EMAILS.includes(email)) {
        return {
          success: false,
          error: `🚫 Acceso denegado: El correo "${decoded.email}" no está autorizado para ingresar al sistema.`,
        };
      }

      const googleUser: User = {
        uid: `google-${decoded.sub}`,
        name: decoded.name || 'Usuario Autorizado',
        email: decoded.email,
        picture: decoded.picture,
        provider: 'google',
        role: 'admin',
      };
      saveSession(googleUser);
      return { success: true };
    } catch (err) {
      console.error('Error decoding Google JWT:', err);
      return { success: false, error: 'Error al verificar la cuenta de Google.' };
    }
  };

  // Email & Password Login with Whitelist Check
  const loginWithEmail = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !pass) {
      return { success: false, error: 'Por favor ingresa tu correo y contraseña.' };
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return {
        success: false,
        error: `🚫 Acceso denegado: El correo "${email}" no tiene permisos de administración.`,
      };
    }

    // Check saved registered users
    const registeredUsersStr = localStorage.getItem('fdvc_registered_users_2026');
    const registeredUsers: Array<User & { passwordHash: string }> = registeredUsersStr
      ? JSON.parse(registeredUsersStr)
      : [];

    const foundUser = registeredUsers.find(
      (u) => u.email.toLowerCase() === normalizedEmail && u.passwordHash === pass
    );

    if (foundUser) {
      const { passwordHash, ...sessionUser } = foundUser;
      saveSession(sessionUser);
      return { success: true };
    }

    // Default fallback access for Whitelisted Emails
    if (pass === 'admin2026' || pass === '123456' || pass === 'festival2026') {
      const defaultUser: User = {
        uid: `user-${normalizedEmail}`,
        name: normalizedEmail.includes('marcos') ? 'Marcos Reyes' : 'María Román',
        email: normalizedEmail,
        provider: 'password',
        role: 'admin',
      };
      saveSession(defaultUser);
      return { success: true };
    }

    return { success: false, error: 'Contraseña incorrecta.' };
  };

  // Register new Email & Password user (Whitelisted Emails Only)
  const registerWithEmail = async (
    name: string,
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!name || !email || !pass) {
      return { success: false, error: 'Todos los campos son obligatorios.' };
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return {
        success: false,
        error: `🚫 Acceso denegado: El correo "${email}" no está autorizado para registrarse.`,
      };
    }

    if (pass.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const newUser: User = {
      uid: `user-${Date.now()}`,
      name,
      email: normalizedEmail,
      provider: 'password',
      role: 'admin',
    };

    saveSession(newUser);
    return { success: true };
  };

  const logout = () => {
    saveSession(null);
  };

  const setDemoUser = () => {
    saveSession(DEFAULT_ADMIN);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithGoogleToken,
        loginWithEmail,
        registerWithEmail,
        logout,
        setDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
