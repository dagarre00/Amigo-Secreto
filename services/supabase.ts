import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Assignment, RoomStatus } from '../types';

// --- Environment Setup ---
const getEnvVar = (key: string, viteKey: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[viteKey]) {
    return (import.meta as any).env[viteKey];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');

let supabase: SupabaseClient | null = null;
let useMock = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('⚠️ Error initializing Supabase. Switching to MOCK MODE.', e);
    useMock = true;
  }
} else {
  console.warn('⚠️ Supabase credentials missing. Switching to MOCK MODE (LocalStorage).');
  useMock = true;
}

export const isMockMode = () => useMock;

// --- Utils ---
export const getDeviceId = () => {
  let id = localStorage.getItem('ai_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ai_device_id', id);
  }
  return id;
};

// --- MOCK DB IMPLEMENTATION (For AIStudio Preview) ---
const MOCK_DELAY = 300;
const STORAGE_KEY_ROOMS = 'mock_ai_rooms';
const STORAGE_KEY_PARTICIPANTS = 'mock_ai_participants';
const STORAGE_KEY_ASSIGNMENTS = 'mock_ai_assignments';

const getMockData = (key: string) => JSON.parse(localStorage.getItem(key) || '[]');
const setMockData = (key: string, data: any[]) => {
    localStorage.setItem(key, JSON.stringify(data));
    // Dispatch event for local polling simulation (same tab)
    window.dispatchEvent(new Event('mock-db-update'));
};

const mockDelay = () => new Promise(r => setTimeout(r, MOCK_DELAY));

// --- Actions (Facade) ---

export const createRoom = async (adminName: string) => {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const deviceId = getDeviceId();
  const newParticipant = { 
    id: crypto.randomUUID(),
    room_code: code, 
    name: adminName, 
    device_id: deviceId, 
    is_admin: true 
  };

  if (useMock || !supabase) {
    await mockDelay();
    const rooms = getMockData(STORAGE_KEY_ROOMS);
    const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
    
    rooms.push({ code, status: 'LOBBY' });
    participants.push(newParticipant);
    
    setMockData(STORAGE_KEY_ROOMS, rooms);
    setMockData(STORAGE_KEY_PARTICIPANTS, participants);
    
    return { code, user: newParticipant };
  } else {
    // Real Supabase
    const { error: roomError } = await supabase
      .from('rooms')
      .insert([{ code, status: 'LOBBY' }]);
    if (roomError) throw roomError;

    const { data: user, error: userError } = await supabase
      .from('participants')
      .insert([newParticipant])
      .select()
      .single();

    if (userError) throw userError;
    return { code, user };
  }
};

export const joinRoom = async (code: string, name: string) => {
  const deviceId = getDeviceId();

  if (useMock || !supabase) {
    await mockDelay();
    const rooms = getMockData(STORAGE_KEY_ROOMS);
    const participants = getMockData(STORAGE_KEY_PARTICIPANTS);

    const room = rooms.find((r: any) => r.code === code);
    if (!room) throw new Error("Sala no encontrada");
    if (room.status !== 'LOBBY') throw new Error("El sorteo ya ha comenzado");

    const existing = participants.find((p: any) => p.room_code === code && p.device_id === deviceId);
    if (existing) return existing;

    const nameTaken = participants.some((p: any) => p.room_code === code && p.name.toLowerCase() === name.toLowerCase());
    if (nameTaken) throw new Error("Ya existe alguien con ese nombre");

    const newUser = {
        id: crypto.randomUUID(),
        room_code: code,
        name,
        device_id: deviceId,
        is_admin: false
    };

    participants.push(newUser);
    setMockData(STORAGE_KEY_PARTICIPANTS, participants);
    return newUser;

  } else {
    // Real Supabase
    const { data: room, error: roomCheck } = await supabase
      .from('rooms')
      .select('status')
      .eq('code', code)
      .single();

    if (roomCheck || !room) throw new Error("Sala no encontrada");

    // Check existing
    const { data: existing } = await supabase
      .from('participants')
      .select()
      .eq('room_code', code)
      .eq('device_id', deviceId)
      .single();

    if (existing) return existing;
    if (room.status !== 'LOBBY') throw new Error("El sorteo ya ha comenzado");

    const { data: user, error } = await supabase
      .from('participants')
      .insert([{ 
        room_code: code, 
        name: name, 
        device_id: deviceId, 
        is_admin: false 
      }])
      .select()
      .single();

    if (error) {
        if (error.code === '23505') throw new Error("Ya existe alguien con ese nombre");
        throw error;
    }
    return user;
  }
};

