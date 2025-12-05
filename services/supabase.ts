import { createClient } from '@supabase/supabase-js';
import { Participant, Assignment } from '../types';

// Support both standard Vite environment variables and process.env for other environments
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

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Check your .env file or Vercel environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- Utils ---
export const getDeviceId = () => {
  let id = localStorage.getItem('ai_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('ai_device_id', id);
  }
  return id;
};

// --- Actions ---

export const createRoom = async (adminName: string) => {
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const deviceId = getDeviceId();

  // 1. Create Room
  const { error: roomError } = await supabase
    .from('rooms')
    .insert([{ code, status: 'LOBBY' }]);

  if (roomError) throw roomError;

  // 2. Add Admin
  const { data: user, error: userError } = await supabase
    .from('participants')
    .insert([{ 
      room_code: code, 
      name: adminName, 
      device_id: deviceId, 
      is_admin: true 
    }])
    .select()
    .single();

  if (userError) throw userError;
  return { code, user };
};

export const joinRoom = async (code: string, name: string) => {
  const deviceId = getDeviceId();

  // Check if room exists
  const { data: room, error: roomCheck } = await supabase
    .from('rooms')
    .select('status')
    .eq('code', code)
    .single();

  if (roomCheck || !room) throw new Error("Sala no encontrada");

  // Check if user already exists (reconnect)
  const { data: existing } = await supabase
    .from('participants')
    .select()
    .eq('room_code', code)
    .eq('device_id', deviceId)
    .single();

  if (existing) return existing;

  if (room.status !== 'LOBBY') throw new Error("El sorteo ya ha comenzado");

  // Create new participant
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
};

export const saveAssignments = async (roomCode: string, assignments: Assignment[]) => {
  // 1. Save assignments
  const dbAssignments = assignments.map(a => ({
    room_code: roomCode,
    giver_id: a.giverId,
    receiver_id: a.receiverId
  }));

  const { error: assignError } = await supabase.from('assignments').insert(dbAssignments);
  if (assignError) throw assignError;

  // 2. Update room status
  const { error: roomError } = await supabase
    .from('rooms')
    .update({ status: 'REVEAL' })
    .eq('code', roomCode);

  if (roomError) throw roomError;
};

export const resetRoom = async (roomCode: string) => {
  // Delete assignments
  await supabase.from('assignments').delete().eq('room_code', roomCode);
  // Reset status
  await supabase.from('rooms').update({ status: 'LOBBY' }).eq('code', roomCode);
};

export const getMyReceiver = async (roomCode: string, myId: string) => {
  const { data } = await supabase
    .from('assignments')
    .select('receiver_id')
    .eq('room_code', roomCode)
    .eq('giver_id', myId)
    .single();
  
  return data?.receiver_id;
};