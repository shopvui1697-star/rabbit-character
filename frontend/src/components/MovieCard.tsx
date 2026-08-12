/**
 * MovieCard - AI-aware movie card component.
 *
 * Voice commands:
 *   "select matrix"         → selects the card
 *   "select number 3"       → selects card #3
 *   "next" / "previous"     → navigate between cards
 *   "tell me about matrix"  → read movie details
 */

import React, { useEffect } from 'react';
import { useAIField } from '../hooks/useAIField';

export interface Movie {
  id: number;
  title: string;
  year: number;
  genre: string;
  rating: number;
  director: string;
  poster: string;
  description: string;
}

interface MovieCardProps {
  movie: Movie;
  index: number;
  isSelected: boolean;
  onSelect: (movie: Movie) => void;
}

export function MovieCard({ movie, index, isSelected, onSelect }: MovieCardProps) {
  // Register with AI system so voice can select/read this card
  useAIField({
    id: `movie-${movie.id}`,
    type: 'button',
    label: movie.title,
    aiHints: [
      movie.title.toLowerCase(),
      `number ${index + 1}`,
      `movie ${index + 1}`,
      `card ${index + 1}`,
      movie.genre.toLowerCase(),
      movie.director.toLowerCase(),
    ],
    getValue: () => JSON.stringify({
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      rating: movie.rating,
      director: movie.director,
      description: movie.description,
    }),
    triggerAction: () => onSelect(movie),
  });

  return (
    <div
      className={`movie-card ${isSelected ? 'movie-card--selected' : ''}`}
      onClick={() => onSelect(movie)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(movie); }}
      aria-label={`${movie.title} (${movie.year})`}
      aria-selected={isSelected}
    >
      <div className="movie-card__number">{index + 1}</div>
      <div className="movie-card__poster">
        <img src={movie.poster} alt={movie.title} loading="lazy" />
        <div className="movie-card__rating">{movie.rating}</div>
      </div>
      <div className="movie-card__info">
        <h3 className="movie-card__title">{movie.title}</h3>
        <div className="movie-card__meta">
          <span className="movie-card__year">{movie.year}</span>
          <span className="movie-card__genre">{movie.genre}</span>
        </div>
        <p className="movie-card__director">{movie.director}</p>
      </div>
      {isSelected && (
        <div className="movie-card__detail">
          <p className="movie-card__description">{movie.description}</p>
        </div>
      )}
    </div>
  );
}
