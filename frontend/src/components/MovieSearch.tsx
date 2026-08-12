/**
 * MovieSearch - Voice-controlled movie search page.
 *
 * Registers its own AI patterns and handlers via useAIContext.
 * When this component unmounts, all movie-specific voice commands are removed.
 *
 * Voice commands:
 *   "search matrix"          → search for movies
 *   "select number 3"        → select card by number
 *   "next" / "previous"      → navigate cards
 *   "tell me about this"     → read selected movie details
 *   "back"                   → go to home
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { AIInput, AIButton } from './ai';
import { MovieCard, Movie } from './MovieCard';
import { UIRegistry } from '../ai/UIRegistry';
import { useAIField } from '../hooks/useAIField';
import { useAIContext } from '../hooks/useAIContext';
import { ActionExecutor } from '../ai/ActionExecutor';

interface MovieSearchProps {
  onBack: () => void;
}

export function MovieSearch({ onBack }: MovieSearchProps) {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Register "selected movie" as a readable AI field
  useAIField({
    id: 'selected-movie',
    type: 'input',
    label: 'Selected Movie',
    aiHints: ['this', 'this movie', 'selected', 'current movie'],
    actions: [],
    isActive: !!selectedMovie,
    getValue: () => selectedMovie ? JSON.stringify(selectedMovie) : '',
  });

  // ─── Callbacks ─────────────────────────────────────────────────────

  const fetchMovies = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setHasSearched(true);
    try {
      const params = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/movies${params}`);
      const data = await res.json();
      if (data.success) {
        setMovies(data.movies);
        setSelectedMovie(null);
        if (data.movies.length > 0) {
          UIRegistry.reportError({
            message: `Found ${data.movies.length} movie${data.movies.length !== 1 ? 's' : ''}${searchQuery ? ` for "${searchQuery}"` : ''}. Say a movie name or "select number 1" to pick one.`,
            timestamp: Date.now(),
          });
        } else {
          UIRegistry.reportError({
            message: `No movies found for "${searchQuery}". Try a different search.`,
            timestamp: Date.now(),
          });
        }
      }
    } catch {
      UIRegistry.reportError({ message: 'Cannot connect to server.', timestamp: Date.now() });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearch = useCallback(() => { fetchMovies(query); }, [query, fetchMovies]);

  const handleSelect = useCallback((movie: Movie) => {
    setSelectedMovie((prev) => prev?.id === movie.id ? null : movie);
  }, []);

  const handleNav = useCallback((direction: 'next' | 'prev') => {
    if (movies.length === 0) return;
    const currentIdx = selectedMovie ? movies.findIndex((m) => m.id === selectedMovie.id) : -1;
    let nextIdx: number;
    if (direction === 'next') {
      nextIdx = currentIdx < movies.length - 1 ? currentIdx + 1 : 0;
    } else {
      nextIdx = currentIdx > 0 ? currentIdx - 1 : movies.length - 1;
    }
    setSelectedMovie(movies[nextIdx]);
  }, [movies, selectedMovie]);

  // ─── Register page-specific AI context ─────────────────────────────

  const aiHandlers = useMemo(() => ({
    search: (e: any) => {
      const searchInput = UIRegistry.getAll().find((el) => el.id === 'movie-query');
      const searchBtn = UIRegistry.getAll().find((el) => el.id === 'search-btn');
      if (!searchInput || !searchBtn) {
        return ActionExecutor.reply(false, 'Search is not available.');
      }
      searchInput.setValue?.(e.value || '');
      searchBtn.triggerAction?.('click');
      return ActionExecutor.reply(true, `Searching for "${e.value}".`);
    },

    navigate: (e: any) => {
      const btn = e.action === 'next'
        ? UIRegistry.getAll().find((el) => el.id === 'next-btn')
        : UIRegistry.getAll().find((el) => el.id === 'prev-btn');
      if (!btn) return ActionExecutor.reply(false, 'Navigation is not available.');
      btn.triggerAction?.('click');
      return ActionExecutor.reply(true, e.action === 'next' ? 'Next.' : 'Previous.');
    },

    read_details: () => {
      const sel = UIRegistry.getById('selected-movie');
      if (!sel) return ActionExecutor.reply(false, 'No movie page is open.');
      const raw = sel.getValue();
      if (!raw) return ActionExecutor.reply(false, 'No movie is selected. Say "select number 1" to pick one.');
      try {
        const m = JSON.parse(raw);
        return ActionExecutor.reply(true, `${m.title}, ${m.year}. ${m.genre}. Rated ${m.rating}. Directed by ${m.director}. ${m.description}`);
      } catch {
        return ActionExecutor.reply(false, 'Could not read movie details.');
      }
    },
  }), []);

  useAIContext('movie-search', {
    patterns: [
      // Search: "search matrix", "find sci-fi"
      {
        intent: 'search',
        patterns: [
          /^(?:search|find|look\s+for|look\s+up|search\s+for)\s+(.+)/i,
        ],
        extractEntities: (match) => ({ value: match[1]?.trim(), action: 'search' }),
      },
      // Navigate: "next", "previous"
      {
        intent: 'navigate',
        patterns: [
          /^(?:next|forward|down|next\s+one|next\s+movie)$/i,
          /^(?:previous|prev|up|last\s+one|previous\s+movie)$/i,
        ],
        extractEntities: (match) => ({
          action: match[0].match(/^(?:next|forward|down)/i) ? 'next' : 'prev',
        }),
      },
      // Read details: "tell me about this", "details"
      {
        intent: 'read_details',
        patterns: [
          /^(?:tell\s+me\s+about|describe|details|info|information|about)\s*(?:this|it|that|the\s+movie)?$/i,
          /^(?:what(?:'s|\s+is)\s+(?:this|it|that)\s+(?:movie\s+)?(?:about)?)$/i,
        ],
        extractEntities: () => ({ action: 'read_details' }),
      },
    ],
    handlers: aiHandlers,
  });

  // Load all movies on mount
  useEffect(() => { fetchMovies(''); }, []);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="movie-search">
      <div className="movie-search__header">
        <AIButton
          id="back-btn"
          label="Back"
          onClick={onBack}
          aiHints={['back', 'go back', 'home', 'return']}
          variant="ghost"
          className="movie-search__back-btn"
        />
        <h1 className="movie-search__title">Movie Search</h1>
      </div>

      <div className="movie-search__bar">
        <AIInput
          id="movie-query"
          label="Search"
          value={query}
          onChange={setQuery}
          aiHints={['search', 'find', 'look for', 'movie search', 'query']}
          placeholder='Say "search matrix" or type here'
        />
        <AIButton
          id="search-btn"
          label="Search"
          onClick={handleSearch}
          aiHints={['search', 'find', 'look', 'go']}
          variant="primary"
          loading={isLoading}
          className="movie-search__search-btn"
        />
      </div>

      <div className="movie-search__nav">
        <AIButton
          id="prev-btn"
          label="Previous"
          onClick={() => handleNav('prev')}
          aiHints={['previous', 'prev', 'before', 'up']}
          variant="ghost"
          disabled={movies.length === 0}
          className="movie-search__nav-btn"
        />
        <span className="movie-search__count">
          {selectedMovie
            ? `${movies.findIndex((m) => m.id === selectedMovie.id) + 1} / ${movies.length}`
            : `${movies.length} movies`}
        </span>
        <AIButton
          id="next-btn"
          label="Next"
          onClick={() => handleNav('next')}
          aiHints={['next', 'after', 'down', 'forward']}
          variant="ghost"
          disabled={movies.length === 0}
          className="movie-search__nav-btn"
        />
      </div>

      <div className="movie-search__grid">
        {movies.map((movie, i) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            index={i}
            isSelected={selectedMovie?.id === movie.id}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {hasSearched && movies.length === 0 && !isLoading && (
        <div className="movie-search__empty">
          No movies found. Try "search action" or "search nolan".
        </div>
      )}

      <div className="movie-search__hint">
        <strong>Voice commands:</strong> "search matrix", "select number 3", "next", "previous", "tell me about this", "back"
      </div>
    </div>
  );
}
