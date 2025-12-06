
import React, { useState, useEffect } from 'react';
import { Participant, RoomStatus, Exclusion } from './types';
import { drawNames } from './utils/drawLogic';
import { MIN_PARTICIPANTS } from './constants';
import { JoinGame } from './components/ParticipantInput';
import { ParticipantList } from './components/ParticipantList';
import { RevealCard } from './components/RevealCard';
import { ExclusionManager } from './components/ExclusionManager';
import { IdentitySelector } from './components/IdentitySelector';
import { RefreshIcon, EyeIcon } from './components/Icons';
import { 
  createRoom, 
  joinRoom, 
  saveAssignments, 
  resetRoom,
  getSessionUser,
  getParticipants,
  getMyReceiverId,
  getRoomStatus,
  isMockMode,
  addExclusion,
  removeExclusion,
  getExclusions,
  addParticipant,
  removeParticipant,
  claimParticipant,
  releaseParticipant
} from './services/supabase';

function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('LOBBY');
  
  // Data State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [exclusions, setExclusions] = useState<Exclusion[]>([]);
  const [myReceiver, setMyReceiver] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load / Reconnect
  useEffect(() => {
    const checkSession = async () => {
      // First, try to restore session
      const user = await getSessionUser();
      
      // Check URL parameters for Room Code if not in session
      const params = new URLSearchParams(window.location.search);
      const codeParam = params.get('code');

      if (user) {
        setCurrentUser({
            id: user.id,
            name: user.name,
            is_admin: user.is_admin,
            device_id: user.device_id
        });
        setRoomCode(user.room_code);
        setRoomStatus(user.roomStatus as RoomStatus);
      } else if (codeParam) {
          // If we have a code but no user, set roomCode so we enter "Select Identity" mode
          setRoomCode(codeParam.toUpperCase());
      }
    };
    checkSession();
  }, []);

  // 2. Fetch Data (Replaces Realtime)
  const refreshRoomData = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
        const parts = await getParticipants(roomCode);
        setParticipants(parts);
        const status = await getRoomStatus(roomCode);
        if(status) setRoomStatus(status as RoomStatus);
        
        const excls = await getExclusions(roomCode);
        setExclusions(excls);
    } catch (e) {
        console.error("Error fetching room data:", e);
        // If fetch fails (e.g. room invalid), reset
        setRoomCode(null);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (roomCode) {
        refreshRoomData();
    }
  }, [roomCode]);


  // 3. Fetch Receiver when status changes to REVEAL
  useEffect(() => {
    if (roomStatus === 'REVEAL' && currentUser && roomCode) {
        const fetchMatch = async () => {
            const receiverId = await getMyReceiverId(roomCode, currentUser.id);
            if (receiverId) {
                const r = participants.find(p => p.id === receiverId);
                if (r) {
                    setMyReceiver(r);
                } else {
                    const parts = await getParticipants(roomCode);
                    setParticipants(parts);
                    const freshR = parts.find(p => p.id === receiverId);
                    if(freshR) setMyReceiver(freshR);
                }
            }
        }
        fetchMatch();
    } else if (roomStatus === 'LOBBY') {
        setMyReceiver(null);
    }
  }, [roomStatus, currentUser, roomCode, participants]);


  // Handlers
  const handleCreate = async (name: string) => {
    setLoading(true);
    setError(null);
    try {
      const { code, user } = await createRoom(name);
      setRoomCode(code);
      setCurrentUser(user);
      setRoomStatus('LOBBY');
      // Update URL without reload
      window.history.pushState({}, '', `?code=${code}`);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al crear sala");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      // Just check if room exists
      await joinRoom(code);
      setRoomCode(code);
      // Update URL
      window.history.pushState({}, '', `?code=${code}`);
    } catch (e: any) {
      setError(e.message || "Error al unirse");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimIdentity = async (participantId: string) => {
      setLoading(true);
      try {
          const user = await claimParticipant(participantId);
          setCurrentUser(user);
          refreshRoomData();
      } catch (e: any) {
          setError(e.message || "Error al seleccionar usuario");
      } finally {
          setLoading(false);
      }
  };

  const handleChangeUser = async () => {
      if (!currentUser) return;
      if (confirm("¿Estás seguro de que quieres cambiar de usuario? Tu nombre volverá a estar disponible.")) {
          setLoading(true);
          const userIdToRelease = currentUser.id;
          
          try {
             await releaseParticipant(userIdToRelease);
          } catch (e) {
             console.error("Error al liberar participante:", e);
             // We proceed to logout locally anyway
          } finally {
             // Optimistic update to ensure the user sees their name in the list immediately
             setParticipants(prev => prev.map(p => 
                 p.id === userIdToRelease ? { ...p, device_id: null } : p
             ));
             
             setCurrentUser(null);
             setMyReceiver(null);
             
             // Refresh data to ensure consistency
             await refreshRoomData();
             setLoading(false);
          }
      }
  };

  // Admin Actions
  const handleAddParticipant = async (name: string) => {
      if(!roomCode) return;
      try {
          await addParticipant(roomCode, name);
          refreshRoomData();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleRemoveParticipant = async (id: string) => {
      if(!confirm("¿Eliminar este participante?")) return;
      try {
          await removeParticipant(id);
          refreshRoomData();
      } catch (e: any) {
          console.error(e);
      }
  };

  const handleStartDraw = async () => {
    if (!currentUser?.is_admin || !roomCode) return;
    
    if (participants.length < MIN_PARTICIPANTS) {
      alert(`Se necesitan al menos ${MIN_PARTICIPANTS} participantes.`);
      return;
    }

    try {
      const currentExclusions = await getExclusions(roomCode);
      const assignments = drawNames(participants, currentExclusions);
      await saveAssignments(roomCode, assignments);
      refreshRoomData();
    } catch (e: any) {
      alert(e.message || "Error al sortear");
      console.error(e);
    }
  };

  const handleReset = async () => {
      if(!currentUser?.is_admin || !roomCode) return;
      if(confirm("¿Reiniciar sorteo? Se borrarán las asignaciones y se volverá al Lobby.")) {
          try {
              setLoading(true);
              await resetRoom(roomCode);
              setRoomStatus('LOBBY');
              setMyReceiver(null);
              await refreshRoomData();
          } catch(e: any) {
              console.error(e);
              alert("Error al reiniciar la sala: " + (e.message || e.error_description || "Error desconocido"));
          } finally {
              setLoading(false);
          }
      }
  }

  // Exclusion Handlers
  const handleAddExclusion = async (giverId: string, receiverId: string) => {
      if (!roomCode) return;
      try {
          await addExclusion(roomCode, giverId, receiverId);
          refreshRoomData();
      } catch (e) {
          console.error(e);
          alert("Error al guardar restricción");
      }
  };

  const handleRemoveExclusion = async (id: string) => {
      try {
          await removeExclusion(id);
          refreshRoomData();
      } catch (e) {
          console.error(e);
          alert("Error al eliminar restricción");
      }
  };

  // --- Render ---

  // 1. Join Screen (No Code)
  if (!roomCode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4">
        {isMockMode() && (
            <div className="absolute top-0 left-0 w-full bg-blue-600/90 text-white text-xs font-bold text-center py-1 z-50">
                MODO PRUEBA: Datos locales (sin Supabase)
            </div>
        )}
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400 mb-8 tracking-tight">
          Amigo Invisible AI
        </h1>
        <JoinGame onCreate={handleCreate} onJoin={handleJoin} isLoading={loading} />
        {error && <p className="mt-4 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>}
      </div>
    );
  }

  // 2. Identity Selection (Has Code, No User)
  if (roomCode && !currentUser) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Sala: <span className="text-brand-400">{roomCode}</span></h1>
            
            <IdentitySelector participants={participants} onSelect={handleClaimIdentity} />
             {error && <p className="mt-4 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>}
             <button onClick={() => setRoomCode(null)} className="mt-8 text-slate-500 hover:text-white text-sm">
                ← Volver al inicio
             </button>
        </div>
      )
  }

  // 3. Authenticated Room View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center p-4 md:p-8">
      {isMockMode() && (
            <div className="fixed top-0 left-0 w-full bg-blue-600/90 text-white text-xs font-bold text-center py-1 z-50 shadow-lg">
                MODO PRUEBA (AI STUDIO)
            </div>
      )}
      <header className="w-full max-w-2xl mb-8 flex flex-col items-center text-center mt-6 relative">
        <div className="bg-white/5 px-4 py-1 rounded-full text-xs font-mono text-slate-400 mb-4 border border-white/10">
            SALA: <span className="text-brand-300 font-bold text-base ml-1">{roomCode}</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
            {roomStatus === 'LOBBY' ? 'Lobby' : '¡Sorteo Realizado!'}
        </h1>
      </header>

      <main className="w-full max-w-2xl flex-1 flex flex-col">
        
        {/* LOBBY MODE */}
        {roomStatus === 'LOBBY' && (
            <div className="animate-fadeIn w-full">
                
                {currentUser?.is_admin && (
                  <ExclusionManager 
                    participants={participants}
                    exclusions={exclusions}
                    onAdd={handleAddExclusion}
                    onRemove={handleRemoveExclusion}
                  />
                )}

                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 shadow-xl mb-6">
                    <h2 className="text-sm uppercase text-slate-500 font-bold mb-4 tracking-wider">Participantes ({participants.length})</h2>
                    <ParticipantList 
                        participants={participants} 
                        onRemove={handleRemoveParticipant}
                        onAdd={currentUser?.is_admin ? handleAddParticipant : undefined}
                        isAdmin={currentUser?.is_admin}
                    /> 
                </div>

                {currentUser?.is_admin ? (
                    <button
                        onClick={handleStartDraw}
                        disabled={participants.length < MIN_PARTICIPANTS}
                        className="w-full py-5 rounded-2xl bg-gradient-to-r from-brand-600 to-purple-600 text-white font-bold text-xl hover:shadow-[0_0_30px_rgba(192,38,211,0.4)] transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-3"
                    >
                        <EyeIcon className="w-6 h-6" />
                        Sortear Papelitos
                    </button>
                ) : (
                    <div className="text-center p-6 bg-slate-800/30 rounded-2xl border border-white/5 animate-pulse">
                        <p className="text-slate-400">Esperando a que el administrador inicie el sorteo...</p>
                        <p className="text-xs text-slate-500 mt-2">Refresca la página para verificar.</p>
                    </div>
                )}
            </div>
        )}

        {/* REVEAL MODE */}
        {roomStatus === 'REVEAL' && (
            <div className="animate-fadeIn w-full">
                {myReceiver ? (
                    <RevealCard 
                        giver={currentUser!} 
                        receiver={myReceiver} 
                        onClose={() => {}} 
                    />
                ) : (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Cargando tu resultado...</p>
                        <button onClick={refreshRoomData} className="mt-4 text-brand-400 underline">Intentar de nuevo</button>
                    </div>
                )}

                {currentUser?.is_admin && (
                    <div className="mt-12 flex justify-center">
                        <button 
                            onClick={handleReset}
                            className="text-slate-500 hover:text-red-400 transition-colors flex items-center gap-2 text-sm"
                        >
                            <RefreshIcon className="w-4 h-4" />
                            Reiniciar Sala (Admin)
                        </button>
                    </div>
                )}
            </div>
        )}

      </main>

      <footer className="mt-12 text-center text-slate-600 text-sm mb-4">
        <p className="mb-2">Hola, <span className="text-slate-300 font-bold">{currentUser?.name}</span></p>
        <button 
            onClick={handleChangeUser}
            className="text-xs text-brand-400 hover:text-brand-300 underline"
        >
            No soy {currentUser?.name} (Cambiar Usuario)
        </button>
      </footer>
    </div>
  );
}

export default App;
