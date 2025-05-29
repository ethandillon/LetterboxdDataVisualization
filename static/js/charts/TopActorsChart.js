// TopActorsChart.js
document.addEventListener('DOMContentLoaded', () => {
    // Corrected ID
    const container = document.getElementById('TopActorsListContainer'); 
    // Corrected Error Message ID
    const errorMessageElement = document.getElementById('TopActorsListErrorMessage'); 
    
    const PROFILE_SIZE_NORMAL = 'w185'; // For dashboard cards
    const PLACEHOLDER_PERSON_IMAGE_URL = 'https://via.placeholder.com/150x225.png?text=No+Image'; // 2:3 aspect ratio placeholder

    async function displayTopActors(limit = 5) {
        if (!container) {
            // Updated console error message to reflect the correct ID
            console.error("Container 'TopActorsListContainer' not found."); 
            if (errorMessageElement) {
                errorMessageElement.textContent = "Display area for Top Actors not found.";
                errorMessageElement.classList.remove('hidden');
            }
            return;
        }
        container.innerHTML = ''; // Clear previous content

        const profilePxWidth = parseInt(PROFILE_SIZE_NORMAL.substring(1));
        const profilePxHeight = Math.round(profilePxWidth * 1.5); 
        const placeholderSizedUrl = PLACEHOLDER_PERSON_IMAGE_URL.replace('150x225', `${profilePxWidth}x${profilePxHeight}`);

        try {
            const response = await fetch(`/api/top-actors?limit=${limit}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
            }
            const actors = await response.json();
            
            if (actors && actors.length > 0) {
                actors.forEach(actor => {
                    const card = document.createElement('div');
                    card.className = 'person-card';
                    card.title = `${actor.name} - ${actor.filmCount} film${actor.filmCount !== 1 ? 's' : ''}`; 

                    let imageElement;

                    if (actor.profilePath && typeof actor.profilePath === 'string' && actor.profilePath.startsWith('http')) {
                        const tmdbSizeRegex = /\/w\d+\//; 
                        const imageSrcToUse = actor.profilePath.replace(tmdbSizeRegex, `/${PROFILE_SIZE_NORMAL}/`);
                        
                        imageElement = document.createElement('img');
                        imageElement.className = 'profile-image';
                        imageElement.src = imageSrcToUse;
                        imageElement.alt = `Profile of ${actor.name}`;
                        imageElement.onerror = function() { 
                            this.onerror=null; 
                            this.src=placeholderSizedUrl; 
                            this.alt = 'Placeholder image';
                        };
                    } else {
                        imageElement = document.createElement('div');
                        imageElement.className = 'profile-image-placeholder'; 
                        imageElement.textContent = 'No Image';
                    }
                    
                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'person-info';

                    const filmCountP = document.createElement('p');
                    filmCountP.className = 'film-count';
                    filmCountP.textContent = `${actor.filmCount} film${actor.filmCount !== 1 ? 's' : ''}`;
                    
                    const nameP = document.createElement('p');
                    nameP.className = 'person-name';
                    nameP.textContent = actor.name;

                    infoDiv.appendChild(filmCountP);
                    infoDiv.appendChild(nameP);
                    
                    card.appendChild(imageElement);
                    card.appendChild(infoDiv);
                    container.appendChild(card);
                });
                if (errorMessageElement) errorMessageElement.classList.add('hidden');
            } else {
                container.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No top actors found.</p>`;
                if (errorMessageElement) errorMessageElement.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error fetching top actors:', error);
            if (errorMessageElement) {
                errorMessageElement.textContent = 'Failed to load top actors. ' + error.message;
                errorMessageElement.classList.remove('hidden');
            }
            if (container) { 
                container.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading actors.</p>`;
            }
        }
        if (containerElement) {
            containerElement.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading actors.</p>`;
        }
    }

    // Initial load for dashboard view
    displayTopActors(5);
});
