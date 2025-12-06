
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Assignment, RoomStatus, Exclusion, Participant } from '../types';

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

// --- Safety Utils ---

// Safe UUID generator that works even in insecure contexts (non-HTTPS)
const generateUUID = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        try {
            return crypto.randomUUID();
        } catch (e) {
            // Fallback if crypto throws (e.g. insecure context)
        }
    }
    // Manual v4 UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// Safe Storage wrapper to handle "Operation is insecure" errors in restricted iframes
const memStorage: Record<string, string> = {};
const safeStorage = {
    getItem: (key: string) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            return memStorage[key] || null;
        }
    },
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
            // Dispatch event for local polling simulation (same tab)
            window.dispatchEvent(new Event('mock-db-update'));
        } catch (e) {
            memStorage[key] = value;
            window.dispatchEvent(new Event('mock-db-update'));
        }
    },
    removeItem: (key: string) => {
         try {
            localStorage.removeItem(key);
            window.dispatchEvent(new Event('mock-db-update'));
        } catch (e) {
             delete memStorage[key];
             window.dispatchEvent(new Event('mock-db-update'));
        }
    }
};

export const getDeviceId = () => {
  let id = safeStorage.getItem('ai_device_id');
  if (!id) {
    id = generateUUID();
    safeStorage.setItem('ai_device_id', id);
  }
  return id;
};

// --- MOCK DB IMPLEMENTATION (For AIStudio Preview) ---
const MOCK_DELAY = 300;
const STORAGE_KEY_ROOMS = 'mock_ai_rooms';
const STORAGE_KEY_PARTICIPANTS = 'mock_ai_participants';
const STORAGE_KEY_ASSIGNMENTS = 'mock_ai_assignments';
const STORAGE_KEY_EXCLUSIONS = 'mock_ai_exclusions';

const getMockData = (key: string) => JSON.parse(safeStorage.getItem(key) || '[]');
const setMockData = (key: string, data: any[]) => {
    safeStorage.setItem(key, JSON.stringify(data));
};

const mockDelay = () => new Promise(r => setTimeout(r, MOCK_DELAY));

// --- Actions (Facade) ---

