
export interface Participant {
  id: string;
  name: string;
  is_admin: boolean;
  device_id: string | null;
}

export type Assignment = {
  giverId: string;
  receiverId: string;
};

export interface Exclusion {
  id: string;
  giverId: string;
  receiverId: string;
}

export type RoomStatus = 'LOBBY' | 'REVEAL';

export interface RoomState {
  code: string;
  status: RoomStatus;
}

export interface AlertState {
  type: 'success' | 'error' | 'info';
  message: string;
}
