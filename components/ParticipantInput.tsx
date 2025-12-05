import React, { useState } from 'react';
import { SparklesIcon, PlusIcon } from './Icons';

interface JoinGameProps {
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  isLoading: boolean;
}

export const JoinGame: React.FC<JoinGameProps> = ({ onCreate, onJoin, isLoading }) => {
  const [mode, setMode] = useState<'CREATE' | 'JOIN'>('CREATE');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    if (mode === 'CREATE') {
      onCreate(name.trim());
    } else {
      if (!code.trim()) return;
      onJoin(code.trim().toUpperCase(), name.trim());
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl">
      <div className="flex gap-2 mb-8 bg-slate-800/50 p-1 rounded-xl">
        <button 
          onClick={() => setMode('CREATE')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'CREATE' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Crear Sala
        </button>
        <button 
          onClick={() => setMode('JOIN')}
          className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${mode === 'JOIN' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
        >
          Unirse
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Tu Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Ana"
            className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white/10 transition-all"
            required
          />
        </div>

        {mode === 'JOIN' && (
          <div className="animate-fadeIn">
            <label className="block text-xs uppercase tracking-wider text-slate-500 font-bold mb-2">Código de Sala</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ej. ABCD"
              maxLength={4}
              className="w-full px-5 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white/10 transition-all font-mono tracking-widest uppercase"
              required
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !name.trim() || (mode === 'JOIN' && !code.trim())}
          className="mt-4 w-full py-4 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-900/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span className="animate-pulse">Conectando...</span>
          ) : (
            <>
              {mode === 'CREATE' ? <SparklesIcon className="w-5 h-5"/> : <PlusIcon className="w-5 h-5"/>}
              <span>{mode === 'CREATE' ? 'Crear y Entrar' : 'Entrar a Sala'}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};