export const createRoom = async (adminName: string) => {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const deviceId = getDeviceId();
  
  const newParticipant = { 
    id: generateUUID(),
    room_code: code, 
    name: adminName, 
    device_id: deviceId, // Admin is automatically claimed
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

/**
 * Validates room exists. Does NOT create a user.
 */
export const joinRoom = async (code: string) => {
  if (useMock || !supabase) {
    await mockDelay();
    const rooms = getMockData(STORAGE_KEY_ROOMS);
    const room = rooms.find((r: any) => r.code === code);
    if (!room) throw new Error("Sala no encontrada");
    return true;
  } else {
    const { data: room, error } = await supabase
      .from('rooms')
      .select('status')
      .eq('code', code)
      .single();

    if (error || !room) throw new Error("Sala no encontrada");
    return true;
  }
};

/**
 * Admin creates a participant slot (unclaimed).
 */
export const addParticipant = async (roomCode: string, name: string) => {
    if (useMock || !supabase) {
        await mockDelay();
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        
        // Check dupe
        const nameTaken = participants.some((p: any) => p.room_code === roomCode && p.name.toLowerCase() === name.toLowerCase());
        if (nameTaken) throw new Error("Ya existe alguien con ese nombre");

        const newP = {
            id: generateUUID(),
            room_code: roomCode,
            name,
            device_id: null, // UNCLAIMED
            is_admin: false
        };
        participants.push(newP);
        setMockData(STORAGE_KEY_PARTICIPANTS, participants);
        return newP;
    } else {
        const { data, error } = await supabase
            .from('participants')
            .insert([{
                room_code: roomCode,
                name,
                device_id: null,
                is_admin: false
            }])
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') throw new Error("Ya existe alguien con ese nombre");
            throw error;
        }
        return data;
    }
}

/**
 * User claims a participant slot.
 */
export const claimParticipant = async (participantId: string) => {
    const deviceId = getDeviceId();
    
    if (useMock || !supabase) {
        await mockDelay();
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        const pIndex = participants.findIndex((p: any) => p.id === participantId);
        
        if (pIndex === -1) throw new Error("Participante no encontrado");
        if (participants[pIndex].device_id && participants[pIndex].device_id !== deviceId) {
             throw new Error("Este nombre ya ha sido reclamado por otro dispositivo.");
        }

        participants[pIndex].device_id = deviceId;
        setMockData(STORAGE_KEY_PARTICIPANTS, participants);
        return participants[pIndex];
    } else {
        // Check if claimed first to avoid override if RLS allows update
        const { data: current } = await supabase.from('participants').select('device_id').eq('id', participantId).single();
        if (current?.device_id && current.device_id !== deviceId) {
            throw new Error("Este nombre ya ha sido reclamado.");
        }

        const { data, error } = await supabase
            .from('participants')
            .update({ device_id: deviceId })
            .eq('id', participantId)
            .select()
            .single();
        
        if (error) throw error;
        return data;
    }
}

/**
 * Logout / Release a participant.
 */
export const releaseParticipant = async (participantId: string) => {
    if (useMock || !supabase) {
        await mockDelay();
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        const pIndex = participants.findIndex((p: any) => p.id === participantId);
        if (pIndex !== -1) {
            participants[pIndex].device_id = null;
            setMockData(STORAGE_KEY_PARTICIPANTS, participants);
        }
    } else {
        const { error } = await supabase
            .from('participants')
            .update({ device_id: null })
            .eq('id', participantId);
        if (error) throw error;
    }
}


export const removeParticipant = async (id: string) => {
     if (useMock || !supabase) {
        await mockDelay();
        let participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        participants = participants.filter((p: any) => p.id !== id);
        setMockData(STORAGE_KEY_PARTICIPANTS, participants);
    } else {
        const { error } = await supabase.from('participants').delete().eq('id', id);
        if (error) throw error;
    }
}

export const saveAssignments = async (roomCode: string, assignments: Assignment[]) => {
  if (useMock || !supabase) {
      await mockDelay();
      const dbAssignments = assignments.map(a => ({
        id: generateUUID(),
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
        // Fix: Explicitly check and throw errors
        const { error: delError } = await supabase.from('assignments').delete().eq('room_code', roomCode);
        if (delError) throw delError;

        const { error: upError } = await supabase.from('rooms').update({ status: 'LOBBY' }).eq('code', roomCode);
        if (upError) throw upError;
    }
};

// --- Exclusions Logic ---

export const addExclusion = async (roomCode: string, giverId: string, receiverId: string) => {
    if (useMock || !supabase) {
        await mockDelay();
        const exclusions = getMockData(STORAGE_KEY_EXCLUSIONS);
        const newExclusion = {
            id: generateUUID(),
            room_code: roomCode,
            giver_id: giverId,
            receiver_id: receiverId
        };
        exclusions.push(newExclusion);
        setMockData(STORAGE_KEY_EXCLUSIONS, exclusions);
        return newExclusion;
    } else {
        const { data, error } = await supabase
            .from('exclusions')
            .insert([{ room_code: roomCode, giver_id: giverId, receiver_id: receiverId }])
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};

export const removeExclusion = async (exclusionId: string) => {
    if (useMock || !supabase) {
        await mockDelay();
        let exclusions = getMockData(STORAGE_KEY_EXCLUSIONS);
        exclusions = exclusions.filter((e: any) => e.id !== exclusionId);
        setMockData(STORAGE_KEY_EXCLUSIONS, exclusions);
    } else {
        const { error } = await supabase.from('exclusions').delete().eq('id', exclusionId);
        if (error) throw error;
    }
};

export const getExclusions = async (roomCode: string): Promise<Exclusion[]> => {
    if (useMock || !supabase) {
        const exclusions = getMockData(STORAGE_KEY_EXCLUSIONS);
        return exclusions
            .filter((e: any) => e.room_code === roomCode)
            .map((e: any) => ({
                id: e.id,
                giverId: e.giver_id,
                receiverId: e.receiver_id
            }));
    } else {
        const { data } = await supabase
            .from('exclusions')
            .select('id, giver_id, receiver_id')
            .eq('room_code', roomCode);
        
        return (data || []).map((row: any) => ({
            id: row.id,
            giverId: row.giver_id,
            receiverId: row.receiver_id
        }));
    }
};


// --- Getters ---

export const getSessionUser = async () => {
    const deviceId = getDeviceId();
    if (useMock || !supabase) {
        // Find latest participant for this device
        const participants = getMockData(STORAGE_KEY_PARTICIPANTS);
        const rooms = getMockData(STORAGE_KEY_ROOMS);
        
        // Match device ID and make sure it's valid
        const myEntries = participants.filter((p: any) => p.device_id === deviceId);
        if (myEntries.length === 0) return null;
        
        const user = myEntries[myEntries.length - 1]; // Last joined/claimed
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
