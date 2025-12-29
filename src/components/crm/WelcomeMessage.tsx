import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, PartyPopper, Trophy, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeMessageProps {
  firstName?: string | null;
  lastName?: string | null;
  type?: "login" | "contract_deposit";
  onClose: () => void;
}

const loginMessages = [
  "Prêt à conquérir de nouveaux sommets aujourd'hui ?",
  "Une nouvelle journée pleine d'opportunités !",
  "Vos clients vous attendent, montrez votre talent !",
  "C'est parti pour une journée exceptionnelle !",
];

const contractMessages = [
  "Bravo ! Encore un client satisfait grâce à vous !",
  "Excellent travail ! Vous êtes en feu ! 🔥",
  "Un contrat de plus ! Continuez comme ça !",
  "Superbe ! Votre équipe peut être fière de vous !",
  "Magnifique ! Vous faites la différence !",
];

export function WelcomeMessage({
  firstName,
  lastName,
  type = "login",
  onClose,
}: WelcomeMessageProps) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const messages = type === "login" ? loginMessages : contractMessages;
    const randomIndex = Math.floor(Math.random() * messages.length);
    setMessage(messages[randomIndex]);

    // Auto-close after 5 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for animation
    }, 5000);

    return () => clearTimeout(timer);
  }, [type, onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const name = firstName ? `${firstName}${lastName ? ` ${lastName}` : ""}` : "Utilisateur";
  const greeting = type === "login" ? `Bonjour ${name} !` : `Félicitations ${firstName || name} !`;
  const Icon = type === "login" ? Sparkles : PartyPopper;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
        >
          <div className="mx-4 bg-gradient-to-r from-primary to-primary-light text-primary-foreground rounded-xl shadow-strong p-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
            </div>

            <div className="relative flex items-start gap-3">
              <div className="flex-shrink-0">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                >
                  <Icon className="h-8 w-8" />
                </motion.div>
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg">{greeting}</h3>
                <p className="text-sm opacity-90 mt-1">{message}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="flex-shrink-0 h-8 w-8 text-primary-foreground hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 5, ease: "linear" }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 origin-left"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Simpler toast-like message for contract deposit
export function ContractDepositToast({
  firstName,
  onClose,
}: {
  firstName?: string | null;
  onClose: () => void;
}) {
  const emojis = ["🎉", "🚀", "💪", "⭐", "🏆"];
  const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  const messages = contractMessages;
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];

  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl shadow-strong p-4 max-w-sm"
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{randomEmoji}</span>
        <div>
          <p className="font-bold">
            Bravo{firstName ? ` ${firstName}` : ""} !
          </p>
          <p className="text-sm opacity-90">{randomMessage}</p>
        </div>
      </div>
    </motion.div>
  );
}
