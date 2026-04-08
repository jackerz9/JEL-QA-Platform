import React, { useState, useEffect } from 'react';
import { useAuth } from '../utils/AuthContext';

export default function Login() {
  const { login, setup } = useAuth();
  const [mode, setMode] = useState('loading'); // loading, login, setup
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check if setup is needed
  useEffect(() => {
    fetch('/api/auth/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => {
        if (r.status === 400) {
          return r.json().then(d => {
            setMode(d.error?.includes('Ya existe') ? 'login' : 'setup');
          });
        }
        setMode('setup');
      })
      .catch(() => setMode('login'));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'setup') {
        if (!name.trim()) { setError('Nombre requerido'); setSubmitting(false); return; }
        await setup(username, name, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-slate-500">Cargando...</div></div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jel-navy">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-jel-orange flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">QA</div>
          <h1 className="text-xl font-semibold text-gray-100">JEL QA Platform</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'setup' ? 'Configura tu cuenta de administrador' : 'Inicia sesión'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'setup' && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nombre completo</label>
                <input
                  className="input w-full"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Usuario</label>
              <input
                className="input w-full"
                placeholder="admin"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus={mode === 'login'}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Contraseña</label>
              <input
                type="password"
                className="input w-full"
                placeholder={mode === 'setup' ? 'Mínimo 6 caracteres' : '••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting || !username || !password}
            >
              {submitting ? 'Cargando...' : mode === 'setup' ? 'Crear cuenta admin' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
