import React, { useState } from 'react';

export default function NotificationBell({ count = 5, onClick }) {
  const display = count > 99 ? "99+" : count;

  return (
    <button
      onClick={onClick}
      className="relative px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors flex items-center justify-center focus:outline-none"
      aria-label="Notifications"
    >
      {/* Bell Icon */}
      <svg 
        viewBox="0 0 24 24" 
        className="w-5 h-5" 
        fill="white" 
        stroke="white" 
        strokeWidth="0"
      >
        <path d="M12 2C10.9 2 10 2.9 10 4C10 4.1 10 4.2 10 4.3C7.6 5.1 6 7.4 6 10V16L4 18V19H20V18L18 16V10C18 7.4 16.4 5.1 14 4.3C14 4.2 14 4.1 14 4C14 2.9 13.1 2 12 2ZM10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20H10Z" />
      </svg>
      
      {/* Notification Badge */}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 bg-indigo-500 text-white text-[10px] font-semibold rounded-full shadow">
          {display}
        </span>
      )}
    </button>
  );
}