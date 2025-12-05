import { Participant, Assignment } from '../types';

/**
 * Creates a valid Secret Santa assignment where no one is assigned themselves.
 * Uses a single cycle method to guarantee strict derangement and a connected graph
 * (everyone gives to someone, everyone receives from someone).
 */
export const drawNames = (participants: Participant[]): Assignment[] => {
  if (participants.length < 2) {
    throw new Error("Se necesitan al menos 2 participantes.");
  }

  // Create a shallow copy and shuffle it randomly (Fisher-Yates)
  const shuffled = [...participants];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const assignments: Assignment[] = [];

  // Assign index i to index (i+1) % length
  // This forms a Hamiltonian cycle: A -> B -> C -> ... -> A
  for (let i = 0; i < shuffled.length; i++) {
    const giver = shuffled[i];
    const receiver = shuffled[(i + 1) % shuffled.length];
    
    assignments.push({
      giverId: giver.id,
      receiverId: receiver.id,
    });
  }

  return assignments;
};
