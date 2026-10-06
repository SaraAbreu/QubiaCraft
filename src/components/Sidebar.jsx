import React, { useState, useEffect } from 'react';
import './Sidebar.css';

const ICONS = {
  studio: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  strategy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8.5 14.5l2.2 2.2 4.8-4.8" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: 'studio', label: 'Estudio', matches: ['studio'] },
  { key: 'strategy', label: 'Estrategia', matches: ['strategy'] },
  { key: 'history', label: 'Historial', matches: ['history'] },
  { key: 'settings', label: 'Perfil de marca', matches: ['settings'] },
];

export default function Sidebar({ screen, onNavigate, user, onLogout }) {
  const [brandName, setBrandName] = useState('');

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(p => setBrandName(p?.nombre || ''))
      .catch(() => {});
  }, [screen]);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo-mark.png" alt="Qubia Craft" className="sidebar-logo-icon" />
        <div className="sidebar-logo-text">
          <span>Qubia<strong>Craft</strong></span>
          <small>Publicaciones con IA</small>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const active = item.matches.includes(screen);
          return (
            <button
              key={item.key}
              className={`sidebar-nav-btn ${active ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <span className="sidebar-nav-icon">{ICONS[item.key]}</span>
              <span className="sidebar-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="sidebar-nav-btn sidebar-logout" onClick={onLogout} title="Cerrar sesión">
        <span className="sidebar-nav-icon">{ICONS.logout}</span>
        <span className="sidebar-nav-label">Cerrar sesión</span>
      </button>

      <div className="sidebar-footer">
        {user && <p className="sidebar-user" title={user.email}>{user.name || user.email}</p>}
        {brandName ? (
          <div className="sidebar-brand-chip">
            <span className="sidebar-brand-dot" />
            <span className="sidebar-brand-name">{brandName}</span>
          </div>
        ) : (
          <p className="sidebar-hint">Configura tu perfil de marca para personalizar la IA</p>
        )}
      </div>
    </aside>
  );
}
