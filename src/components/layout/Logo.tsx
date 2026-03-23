import React from 'react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="eyeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" /> {/* Electric Blue */}
          <stop offset="100%" stopColor="#8b5cf6" /> {/* Deep Purple */}
        </linearGradient>
        <linearGradient id="coreGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f97316" /> {/* Energetic Orange */}
          <stop offset="100%" stopColor="#facc15" /> {/* Vibrant Yellow/Amber */}
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer abstract eye/network shape */}
      <path 
        d="M50 15C20 15 5 50 5 50C5 50 20 85 50 85C80 85 95 50 95 50C95 50 80 15 50 15Z" 
        stroke="url(#eyeGradient)" 
        strokeWidth="7" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        fill="transparent"
      />
      
      {/* Inner glowing core representing collective consciousness/prediction */}
      <circle 
        cx="50" 
        cy="50" 
        r="15" 
        fill="url(#coreGradient)" 
        filter="url(#glow)"
      />

      {/* Tech ring around the core */}
      <circle 
        cx="50" 
        cy="50" 
        r="24" 
        stroke="#3b82f6" 
        strokeWidth="2.5"
        strokeOpacity="0.5"
        strokeDasharray="6 6"
        fill="transparent"
      />
      
      {/* Inner dark center (pupil) to give focus */}
      <circle 
        cx="50" 
        cy="50" 
        r="5" 
        fill="#ffffff" 
        opacity="0.9"
      />
    </svg>
  );
}
