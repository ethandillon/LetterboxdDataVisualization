// TopActorsChart.js (Now functions as TopActorsList.js)

// Constants for image display
// IMPORTANT: Replace with an actual URL to a 2:3 aspect ratio rectangular placeholder
const ACTOR_PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/180x270.png?text=No+Profile';

async function renderTopActorsList() {
    const containerElement = document.getElementById('topActorsContainer');
    const errorMessageDiv = document.getElementById('topActorsErrorMessage');

    if (!containerElement) {
        console.error("Container element 'topActorsContainer' not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Display area for Top Actors not found.";
            errorMessageDiv.classList.remove('hidden');
        }
        return;
    }

    containerElement.innerHTML = '';
    if (errorMessageDiv) errorMessageDiv.classList.add('hidden');

    try {
        const response = await fetch('/api/top-actors?limit=5');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const actors = await response.json();

        if (!actors || !Array.isArray(actors)) {
            throw new Error('Invalid data format for Top Actors from API.');
        }

        if (actors.length === 0) {
            containerElement.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No top actors found.</p>`;
            return;
        }

        actors.forEach(actor => {
            const card = document.createElement('div');
            card.className = 'credit-card';
            card.title = `${actor.name} - ${actor.filmCount} film${actor.filmCount !== 1 ? 's' : ''}`;

            const profileImageUrl = actor.profilePath || ACTOR_PLACEHOLDER_IMAGE_URL;

            const imageElement = document.createElement('img');
            imageElement.className = 'credit-profile-image'; // Styled like a poster
            imageElement.src = profileImageUrl;
            imageElement.alt = `Profile of ${actor.name}`;
            imageElement.onerror = function() {
                this.onerror = null;
                this.src = ACTOR_PLACEHOLDER_IMAGE_URL;
                this.alt = 'Placeholder image';
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'credit-info'; // Matches movie-card's info section

            const filmCountP = document.createElement('p');
            filmCountP.className = 'credit-film-count'; // For film count
            filmCountP.textContent = `${actor.filmCount} film${actor.filmCount !== 1 ? 's' : ''}`;

            const nameElement = document.createElement('p');
            nameElement.className = 'credit-name'; // For the actor's name
            nameElement.textContent = actor.name;

            infoDiv.appendChild(filmCountP); // Typically film count/rewatches first
            infoDiv.appendChild(nameElement);

            card.appendChild(imageElement);
            card.appendChild(infoDiv);
            containerElement.appendChild(card);
        });

    } catch (error) {
        console.error('Error rendering Top Actors list:', error);
        if (errorMessageDiv) {
            errorMessageDiv.textContent = `Could not load Top Actors: ${error.message}`;
            errorMessageDiv.classList.remove('hidden');
        }
        if (containerElement) {
            containerElement.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading actors.</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', renderTopActorsList);