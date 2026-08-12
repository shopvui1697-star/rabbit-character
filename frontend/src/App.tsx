/**
 * App - Main application component.
 * Routes between Login, Welcome, and MovieSearch pages.
 */

import React, { useState } from 'react';
import { AIProvider } from './ai/AIProvider';
import { VoiceIndicator } from './components/VoiceIndicator';
import { LoginForm } from './components/LoginForm';
import { MovieSearch } from './components/MovieSearch';
import { AIButton } from './components/ai';

type Page = 'login' | 'welcome' | 'movies';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [user, setUser] = useState('');

  const handleLoginSuccess = (username: string) => {
    setUser(username);
    setPage('welcome');
  };

  const handleLogout = () => {
    setUser('');
    setPage('login');
  };

  return (
    <AIProvider language="en-US">
      <div className="app">
        <div className={`app__content ${page === 'movies' ? 'app__content--wide' : ''}`}>
          {page === 'login' && (
            <LoginForm onLoginSuccess={handleLoginSuccess} />
          )}

          {page === 'welcome' && (
            <div className="app__welcome">
              <div className="app__welcome-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="#4ade80">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              </div>
              <h1>Welcome, {user}!</h1>
              <p>You have successfully logged in using voice commands.</p>
              <div className="app__welcome-actions">
                <AIButton
                  id="movies-btn"
                  label="Browse Movies"
                  onClick={() => setPage('movies')}
                  aiHints={['movies', 'browse movies', 'search movies', 'movie search', 'browse']}
                  variant="primary"
                />
                <AIButton
                  id="logout-btn"
                  label="Logout"
                  onClick={handleLogout}
                  aiHints={['logout', 'log out', 'sign out', 'signout', 'exit']}
                  variant="secondary"
                />
              </div>
            </div>
          )}

          {page === 'movies' && (
            <MovieSearch onBack={() => setPage('welcome')} />
          )}
        </div>

        <VoiceIndicator />
      </div>
    </AIProvider>
  );
}
