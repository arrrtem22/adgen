import { CheckCircle, Circle, Eye, MousePointerClick, BarChart3 } from "lucide-react";

interface Ad {
  id: string;
  angle: string;
  persona: string;
  headline: string;
  copy: string;
  image_url: string;
  mock_metrics: {
    ctr: number;
    impressions: number;
    clicks: number;
  };
}

interface AdCardProps {
  ad: Ad;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  index: number;
}

const AdCard = ({ ad, selected, onToggleSelect, index }: AdCardProps) => {
  return (
    <div
      className={`relative rounded-lg overflow-hidden card-shadow transition-all duration-300 hover:card-shadow-hover hover:-translate-y-1 border-2 bg-card ${
        selected ? "border-primary" : "border-transparent"
      }`}
      style={{ animationDelay: `${index * 120}ms` }}
    >
      {/* Select checkbox */}
      <button
        onClick={() => onToggleSelect(ad.id)}
        className="absolute top-3 right-3 z-10 transition-transform duration-200 hover:scale-110"
        title="Select Winner"
      >
        {selected ? (
          <CheckCircle className="w-7 h-7 text-primary drop-shadow-md" fill="hsl(var(--primary))" stroke="hsl(var(--primary-foreground))" />
        ) : (
          <Circle className="w-7 h-7 text-muted-foreground/60 drop-shadow-md" />
        )}
      </button>

      {/* Image */}
      <div className="aspect-square bg-muted overflow-hidden">
        <img
          src={ad.image_url}
          alt={ad.headline}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="font-semibold text-card-foreground leading-snug text-sm">{ad.copy}</p>
        <p className="text-xs text-muted-foreground">{ad.headline}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
            {ad.angle}
          </span>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary/10 text-secondary">
            {ad.persona}
          </span>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <BarChart3 className="w-3 h-3" />
            </div>
            <p className="text-sm font-bold text-foreground">{ad.mock_metrics.ctr}%</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CTR</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <Eye className="w-3 h-3" />
            </div>
            <p className="text-sm font-bold text-foreground">{ad.mock_metrics.impressions.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Impr.</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
              <MousePointerClick className="w-3 h-3" />
            </div>
            <p className="text-sm font-bold text-foreground">{ad.mock_metrics.clicks}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Clicks</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdCard;
export type { Ad };
