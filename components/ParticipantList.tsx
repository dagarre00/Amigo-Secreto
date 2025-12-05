import React from 'react';
import { Participant } from '../types';
import { TrashIcon } from './Icons';

interface ParticipantListProps {
  participants: Participant[];
  onRemove: (id: string) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({ participants, onRemove }) => {
  if (participants.length === 0) {
    return (
      <div className="text-center py-12 px-4 border-2 border-dashed border-white/10 rounded-2xl text-slate-400">
        <p>Aún no hay nadie en la lista.</p>
        <p className="text-sm mt-1 opacity-60">¡Añade al menos 3 personas para empezar!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2 mt-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
      {participants.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-white/5 group hover:border-brand-500/30 transition-colors"
        >
          <span className="font-medium text-slate-200">{p.name}</span>
          <button
            onClick={() => onRemove(p.id)}
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
            aria-label="Eliminar participante"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
};
