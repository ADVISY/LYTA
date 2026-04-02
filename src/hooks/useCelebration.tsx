import { useCallback, createContext, useContext, useState, ReactNode, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { toast } from '@/hooks/use-toast';

// Fun motivational messages by action type
const motivationalMessages = {
  contract_added: [
    "🎉 Nouveau contrat ajouté ! Tu gères !",
    "💪 Un contrat de plus dans la poche !",
    "🚀 Continue comme ça, champion !",
    "⭐ Excellent travail sur ce contrat !",
    "🔥 Tu es en feu aujourd'hui !",
  ],
  contract_signed: [
    "✍️ Contrat signé ! Belle victoire !",
    "🏆 Signature obtenue, bravo !",
    "💎 Un de plus dans le sac !",
  ],
  client_added: [
    "👤 Nouveau client enregistré !",
    "🌟 Un client de plus dans le portefeuille !",
    "📈 Ta liste de clients s'agrandit !",
  ],
  commission_received: [
    "💰 Cha-ching ! Commission validée !",
    "🤑 Les sous arrivent !",
    "💵 Belle commission, bien joué !",
  ],
  task_completed: [
    "✅ Tâche accomplie !",
    "👏 Bien joué, continue !",
    "🎯 Objectif atteint !",
  ],
  general_success: [
    "✨ Parfait !",
    "👍 C'est fait !",
    "🎊 Super !",
  ],
};

type ActionType = keyof typeof motivationalMessages;

interface SoundSettings {
  enabled: boolean;
  volume: number;
}

interface CelebrationContextType {
  celebrate: (actionType?: ActionType, showMessage?: boolean) => void;
  celebrateSmall: () => void;
  playSound: (type: 'success' | 'click' | 'notification') => void;
  soundSettings: SoundSettings;
  setSoundSettings: (settings: SoundSettings) => void;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(undefined);

// Sound URLs (using simple Web Audio API tones)
const createBeep = (frequency: number, duration: number, volume: number) => {
  if (typeof window === 'undefined') return;
  
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume * 0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.log('Audio not supported');
  }
};

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [soundSettings, setSoundSettingsState] = useState<SoundSettings>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('soundSettings');
      if (stored) {
        return JSON.parse(stored);
      }
    }
    return { enabled: true, volume: 0.5 };
  });

  useEffect(() => {
    localStorage.setItem('soundSettings', JSON.stringify(soundSettings));
  }, [soundSettings]);

  const setSoundSettings = useCallback((settings: SoundSettings) => {
    setSoundSettingsState(settings);
  }, []);

  const playSound = useCallback((type: 'success' | 'click' | 'notification') => {
    if (!soundSettings.enabled) return;
    
    switch (type) {
      case 'success':
        // Happy ascending tones
        createBeep(523, 0.1, soundSettings.volume); // C5
        setTimeout(() => createBeep(659, 0.1, soundSettings.volume), 100); // E5
        setTimeout(() => createBeep(784, 0.15, soundSettings.volume), 200); // G5
        break;
      case 'click':
        createBeep(800, 0.05, soundSettings.volume * 0.5);
        break;
      case 'notification':
        createBeep(880, 0.1, soundSettings.volume);
        setTimeout(() => createBeep(1047, 0.15, soundSettings.volume), 150);
        break;
    }
  }, [soundSettings]);

  const celebrate = useCallback((actionType: ActionType = 'general_success', showMessage = true) => {
    // Fire confetti
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });

    // Play success sound
    playSound('success');

    // Show motivational message
    if (showMessage) {
      const messages = motivationalMessages[actionType];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      toast({
        title: randomMessage,
        duration: 3000,
      });
    }
  }, [playSound]);

  const celebrateSmall = useCallback(() => {
    // Small sparkle effect
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347'],
      zIndex: 9999,
    });
    
    playSound('click');
  }, [playSound]);

  return (
    <CelebrationContext.Provider value={{ 
      celebrate, 
      celebrateSmall, 
      playSound, 
      soundSettings, 
      setSoundSettings 
    }}>
      {children}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (context === undefined) {
    throw new Error('useCelebration must be used within a CelebrationProvider');
  }
  return context;
}
