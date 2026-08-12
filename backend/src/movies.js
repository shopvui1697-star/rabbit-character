/**
 * Movies dummy data and search logic.
 */

const MOVIES = [
  { id: 1,  title: 'The Matrix',            year: 1999, genre: 'Sci-Fi',    rating: 8.7, director: 'Wachowskis',        poster: 'https://picsum.photos/seed/matrix/300/450',    description: 'A hacker discovers reality is a simulation and joins a rebellion against its controllers.' },
  { id: 2,  title: 'Inception',             year: 2010, genre: 'Sci-Fi',    rating: 8.8, director: 'Christopher Nolan',  poster: 'https://picsum.photos/seed/inception/300/450',  description: 'A thief who steals secrets through dream-sharing technology is given a task to plant an idea.' },
  { id: 3,  title: 'Interstellar',          year: 2014, genre: 'Sci-Fi',    rating: 8.6, director: 'Christopher Nolan',  poster: 'https://picsum.photos/seed/interstellar/300/450', description: 'A team of explorers travel through a wormhole in space to ensure humanity\'s survival.' },
  { id: 4,  title: 'The Dark Knight',       year: 2008, genre: 'Action',    rating: 9.0, director: 'Christopher Nolan',  poster: 'https://picsum.photos/seed/darkknight/300/450', description: 'Batman must accept one of the greatest tests of his ability to fight injustice.' },
  { id: 5,  title: 'Pulp Fiction',          year: 1994, genre: 'Crime',     rating: 8.9, director: 'Quentin Tarantino',  poster: 'https://picsum.photos/seed/pulpfiction/300/450', description: 'The lives of two mob hitmen, a boxer, and a pair of bandits intertwine in tales of violence and redemption.' },
  { id: 6,  title: 'Forrest Gump',          year: 1994, genre: 'Drama',     rating: 8.8, director: 'Robert Zemeckis',    poster: 'https://picsum.photos/seed/forrestgump/300/450', description: 'The story of a man with a low IQ who accomplishes great things in life.' },
  { id: 7,  title: 'Fight Club',            year: 1999, genre: 'Drama',     rating: 8.8, director: 'David Fincher',      poster: 'https://picsum.photos/seed/fightclub/300/450',  description: 'An insomniac office worker and a soap salesman build an underground fight club.' },
  { id: 8,  title: 'The Shawshank Redemption', year: 1994, genre: 'Drama', rating: 9.3, director: 'Frank Darabont',     poster: 'https://picsum.photos/seed/shawshank/300/450',  description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption.' },
  { id: 9,  title: 'The Godfather',         year: 1972, genre: 'Crime',     rating: 9.2, director: 'Francis Ford Coppola', poster: 'https://picsum.photos/seed/godfather/300/450', description: 'The aging patriarch of an organized crime dynasty transfers control to his reluctant youngest son.' },
  { id: 10, title: 'Goodfellas',            year: 1990, genre: 'Crime',     rating: 8.7, director: 'Martin Scorsese',    poster: 'https://picsum.photos/seed/goodfellas/300/450', description: 'The story of Henry Hill and his life in the mob.' },
  { id: 11, title: 'Spirited Away',         year: 2001, genre: 'Animation', rating: 8.6, director: 'Hayao Miyazaki',     poster: 'https://picsum.photos/seed/spirited/300/450',   description: 'A young girl enters a world ruled by gods, witches, and spirits to save her parents.' },
  { id: 12, title: 'Parasite',              year: 2019, genre: 'Thriller',  rating: 8.5, director: 'Bong Joon-ho',       poster: 'https://picsum.photos/seed/parasite/300/450',   description: 'Greed and class discrimination threaten the relationship between two families.' },
  { id: 13, title: 'Avengers: Endgame',     year: 2019, genre: 'Action',    rating: 8.4, director: 'Russo Brothers',     poster: 'https://picsum.photos/seed/endgame/300/450',    description: 'The Avengers assemble once more to reverse the damage done by Thanos.' },
  { id: 14, title: 'Jurassic Park',         year: 1993, genre: 'Adventure', rating: 8.2, director: 'Steven Spielberg',   poster: 'https://picsum.photos/seed/jurassic/300/450',   description: 'A theme park of cloned dinosaurs turns into a nightmare when the creatures escape.' },
  { id: 15, title: 'Titanic',               year: 1997, genre: 'Romance',   rating: 7.9, director: 'James Cameron',      poster: 'https://picsum.photos/seed/titanic/300/450',    description: 'A seventeen-year-old aristocrat falls in love with a kind but poor artist aboard the luxurious, ill-fated ship.' },
  { id: 16, title: 'The Lion King',         year: 1994, genre: 'Animation', rating: 8.5, director: 'Roger Allers',       poster: 'https://picsum.photos/seed/lionking/300/450',   description: 'A young lion prince flees his kingdom only to learn the true meaning of responsibility and bravery.' },
  { id: 17, title: 'Gladiator',             year: 2000, genre: 'Action',    rating: 8.5, director: 'Ridley Scott',       poster: 'https://picsum.photos/seed/gladiator/300/450',  description: 'A former Roman general sets out to exact vengeance against the emperor who murdered his family.' },
  { id: 18, title: 'The Silence of the Lambs', year: 1991, genre: 'Thriller', rating: 8.6, director: 'Jonathan Demme', poster: 'https://picsum.photos/seed/lambs/300/450',      description: 'A young FBI cadet must receive the help of an incarcerated cannibal killer.' },
];

function searchMovies(query, genre, sort) {
  let results = [...MOVIES];

  if (query) {
    const q = query.toLowerCase();
    results = results.filter((m) =>
      m.title.toLowerCase().includes(q) ||
      m.director.toLowerCase().includes(q) ||
      m.genre.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    );
  }

  if (genre) {
    const g = genre.toLowerCase();
    results = results.filter((m) => m.genre.toLowerCase() === g);
  }

  if (sort === 'rating') results.sort((a, b) => b.rating - a.rating);
  else if (sort === 'year') results.sort((a, b) => b.year - a.year);
  else if (sort === 'title') results.sort((a, b) => a.title.localeCompare(b.title));

  return results;
}

function getMovieById(id) {
  return MOVIES.find((m) => m.id === id) || null;
}

export { searchMovies, getMovieById, MOVIES };
