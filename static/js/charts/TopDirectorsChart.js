// TopDirectorsChart.js
document.addEventListener('DOMContentLoaded', () => {
    // Corrected ID
    const container = document.getElementById('TopDirectorsListContainer'); 
    // Corrected Error Message ID
    const errorMessageElement = document.getElementById('TopDirectorsListErrorMessage'); 
    
    const PROFILE_SIZE_NORMAL = 'w185'; // For dashboard cards
    const PLACEHOLDER_PERSON_IMAGE_URL = 'https://via.placeholder.com/150x225.png?text=No+Image'; // 2:3 aspect ratio

    async function displayTopDirectors(limit = 5) {
        if (!container) {
            // Updated console error message to reflect the correct ID
            console.error("Container 'TopDirectorsListContainer' not found."); 
            if (errorMessageElement) {
                errorMessageElement.textContent = "Display area for Top Directors not found.";
                errorMessageElement.classList.remove('hidden');
            }
            return;
        }
        container.innerHTML = ''; // Clear previous content

        const profilePxWidth = parseInt(PROFILE_SIZE_NORMAL.substring(1));
        const profilePxHeight = Math.round(profilePxWidth * 1.5); 
        const placeholderSizedUrl = PLACEHOLDER_PERSON_IMAGE_URL.replace('150x225', `${profilePxWidth}x${profilePxHeight}`);

        try {
            const response = await fetch(`/api/top-directors?limit=${limit}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
            }
            const directors = await response.json();
            
            if (directors && directors.length > 0) {
                directors.forEach(director => {
                    const card = document.createElement('div');
                    card.className = 'person-card';
                    card.title = `${director.name} - ${director.filmCount} film${director.filmCount !== 1 ? 's' : ''}`;

                    let imageElement;

                    if (director.profilePath && typeof director.profilePath === 'string' && director.profilePath.startsWith('http')) {
                        const tmdbSizeRegex = /\/w\d+\//; 
                        const imageSrcToUse = director.profilePath.replace(tmdbSizeRegex, `/${PROFILE_SIZE_NORMAL}/`);

                        imageElement = document.createElement('img');
                        imageElement.className = 'profile-image';
                        imageElement.src = imageSrcToUse;
                        imageElement.alt = `Profile of ${director.name}`;
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
                    filmCountP.textContent = `${director.filmCount} film${director.filmCount !== 1 ? 's' : ''}`;
                    
                    const nameP = document.createElement('p');
                    nameP.className = 'person-name';
                    nameP.textContent = director.name;

                    infoDiv.appendChild(filmCountP);
                    infoDiv.appendChild(nameP);
                    
                    card.appendChild(imageElement);
                    card.appendChild(infoDiv);
                    container.appendChild(card);
                });
                if (errorMessageElement) errorMessageElement.classList.add('hidden');
            } else {
                container.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No top directors found.</p>`;
                if (errorMessageElement) errorMessageElement.classList.add('hidden');
            }

        } catch (error) {
            console.error('Error fetching top directors:', error);
            if (errorMessageElement) {
                errorMessageElement.textContent = 'Failed to load top directors. ' + error.message;
                errorMessageElement.classList.remove('hidden');
            }
            if (container) { 
                container.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading directors.</p>`;
            }
        }
        if (containerElement) {
            containerElement.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading directors.</p>`;
        }
    }

    // Initial load for dashboard view
    displayTopDirectors(5);

    // Expose a global function for fullscreenChart.js to render people (directors/actors)
    // This part was already correctly using the `renderPeopleInGrid` function which takes the targetHostElement
    // So no changes needed for the MyAppGlobal.renderPeopleInGrid function itself regarding IDs.
    window.MyAppGlobal = window.MyAppGlobal || {};
    window.MyAppGlobal.renderPeopleInGrid = async function(apiUrl, targetHostElement, title, limit, profileSize = 'w185') {
        
        targetHostElement.innerHTML = ''; 

        const header = document.createElement('h3');
        header.className = 'fullscreen-generic-header';
        header.textContent = title;
        targetHostElement.appendChild(header);

        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'fullscreen-cloned-content-wrapper'; 
        targetHostElement.appendChild(gridWrapper);

        const grid = document.createElement('div');
        grid.className = 'person-grid'; 
        gridWrapper.appendChild(grid);

        const profilePxWidth = parseInt(profileSize.substring(1));
        const profilePxHeight = Math.round(profilePxWidth * 1.5); 
        const placeholderSizedUrl = PLACEHOLDER_PERSON_IMAGE_URL.replace('150x225', `${profilePxWidth}x${profilePxHeight}`);

        try {
            const response = await fetch(`${apiUrl}?limit=${limit}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error fetching people for ${title}: ${response.status} ${errorText}`);
            }
            const people = await response.json();

            if (people && people.length > 0) {
                people.forEach(person => {
                    const card = document.createElement('div');
                    card.className = 'person-card'; 
                    card.title = `${person.name} - ${person.filmCount} film${person.filmCount !== 1 ? 's' : ''}`;

                    let imageElement;

                    if (person.profilePath && typeof person.profilePath === 'string' && person.profilePath.startsWith('http')) {
                        const tmdbSizeRegex = /\/w\d+\//; 
                        const imageSrcToUse = person.profilePath.replace(tmdbSizeRegex, `/${profileSize}/`);
                        
                        imageElement = document.createElement('img');
                        imageElement.className = 'profile-image';
                        imageElement.src = imageSrcToUse;
                        imageElement.alt = `Profile of ${person.name}`;
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
                    card.appendChild(imageElement);

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'person-info';

                    const filmCountP = document.createElement('p');
                    filmCountP.className = 'film-count';
                    filmCountP.textContent = `${person.filmCount} film${person.filmCount !== 1 ? 's' : ''}`;
                    infoDiv.appendChild(filmCountP);

                    const nameP = document.createElement('p');
                    nameP.className = 'person-name';
                    nameP.textContent = person.name;
                    infoDiv.appendChild(nameP);
                    
                    card.appendChild(infoDiv);
                    grid.appendChild(card);
                });
            } else {
                grid.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No data found for ${title.toLowerCase()}.</p>`;
            }
        } catch (error) {
            console.error(`Error rendering people for ${title}:`, error);
            grid.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading data for ${title.toLowerCase()}.</p>`;
        }
    };
});
