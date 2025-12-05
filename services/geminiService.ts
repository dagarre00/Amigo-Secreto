// Servicio de utilidades de texto (Anteriormente usaba IA, ahora usa lógica local)

const GROUP_NAMES = [
  "Amigos Invisibles",
  "Los Reyes Magos",
  "Elfos Navideños",
  "Intercambio Festivo",
  "Sorpresas S.A.",
  "Regalos y Risas",
  "Los Ayudantes de Santa",
  "El Club del Regalo",
  "Renso y Trineos"
];

const HINTS = [
  "¡Es alguien muy especial!",
  "Le gustan las buenas sorpresas.",
  "¡Prepárate para ver su sonrisa!",
  "Shhh... guarda bien el secreto.",
  "¡Va a alucinar con tu regalo!",
  "Asegúrate de envolverlo bien.",
  "¡Será un momento mágico!",
  "¡Le va a encantar lo que elegiste!",
  "Es alguien que conoces bien (o no...)",
  "¡La curiosidad mató al gato, pero no la sorpresa!"
];

export const generateGroupName = async (names: string[]): Promise<string> => {
  // Simula un pequeño retardo para mantener la UX de "pensando"
  return new Promise((resolve) => {
    setTimeout(() => {
        const randomName = GROUP_NAMES[Math.floor(Math.random() * GROUP_NAMES.length)];
        resolve(randomName);
    }, 500);
  });
};

export const generateFunnyHint = async (receiverName: string): Promise<string> => {
    // Simula un pequeño retardo para mantener la UX de "consultando"
    return new Promise((resolve) => {
        setTimeout(() => {
            const randomHint = HINTS[Math.floor(Math.random() * HINTS.length)];
            resolve(randomHint);
        }, 800);
    });
}