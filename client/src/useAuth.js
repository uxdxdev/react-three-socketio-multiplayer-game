import { useEffect, useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, getRedirectResult, GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyAsTVrHaqo3yj6wrKKvuCUG0pTViSa76Gg',
  authDomain: 'game-bb9e8.firebaseapp.com',
  projectId: 'game-bb9e8',
  storageBucket: 'game-bb9e8.appspot.com',
  messagingSenderId: '118076181279',
  appId: '1:118076181279:web:d96c9b95e192513e083e2a',
};

initializeApp(firebaseConfig);

// FIREBASE AUTH
const auth = getAuth();

export const useAuth = () => {
  const [authToken, setAuthToken] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUserId(user.uid);
        const token = await user.getIdToken();
        setAuthToken(token);
      } else {
        setUserId(null);
        setAuthToken(null);
      }
    });
  }, []);

  // check for redirect process during auth
  useEffect(() => {
    getRedirectResult(auth).catch((error) => {
      console.log('There was an error authenticating', error);
    });
  }, []);

  const login = () => {
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider).catch((error) => {
      console.log('There was an error authenticating', error);
    });
  };

  const logout = () => {
    auth.signOut();
  };

  return { userId, authToken, login, logout };
};
