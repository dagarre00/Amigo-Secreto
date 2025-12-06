import { Participant, Assignment, Exclusion } from '../types';

/**
 * Creates a valid Secret Santa assignment where:
 * 1. No one is assigned themselves.
 * 2. Everyone gives exactly one gift and receives exactly one gift.
 * 3. Specific exclusions are respected (A cannot give to B).
 * 
 * Uses a randomized Hamiltonian cycle approach with retries.
 */
export const drawNames = (participants: Participant[], exclusions: Exclusion[] = []): Assignment[] => {
  if (participants.length < 2) {
    throw new Error("Se necesitan al menos 2 participantes.");
  }

  const MAX_ATTEMPTS = 2000;
  
  // Create a lookup set for O(1) checking: "giverId-receiverId"
  const exclusionSet = new Set(exclusions.map(e => `${e.giverId}-${e.receiverId}`));

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // 1. Shuffle participants
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // 2. Try to form a chain: p[0]->p[1]->...->p[n]->p[0]
    const assignments: Assignment[] = [];
    let isValid = true;

    for (let i = 0; i < shuffled.length; i++) {
      const giver = shuffled[i];
      const receiver = shuffled[(i + 1) % shuffled.length];

      // Check self-assignment (implicit in logic, but good for sanity)
      if (giver.id === receiver.id) {
        isValid = false;
        break;
      }

      // Check Exclusions
      if (exclusionSet.has(`${giver.id}-${receiver.id}`)) {
        isValid = false;
        break;
      }
      
      assignments.push({
        giverId: giver.id,
        receiverId: receiver.id,
      });
    }

    if (isValid) {
      return assignments;
    }
  }

  throw new Error("No se pudo generar un sorteo válido con las restricciones actuales. Intenta eliminar algunas exclusiones.");
};