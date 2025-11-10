import { MessageCircle } from "lucide-react";

export const WhatsAppButton = () => {
  const phoneNumber = "+41782122360"; // Format sans espaces pour WhatsApp
  const message = "Bonjour, je souhaite obtenir des informations sur vos services.";
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-full shadow-glow hover:shadow-[0_0_60px_rgba(37,211,102,0.6)] flex items-center justify-center transition-all duration-300 hover:scale-110 group"
      aria-label="Contacter via WhatsApp"
    >
      <MessageCircle className="w-8 h-8 group-hover:scale-110 transition-transform" />
      
      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></span>
    </a>
  );
};
