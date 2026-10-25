import React, { useState } from 'react';

interface LogoProps {
  src?: string;
  fallback?: string;
  size?: number;
  className?: string;
  alt?: string;
}

// Image avec repli (emoji) si le logo est indisponible
export const Logo: React.FC<LogoProps> = ({ src, fallback = '⚽', size = 20, className = '', alt = '' }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`inline-flex items-center justify-center select-none shrink-0 ${className}`} style={{ width: size, height: size, fontSize: size * 0.8 }} aria-hidden="true">
        {fallback}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-contain shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
