
import React, { useState } from 'react';
import { Participant } from '../types';
import { TrashIcon, PlusIcon } from './Icons';

interface ParticipantListProps {
  participants: Participant[];
  onRemove: (id: string) => void;
  onAdd?: (name: string) => void; // Optional, only if admin
  isAdmin?: boolean;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({ participants, onRemove, onAdd, isAdmin }) => {
  const [newName, setNewName] = useState('');

  const handleAdd = (e: React.FormEvent) => {
      e.preventDefault();
      if(newName.trim() && onAdd) {
          onAdd(newName.trim());
          setNewName('');
      }
  }

  return (
    <div>
        {isAdmin && onAdd && (
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <input 
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Añadir participante..."
                    className="flex-1 bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <button 
                    type="submit"
                    disabled={!newName.trim()}
                    className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </form>
        )}

        {participants.length === 0 ? (
            <div className="text-center py-8 px-4 border-2 border-dashed border-white/10 rounded-xl text-slate-400">
            <p className="text-sm opacity-60">¡Añade personas para empezar!</p>
            </div>
        ) : (
            <ul className="space-y-2 mt-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {participants.map((p) => {
                return (
                    <li
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-white/5 group hover:border-brand-500/30 transition-colors"
                    >
                    <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{p.name}</span>
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => onRemove(p.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            aria-label="Eliminar participante"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                    </li>
                );
            })}
            </ul>
        )}
    </div>
  );
};
