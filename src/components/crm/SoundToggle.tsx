import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCelebration } from "@/hooks/useCelebration";

export function SoundToggle() {
  const { soundSettings, setSoundSettings, playSound } = useCelebration();

  const toggleSound = () => {
    const newEnabled = !soundSettings.enabled;
    setSoundSettings({ ...soundSettings, enabled: newEnabled });
    if (newEnabled) {
      // Play a small sound to confirm it's on
      setTimeout(() => playSound('click'), 100);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSound}
          className="h-9 w-9"
        >
          {soundSettings.enabled ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          <span className="sr-only">
            {soundSettings.enabled ? "Désactiver les sons" : "Activer les sons"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {soundSettings.enabled ? "Sons activés" : "Sons désactivés"}
      </TooltipContent>
    </Tooltip>
  );
}
