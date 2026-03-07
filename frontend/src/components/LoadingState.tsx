import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const steps = [
  { emoji: "🔍", text: "Scraping product information..." },
  { emoji: "✍️", text: "Generating ad copy variations..." },
  { emoji: "🎨", text: "Creating ad images..." },
];

const LoadingState = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <div className="space-y-3 text-center">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 justify-center text-sm font-medium transition-all duration-500 ${
              i === currentStep
                ? "text-foreground scale-105"
                : i < currentStep
                ? "text-muted-foreground"
                : "text-muted-foreground/40"
            }`}
          >
            <span className="text-lg">{step.emoji}</span>
            <span>{step.text}</span>
            {i === currentStep && (
              <span className="animate-pulse-slow">●</span>
            )}
            {i < currentStep && <span className="text-primary">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingState;
