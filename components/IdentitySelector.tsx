
import React, { useState } from 'react';
import { Participant } from '../types';
import { CheckIcon } from './Icons';

interface IdentitySelectorProps {
  participants: Participant[];
  onSelect: (participantId: string) => void;
}

export const IdentitySelector: React.FC<IdentitySelectorProps> = ({ participants, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Only show unclaimed participants (device_id is null)
  const availableParticipants = participants.filter(p => !p.device_id);

  const handleConfirm = () => {
    if (selectedId) {
        onSelect(selectedId);
    }
  };

  const selectedParticipant = participants.find(p => p.id === selectedId);

  return (
    <div className="w-full max-w-md bg-slate-900/50 p-8 rounded-3xl border border-white/5 shadow-2xl animate-fadeIn">
      <h2 className="text-2xl font-bold text-white mb-2 text-center">¿Quién eres?</h2>
      <p className="text-slate-400 text-center mb-6 text-sm">
        Selecciona tu nombre de la lista para unirte a la sala.
      </p>

      {availableParticipants.length === 0 ? (
         <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
            <p className="text-yellow-200 text-sm">
                No hay nombres disponibles. <br/>
                Pídele al administrador que te añada a la lista.
            </p>
         </div>
      ) : (
          <div className="grid grid-cols-2 gap-3 mb-6 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {availableParticipants.map(p => (
                <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`p-4 rounded-xl border transition-all text-sm font-bold truncate ${
                        selectedId === p.id 
                        ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/50 scale-[1.02]' 
                        : 'bg-slate-800 border-white/5 text-slate-300 hover:bg-slate-700 hover:border-white/10'
                    }`}
                >
                    {p.name}
                </button>
            ))}
          </div>
      )}

      {selectedId && selectedParticipant && (
        <div className="animate-slideUp bg-slate-800/80 p-4 rounded-xl border border-white/10 mt-4">
             <p className="text-center text-slate-300 text-sm mb-3">
                ¿Confirmas que eres <strong className="text-white text-lg block mt-1">{selectedParticipant.name}</strong>?
             </p>
             <button
                onClick={handleConfirm}
                className="w-full py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2"
             >
                <CheckIcon className="w-5 h-5" />
                Sí, soy yo
             </button>
        </div>
      )}
    </div>
  );
};
