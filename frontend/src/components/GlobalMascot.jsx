import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function GlobalMascot() {
  const navigate = useNavigate();
  
  const handleClick = () => {
    const user = localStorage.getItem('user');
    if (user) {
      navigate('/chat');
    } else {
      navigate('/login');
    }
  };

  return (
    <div
      className="fixed bottom-0 right-0 md:bottom-4 md:right-4 w-[120px] h-[120px] md:w-[180px] md:h-[180px] z-[9000] pointer-events-auto cursor-pointer mascot-pulse rounded-full"
      aria-hidden="true"
      onClick={handleClick}
      title="Click to chat with AI"
    >
      <div className="relative w-full h-full">
        <img
          src="/assets/anhrobot.png"
          alt="mascot"
          className="w-full h-full object-contain drop-shadow-lg hover:drop-shadow-xl transition-all duration-300"
          loading="lazy"
        />
      </div>
    </div>
  );
}
