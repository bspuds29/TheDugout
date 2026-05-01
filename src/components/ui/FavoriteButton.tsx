import { Star } from 'lucide-react';
import { useFavorites } from '../../hooks/usePlayerLists';
import './FavoriteButton.css';

interface Props {
  mlbId: number;
  name: string;
  teamAbbr?: string;
  position?: string;
  className?: string;
}

export default function FavoriteButton({ mlbId, name, teamAbbr, position, className = '' }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(mlbId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite({ id: mlbId, name, teamAbbr, position });
  };

  return (
    <button
      className={`fav-btn ${fav ? 'fav-btn--on' : ''} ${className}`}
      onClick={handleClick}
      title={fav ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-label={fav ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={fav}
    >
      <Star size={15} fill={fav ? 'currentColor' : 'none'} strokeWidth={fav ? 2 : 2.2} />
    </button>
  );
}
