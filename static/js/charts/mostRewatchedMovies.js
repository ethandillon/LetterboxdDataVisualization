// static/js/mostRewatchedMovies.js
document.addEventListener('DOMContentLoaded', () => {
    const moviesContainer = document.getElementById('mostRewatchedMoviesContainer');
    const errorMessageElement = document.getElementById('mostRewatchedMoviesError');
    
    // Configuration
    const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';
    const POSTER_SIZE_NORMAL = 'w185';
    const POSTER_SIZE_FULLSCREEN = 'w342'; // Or 'w500'
    const PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/185x278.png?text=No+Poster'; // Fallback

    async function fetchAndDisplayMostRewatched(limit = 5, container = moviesContainer, posterSize = POSTER_SIZE_NORMAL) {
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
                    
                    const posterUrl = movie.poster_path 
                                      ? `${IMAGE_BASE_URL}${posterSize}${movie.poster_path}`
                                      : PLACEHOLDER_IMAGE_URL;

                    let posterElement;
                    if (movie.poster_path) {
                        posterElement = document.createElement('img');
                        posterElement.className = 'poster';
                        posterElement.src = posterUrl;
                        posterElement.alt = `Poster for ${movie.title}`;
                        posterElement.onerror = function() { 
                            this.onerror=null; 
                            this.src=PLACEHOLDER_IMAGE_URL.replace('185x278', `${posterSize.substring(1)}x${Math.round(parseInt(posterSize.substring(1)) * 1.5)}`);
                        };
                    } else {
                        posterElement = document.createElement('div');
                        posterElement.className = 'poster poster-placeholder';
                        posterElement.textContent = 'No Poster';
                    }
                    
                    // Create an anchor element for the poster
                    let posterLinkElement;
                    if (movie.letterboxd_uri) {
                        posterLinkElement = document.createElement('a');
                        posterLinkElement.href = movie.letterboxd_uri;
                        posterLinkElement.target = '_blank'; // Open link in a new tab
                        posterLinkElement.rel = 'noopener noreferrer'; // Security best practice
                        // Optional: Add a title to the link for accessibility/tooltip
                        // posterLinkElement.title = `View ${movie.title} on Letterboxd`;
                        posterLinkElement.appendChild(posterElement); // Wrap the poster with the link
                    } else {
                        // If no letterboxd_uri, just use the posterElement directly
                        posterLinkElement = posterElement;
                    }
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'rewatch-info';

                    const rewatchCountP = document.createElement('p');
                    rewatchCountP.className = 'rewatch-count';
                    rewatchCountP.textContent = `${movie.rewatch_count} rewatch${movie.rewatch_count > 1 ? 'es' : ''}`;
                    
                    card.title = movie.title; // Browser tooltip for the whole card

                    infoDiv.appendChild(rewatchCountP);
                    
                    // If you want to display the title visibly inside the card:
                    // const titleP = document.createElement('p');
                    // titleP.className = 'movie-title-tooltip'; // Or a new class like 'movie-title-visible'
                    // titleP.textContent = movie.title;
                    // infoDiv.appendChild(titleP);

                    card.appendChild(posterLinkElement); // Add the (potentially linked) poster to the card
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

    // Expose function for fullscreenChart.js to call
    window.MyAppGlobal = window.MyAppGlobal || {};
    window.MyAppGlobal.fetchAndDisplayMostRewatched = fetchAndDisplayMostRewatched;
});