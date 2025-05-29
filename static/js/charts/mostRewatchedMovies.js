// static/js/mostRewatchedMovies.js
document.addEventListener('DOMContentLoaded', () => {
    const moviesContainer = document.getElementById('mostRewatchedMoviesContainer');
    const errorMessageElement = document.getElementById('mostRewatchedMoviesError');
    
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
    const POSTER_SIZE_NORMAL = 'w185';
    // const POSTER_SIZE_FULLSCREEN = 'w342'; // Not directly used here, but good for reference
    const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/185x278.png?text=No+Poster'; // Fallback

    async function fetchAndDisplayMostRewatched(limit = 5, container = moviesContainer, posterSize = POSTER_SIZE_NORMAL) {
        // console.log('[mostRewatchedMovies] fetchAndDisplayMostRewatched called with posterSize:', posterSize, 'limit:', limit); // For debugging

        if (!container) {
            console.error("Target container for rewatched movies is not defined.");
            return;
        }
        try {
            const response = await fetch(`/api/most-rewatched-movies?limit=${limit}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText}`);
            }
            const movies = await response.json();
            
            container.innerHTML = ''; // Clear previous content

            if (movies && movies.length > 0) {
                movies.forEach(movie => {
                    const card = document.createElement('div');
                    card.className = 'movie-card';
                    
                    // Use the passed posterSize for constructing the TMDB URL
                    const currentTmdbPosterSize = (typeof posterSize === 'string' && posterSize.startsWith('w')) ? posterSize : POSTER_SIZE_NORMAL;
                    
                    const posterUrl = movie.poster_path 
                                      ? `${IMAGE_BASE_URL}${currentTmdbPosterSize}${movie.poster_path}`
                                      : null; // Set to null if no poster_path to trigger placeholder logic directly if needed

                    let posterElement;
                    if (posterUrl) { // Check if posterUrl was successfully constructed
                        posterElement = document.createElement('img');
                        posterElement.className = 'poster';
                        posterElement.src = posterUrl;
                        posterElement.alt = `Poster for ${movie.title}`;
                        posterElement.onerror = function() { 
                            this.onerror=null; 
                            let fallbackSrc = PLACEHOLDER_IMAGE_URL; // Default placeholder

                            // Use the 'posterSize' from the closure, which was an argument to fetchAndDisplayMostRewatched
                            // This 'posterSize' dictates the desired dimensions for the placeholder.
                            if (typeof posterSize === 'string' && posterSize.startsWith('w')) {
                                const sizePart = posterSize.substring(1);
                                const width = parseInt(sizePart);
                                if (!isNaN(width)) {
                                    const height = Math.round(width * 1.5); // Maintain 2:3 aspect ratio
                                    // Replace '185x278' in the placeholder URL with new dimensions
                                    fallbackSrc = PLACEHOLDER_IMAGE_URL.replace('185x278', `${width}x${height}`);
                                }
                            }
                            this.src = fallbackSrc;
                            this.alt = 'Poster not available'; // Update alt text
                        };
                    } else { // No movie.poster_path or posterUrl couldn't be formed
                        posterElement = document.createElement('div');
                        posterElement.className = 'poster poster-placeholder';
                        posterElement.textContent = 'No Poster';
                        // Ensure placeholder div also respects aspect ratio (CSS should handle this with aspect-ratio: 2/3)
                    }
                    
                    let posterLinkElement;
                    if (movie.letterboxd_uri) {
                        posterLinkElement = document.createElement('a');
                        posterLinkElement.href = movie.letterboxd_uri;
                        posterLinkElement.target = '_blank'; 
                        posterLinkElement.rel = 'noopener noreferrer'; 
                        posterLinkElement.appendChild(posterElement); 
                    } else {
                        posterLinkElement = posterElement;
                    }
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'rewatch-info';

                    const rewatchCountP = document.createElement('p');
                    rewatchCountP.className = 'rewatch-count';
                    rewatchCountP.textContent = `${movie.rewatch_count} rewatch${movie.rewatch_count > 1 ? 'es' : ''}`;
                    
                    card.title = movie.title; 

                    infoDiv.appendChild(rewatchCountP);
                    
                    card.appendChild(posterLinkElement); 
                    card.appendChild(infoDiv);
                    container.appendChild(card);
                });
                if (errorMessageElement && container === moviesContainer) errorMessageElement.classList.add('hidden');
            } else {
                container.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No rewatched movies found.</p>`;
                 if (errorMessageElement && container === moviesContainer) errorMessageElement.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error fetching most rewatched movies:', error);
            if (errorMessageElement && container === moviesContainer) {
                errorMessageElement.textContent = 'Failed to load most rewatched movies. ' + error.message;
                errorMessageElement.classList.remove('hidden');
            }
            if (container) { 
                container.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading movies.</p>`;
            }
        }
    }

    // Initial load for dashboard view
    fetchAndDisplayMostRewatched(5, moviesContainer, POSTER_SIZE_NORMAL);

    window.MyAppGlobal = window.MyAppGlobal || {};
    window.MyAppGlobal.fetchAndDisplayMostRewatched = fetchAndDisplayMostRewatched;
});