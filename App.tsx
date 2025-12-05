import React, { useState, useEffect } from 'react';
import { Participant, RoomStatus } from './types';
import { drawNames } from './utils/drawLogic';
import { MIN_PARTICIPANTS } from './constants';
import { JoinGame } from './components/ParticipantInput';
import { ParticipantList } from './components/ParticipantList';
import { RevealCard } from './components/RevealCard';
import { RefreshIcon, EyeIcon } from './components/Icons';
import { 
  supabase, 
  createRoom, 
  joinRoom, 
  getDeviceId, 
  saveAssignments, 
  resetRoom,
  getMyReceiver
} from './services/supabase';

function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('LOBBY');
  
  // Data State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myReceiver, setMyReceiver] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Initial Load / Reconnect
  useEffect(() => {
    const checkSession = async () => {
      const deviceId = getDeviceId();
      if (!deviceId) return;

      // Try to find if this device is in a room
      const { data: user } = await supabase
        .from('participants')
        .select(`*, rooms:room_code (status)`)
        .eq('device_id', deviceId)
        .order('id', { ascending: false }) // Get latest
        .limit(1)
        .single();

      if (user) {
        setCurrentUser({
            id: user.id,
            name: user.name,
            is_admin: user.is_admin,
            device_id: user.device_id
        });
        setRoomCode(user.room_code);
        // @ts-ignore - supabase types inference can be tricky with joins
        setRoomStatus(user.rooms?.status || 'LOBBY');
      }
    };
    checkSession();
  }, []);

  // 2. Realtime Subscriptions
  useEffect(() => {
    if (!roomCode) return;

    // Fetch initial list
    const fetchParticipants = async () => {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('room_code', roomCode);
      if (data) setParticipants(data);
    };
    fetchParticipants();

    // Subscribe to changes
    const channel = supabase
      .channel('room_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `room_code=eq.${roomCode}` },
        (payload) => {
           fetchParticipants(); // Reload list on any change to be safe
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
        (payload) => {
            if (payload.new && 'status' in payload.new) {
                setRoomStatus(payload.new.status as RoomStatus);
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  // 3. Fetch Receiver when status changes to REVEAL
  useEffect(() => {
    if (roomStatus === 'REVEAL' && currentUser && roomCode) {
        const fetchMatch = async () => {
            const receiverId = await getMyReceiver(roomCode, currentUser.id);
            if (receiverId) {
                // We need the name of the receiver. We can find it in the participants list
                // If participants list isn't populated yet, we might need to wait or fetch it.
                // Assuming participants state is up to date via realtime
                const r = participants.find(p => p.id === receiverId);
                if (r) setMyReceiver(r);
                else {
                    // Fallback fetch if state race condition
                    const { data } = await supabase.from('participants').select('*').eq('id', receiverId).single();
                    if(data) setMyReceiver(data);
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
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al crear sala");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (code: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await joinRoom(code, name);
      setRoomCode(code);
      setCurrentUser(user);
      // Room status will be fetched by the useEffect or we can fetch here
      const { data: room } = await supabase.from('rooms').select('status').eq('code', code).single();
      if (room) setRoomStatus(room.status as RoomStatus);
    } catch (e: any) {
      setError(e.message || "Error al unirse");
    } finally {
      setLoading(false);
    }
  };

  const handleStartDraw = async () => {
    if (!currentUser?.is_admin || !roomCode) return;
    if (participants.length < MIN_PARTICIPANTS) {
      alert(`Se necesitan al menos ${MIN_PARTICIPANTS} participantes.`);
      return;
    }

    try {
      const assignments = drawNames(participants);
      await saveAssignments(roomCode, assignments);
    } catch (e) {
      alert("Error al sortear");
      console.error(e);
    }
  };

  const handleReset = async () => {
      if(!currentUser?.is_admin || !roomCode) return;
      if(confirm("¿Reiniciar sorteo? Se borrarán las asignaciones.")) {
          await resetRoom(roomCode);
      }
  }

  // Render Views

  // 1. Join / Login
  if (!currentUser || !roomCode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-purple-400 mb-8 tracking-tight">
          Amigo Invisible AI
        </h1>
        <JoinGame onCreate={handleCreate} onJoin={handleJoin} isLoading={loading} />
        {error && <p className="mt-4 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">{error}</p>}
      </div>
    );
  }

  // 2. Room View
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-2xl mb-8 flex flex-col items-center text-center">
        <div className="bg-white/5 px-4 py-1 rounded-full text-xs font-mono text-slate-400 mb-4 border border-white/10">
            SALA: <span className="text-brand-300 font-bold text-base ml-1">{roomCode}</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">
            {roomStatus === 'LOBBY' ? 'Esperando Participantes' : '¡Sorteo Realizado!'}
        </h1>
        {currentUser.is_admin && (
             <span className="bg-brand-500/20 text-brand-300 text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider">Admin</span>
        )}
      </header>

      <main className="w-full max-w-2xl flex-1 flex flex-col">
        
        {/* LOBBY MODE */}
        {roomStatus === 'LOBBY' && (
            <div className="animate-fadeIn w-full">
                <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 shadow-xl mb-6">
                    <h2 className="text-sm uppercase text-slate-500 font-bold mb-4 tracking-wider">Participantes ({participants.length})</h2>
                    <ParticipantList participants={participants} onRemove={() => {}} /> 
                    {/* Removal Logic removed for simplicity in multi-user MVP, strictly admin reset available */}
                </div>

                {currentUser.is_admin ? (
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
                    </div>
                )}
            </div>
        )}

        {/* REVEAL MODE */}
        {roomStatus === 'REVEAL' && (
            <div className="animate-fadeIn w-full">
                {myReceiver ? (
                    <RevealCard 
                        giver={currentUser} 
                        receiver={myReceiver} 
                        onClose={() => {}} 
                    />
                ) : (
                    <div className="text-center py-12">
                        <p className="text-slate-500">Cargando tu resultado...</p>
                    </div>
                )}

                {currentUser.is_admin && (
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

      <footer className="mt-12 text-center text-slate-600 text-sm">
        <p>Tu nombre: <span className="text-slate-400">{currentUser.name}</span></p>
      </footer>
    </div>
  );
}

export default App;