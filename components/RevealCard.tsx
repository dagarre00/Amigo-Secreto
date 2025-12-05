import React, { useState, useEffect } from 'react';
import { Participant } from '../types';
import { GiftIcon, CheckIcon } from './Icons';
import { generateFunnyHint } from '../services/geminiService';

interface RevealCardProps {
  giver: Participant;
  receiver: Participant;
  onClose: () => void; // Actually means logout/reset for this user perspective
}

export const RevealCard: React.FC<RevealCardProps> = ({ giver, receiver, onClose }) => {
  const [step, setStep] = useState<'CONFIRM' | 'REVEALED'>('CONFIRM');
  const [hint, setHint] = useState<string>('');
  const [loadingHint, setLoadingHint] = useState(false);

  useEffect(() => {
    if (step === 'REVEALED' && !hint) {
        setLoadingHint(true);
        generateFunnyHint(receiver.name)
            .then(txt => setHint(txt))
            .catch(() => setHint("¡Es un secreto!"))
            .finally(() => setLoadingHint(false));
    }
  }, [step, receiver.name, hint]);

  if (step === 'CONFIRM') {
    return (
        <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto animate-fadeIn">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-yellow-500/20 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <GiftIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Confirmación de Seguridad</h2>
          <p className="text-slate-400 mb-8">
            Para evitar arruinar la sorpresa, por favor confirma:
          </p>
          
          <div className="bg-white/5 p-4 rounded-xl mb-8">
            <p className="text-sm text-slate-500 uppercase font-bold mb-1">¿Eres tú?</p>
            <p className="text-2xl font-black text-white">{giver.name}</p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep('REVEALED')}
              className="w-full py-4 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-900/20 active:scale-95"
            >
              Sí, soy yo. ¡Mostrar!
            </button>
            <p className="text-xs text-slate-500 mt-2">
                Si no eres {giver.name}, no continúes.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto animate-fadeIn">
      <div className="bg-gradient-to-b from-brand-900/80 to-slate-900/90 backdrop-blur-xl border border-brand-500/30 p-8 rounded-3xl w-full text-center shadow-2xl relative overflow-hidden">
        
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-50"></div>

        <h3 className="text-slate-300 uppercase tracking-widest text-xs font-bold mb-6">Tu misión secreta</h3>
        
        <div className="mb-8">
          <p className="text-lg text-slate-400 mb-2">Le regalas a:</p>
          <h1 className="text-4xl font-black text-white tracking-tight break-words filter drop-shadow-[0_0_15px_rgba(217,70,239,0.5)]">
            {receiver.name}
          </h1>
        </div>

        {/* AI Hint Section */}
        <div className="bg-white/5 rounded-xl p-4 mb-8 min-h-[80px] flex items-center justify-center">
            {loadingHint ? (
                 <p className="text-sm text-slate-400 animate-pulse">Consultando a los astros...</p>
            ) : (
                <div className="text-center">
                    <p className="text-xs text-brand-300 font-bold mb-1 uppercase tracking-wider">✨ Pista Mágica ✨</p>
                    <p className="text-slate-200 italic text-sm">"{hint}"</p>
                </div>
            )}
        </div>

        <button
          className="w-full py-4 bg-slate-800 text-slate-400 font-medium rounded-xl border border-white/5 cursor-default flex items-center justify-center gap-2"
        >
          <CheckIcon className="w-5 h-5" />
          <span>¡Guardado! Haz captura si quieres.</span>
        </button>
      </div>
    </div>
  );
};