import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    await signInWithPopup(auth, googleAuthProvider);
  };

  const logOut = async () => {
    await signOut(auth);
  };

  const getToken = async () => {
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, getToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