export const saveAssignments = async (roomCode: string, assignments: Assignment[]) => {
  if (useMock || !supabase) {
      await mockDelay();
      const dbAssignments = assignments.map(a => ({
        id: crypto.randomUUID(),
        room_code: roomCode,
        giver_id: a.giverId,
        receiver_id: a.receiverId
      }));
      
      const allAssignments = getMockData(STORAGE_KEY_ASSIGNMENTS);
      setMockData(STORAGE_KEY_ASSIGNMENTS, [...allAssignments, ...dbAssignments]);

      const rooms = getMockData(STORAGE_KEY_ROOMS);
      const roomIndex = rooms.findIndex((r: any) => r.code === roomCode);
      if(roomIndex !== -1) {
          rooms[roomIndex].status = 'REVEAL';
          setMockData(STORAGE_KEY_ROOMS, rooms);
      }

  } else {
    // Real Supabase
    const dbAssignments = assignments.map(a => ({
        room_code: roomCode,
        giver_id: a.giverId,
        receiver_id: a.receiverId
      }));
    
      const { error: assignError } = await supabase.from('assignments').insert(dbAssignments);
      if (assignError) throw assignError;
    
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'REVEAL' })
        .eq('code', roomCode);
    
      if (roomError) throw roomError;
  }
};

export const resetRoom = async (roomCode: string) => {
    if (useMock || !supabase) {
        await mockDelay();
        let assignments = getMockData(STORAGE_KEY_ASSIGNMENTS);
        assignments = assignments.filter((a: any) => a.room_code !== roomCode);
        setMockData(STORAGE_KEY_ASSIGNMENTS, assignments);

        const rooms = getMockData(STORAGE_KEY_ROOMS);
        const room = rooms.find((r: any) => r.code === roomCode);
        if(room) {
            room.status = 'LOBBY';
            setMockData(STORAGE_KEY_ROOMS, rooms);
        }
    } else {
        await supabase.from('assignments').delete().eq('room_code', roomCode);
        await supabase.from('rooms').update({ status: 'LOBBY' }).eq('code', roomCode);
    }
};

// --- Getters & Subscriptions ---

export const getSessionUser = async () => {
    const deviceId = getDeviceId();
    if (useMock || !supabase) {
        // Find latest participant for this device
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        const rooms = getMockData(STORAGE_KEY_ROOMS);
        
        // Simple mock query: find latest
        const myEntries = participants.filter((p: any) => p.device_id === deviceId);
        if (myEntries.length === 0) return null;
        
        const user = myEntries[myEntries.length - 1]; // Last joined
        const room = rooms.find((r: any) => r.code === user.room_code);
        
        return {
            ...user,
            roomStatus: room ? room.status : 'LOBBY'
        };
    } else {
        const { data: user } = await supabase
        .from('participants')
        .select(`*, rooms:room_code (status)`)
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
        if(!user) return null;
        return {
            ...user,
            // @ts-ignore
            roomStatus: user.rooms?.status || 'LOBBY'
        }
    }
}

export const getParticipants = async (roomCode: string) => {
    if (useMock || !supabase) {
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        return participants.filter((p: any) => p.room_code === roomCode);
    } else {
        const { data } = await supabase.from('participants').select('*').eq('room_code', roomCode);
        return data || [];
    }
}

export const getMyReceiverId = async (roomCode: string, myId: string) => {
    if (useMock || !supabase) {
        const assignments = getMockData(STORAGE_KEY_ASSIGNMENTS);
        const match = assignments.find((a: any) => a.room_code === roomCode && a.giver_id === myId);
        return match ? match.receiver_id : null;
    } else {
        const { data } = await supabase
        .from('assignments')
        .select('receiver_id')
        .eq('room_code', roomCode)
        .eq('giver_id', myId)
        .single();
      
        return data?.receiver_id;
    }
}

export const getRoomStatus = async (roomCode: string) => {
    if (useMock || !supabase) {
        const rooms = getMockData(STORAGE_KEY_ROOMS);
        const room = rooms.find((r: any) => r.code === roomCode);
        return room ? room.status : 'LOBBY';
    } else {
         const { data } = await supabase.from('rooms').select('status').eq('code', roomCode).single();
         return data?.status;
    }
}

export const subscribeToRoom = (
    roomCode: string, 
    onParticipantsChange: () => void, 
    onRoomStatusChange: (status: RoomStatus) => void
) => {
    if (useMock || !supabase) {
        // Mock Subscription
        const handler = () => {
             const rooms = getMockData(STORAGE_KEY_ROOMS);
             const room = rooms.find((r: any) => r.code === roomCode);
             if (room) onRoomStatusChange(room.status);
             onParticipantsChange();
        };
        
        // Listen to custom event (same tab updates)
        window.addEventListener('mock-db-update', handler);
        // Listen to storage event (cross-tab updates)
        window.addEventListener('storage', handler);

        // Also simulate network polling for extra safety
        const interval = setInterval(handler, 2000); 

        return () => {
            window.removeEventListener('mock-db-update', handler);
            window.removeEventListener('storage', handler);
            clearInterval(interval);
        };
    } else {
        // Real Supabase Subscription
        const channel = supabase
        .channel(`room_${roomCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants', filter: `room_code=eq.${roomCode}` },
          () => onParticipantsChange()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${roomCode}` },
          (payload) => {
              if (payload.new && 'status' in payload.new) {
                onRoomStatusChange(payload.new.status as RoomStatus);
              }
          }
        )
        .subscribe();

      return () => {
        if(supabase) supabase.removeChannel(channel);
      };
    }
}