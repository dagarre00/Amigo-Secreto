import React, { useState } from 'react';
import { Participant, Exclusion } from '../types';
import { BanIcon, TrashIcon, PlusIcon } from './Icons';

interface ExclusionManagerProps {
  participants: Participant[];
  exclusions: Exclusion[];
  onAdd: (giverId: string, receiverId: string) => void;
  onRemove: (exclusionId: string) => void;
}

export const ExclusionManager: React.FC<ExclusionManagerProps> = ({ 
  participants, 
  exclusions, 
  onAdd, 
  onRemove 
}) => {
  const [giverId, setGiverId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleAdd = () => {
    if (giverId && receiverId && giverId !== receiverId) {
      onAdd(giverId, receiverId);
      setGiverId('');
      setReceiverId('');
    }
  };

  if (participants.length < 2) return null;

  return (
    <div className="w-full bg-slate-900/50 p-6 rounded-3xl border border-white/5 shadow-xl mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
            <BanIcon className="text-red-400 w-5 h-5" />
            <h2 className="text-sm uppercase text-slate-500 font-bold tracking-wider">Restricciones de Regalo</h2>
        </div>
        <button className="text-slate-500 hover:text-white text-sm font-bold">
            {isOpen ? 'Ocultar' : 'Gestionar'}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 animate-fadeIn">
            {/* Add New Rule */}
            <div className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-slate-800/50 p-4 rounded-xl mb-4">
                <div className="flex-1 w-full">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Quien regala</label>
                    <select 
                        value={giverId} 
                        onChange={(e) => setGiverId(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    >
                        <option value="">Seleccionar...</option>
                        {participants.map(p => (
                            <option key={`giver-${p.id}`} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                
                <div className="text-slate-500 pb-2">❌</div>

                <div className="flex-1 w-full">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Quien recibe</label>
                    <select 
                        value={receiverId} 
                        onChange={(e) => setReceiverId(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
                    >
                        <option value="">Seleccionar...</option>
                        {participants.map(p => (
                            <option 
                                key={`receiver-${p.id}`} 
                                value={p.id} 
                                disabled={p.id === giverId}
                            >
                                {p.name}
                            </option>
                        ))}
                    </select>
                </div>

                <button 
                    onClick={handleAdd}
                    disabled={!giverId || !receiverId || giverId === receiverId}
                    className="w-full md:w-auto bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2.5 rounded-lg transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>

            {/* List Existing */}
            {exclusions.length > 0 ? (
                <ul className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {exclusions.map(ex => {
                        const giver = participants.find(p => p.id === ex.giverId);
                        const receiver = participants.find(p => p.id === ex.receiverId);
                        if (!giver || !receiver) return null;

                        return (
                            <li key={ex.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-brand-300 font-medium">{giver.name}</span>
                                    <span className="text-slate-500">no puede regalar a</span>
                                    <span className="text-red-300 font-medium">{receiver.name}</span>
                                </div>
                                <button 
                                    onClick={() => onRemove(ex.id)}
                                    className="text-slate-500 hover:text-red-400 p-1"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p className="text-center text-slate-500 text-sm py-2">No hay restricciones activas.</p>
            )}
        </div>
      )}
    </div>
  );
};