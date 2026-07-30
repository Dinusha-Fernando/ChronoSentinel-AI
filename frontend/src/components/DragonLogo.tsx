import React from 'react';
import dragonLogoImg from '../assets/dragon-logo.png';

interface DragonLogoProps {
  className?: string;
  size?: number;
  showGlow?: boolean;
}

export const DragonLogo: React.FC<DragonLogoProps> = ({
  className = '',
  size = 32,
  showGlow = true,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: showGlow ? '0 0 16px rgba(139, 92, 246, 0.45)' : 'none',
      }}
    >
      <img
        src={dragonLogoImg}
        alt="ChronoSentinel Dragon Logo"
        className="w-full h-full object-cover rounded-xl transition-transform duration-300 hover:scale-105"
      />
    </div>
  );
};
export default DragonLogo;
