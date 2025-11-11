import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, X, Send, User, Bot, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import advisyLogo from "@/assets/advisy-logo.svg";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type UserType = "client" | "conseiller" | null;

export const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectUserType = (type: UserType) => {
    setUserType(type);
    
    const welcomeMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "assistant",
      content: type === "client"
        ? "Très bien 👌 je peux vous aider à :\n• Comprendre votre assurance maladie (LAMal)\n• Choisir ou optimiser vos complémentaires\n• Découvrir les avantages du 3e pilier\n• Être mis en contact avec un conseiller Advisy\n\nQue souhaitez-vous faire ?"
        : "Parfait 👨‍💼 je peux vous aider à :\n• Réviser vos notions d'assurance (LAMal, LPP, LAA…)\n• Trouver les bases légales d'un cas client\n• Travailler vos arguments commerciaux\n• Mémoriser les points clés pour l'AFA\n\nQuelle est votre question ?",
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const allMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: allMessages,
          conversationId,
          sessionId,
          userType,
        },
      });

      if (error) throw error;

      if (data?.message) {
        const assistantMessage: Message = {
          id: `msg_${Date.now()}`,
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, assistantMessage]);
        
        if (data.conversationId && !conversationId) {
          setConversationId(data.conversationId);
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setUserType(null);
    setConversationId(null);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl bg-[#1800AD] hover:bg-[#1800AD]/90 hover:scale-110 transition-all duration-300 z-50"
          aria-label="Ouvrir l'assistant IA"
        >
          <div className="relative">
            <Sparkles className="h-7 w-7 animate-pulse" />
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full animate-pulse" />
          </div>
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[380px] h-[600px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300 border border-slate-200 dark:border-slate-800">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#1800AD] to-[#2800CD] text-white p-4 flex items-center justify-between rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <img src={advisyLogo} alt="Advisy" className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Aivy</h3>
                <p className="text-xs text-white/80">Assistante Advisy</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* User Type Selection */}
            {!userType && messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-6">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#1800AD] to-[#2800CD] flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">
                    Bonjour 👋 je suis Aivy
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    L'assistante Advisy spécialisée en assurances suisses
                  </p>
                </div>

                <div className="space-y-3 w-full">
                  <Button
                    onClick={() => handleSelectUserType("client")}
                    className="w-full bg-white hover:bg-slate-50 text-slate-900 border-2 border-[#1800AD] hover:border-[#2800CD] transition-all duration-200 py-6 rounded-2xl font-medium"
                  >
                    💡 Je suis un client
                  </Button>
                  <Button
                    onClick={() => handleSelectUserType("conseiller")}
                    className="w-full bg-white hover:bg-slate-50 text-slate-900 border-2 border-[#1800AD] hover:border-[#2800CD] transition-all duration-200 py-6 rounded-2xl font-medium"
                  >
                    🎓 Je suis conseiller Advisy
                  </Button>
                </div>
              </div>
            )}

            {/* Messages */}
            {userType && (
              <>
                <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {message.role === "assistant" && (
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1800AD] to-[#2800CD] flex items-center justify-center flex-shrink-0">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2 max-w-[75%] ${
                            message.role === "user"
                              ? "bg-[#1800AD] text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        </div>
                        {message.role === "user" && (
                          <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1800AD] to-[#2800CD] flex items-center justify-center">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div className="rounded-2xl px-4 py-2 bg-slate-100 dark:bg-slate-800">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-slate-400" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Posez votre question..."
                      disabled={isLoading}
                      className="flex-1 rounded-full border-slate-300 dark:border-slate-700 focus:border-[#1800AD] dark:focus:border-[#2800CD]"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isLoading || !input.trim()}
                      className="rounded-full h-10 w-10 p-0 bg-[#1800AD] hover:bg-[#2800CD] transition-colors"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 mt-2 transition-colors"
                  >
                    Nouvelle conversation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};