import { type SyntheticEvent, useCallback, useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { cn } from './ui/utils';
import { getPromoImageMaxHeightClass } from '../utils/eventPromoImage';

const DEFAULT_MAX_H = 'max-h-56';

type EventPromoImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
};

/**
 * Promo/banner image: `object-contain` so nothing is cropped; max height tier
 * updates after load from intrinsic aspect ratio.
 */
export function EventPromoImage({ src, alt, className, loading = 'lazy' }: EventPromoImageProps) {
  const [maxHeightClass, setMaxHeightClass] = useState<string>(DEFAULT_MAX_H);
  const [didError, setDidError] = useState(false);

  const handleLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w > 0 && h > 0) {
      setMaxHeightClass(getPromoImageMaxHeightClass(w / h));
    }
  }, []);

  const handleError = useCallback(() => {
    setDidError(true);
  }, []);

  if (didError) return null;

  return (
    <div className={cn('flex w-full justify-center', className)}>
      {/* `inline-block` + `w-auto` image so the frame hugs the bitmap — no full-width pillarboxing */}
      <div className="inline-block min-h-[4rem] max-w-full overflow-hidden rounded-lg border border-border/60 bg-muted/30">
        <ImageWithFallback
          src={src}
          alt={alt}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          className={cn('block h-auto w-auto max-w-full object-contain', maxHeightClass)}
        />
      </div>
    </div>
  );
}
