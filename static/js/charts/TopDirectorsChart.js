// TopDirectorsChart.js (Now functions as TopDirectorsList.js)

// Constants for image display
// IMPORTANT: Replace with an actual URL to a 2:3 aspect ratio rectangular placeholder
const DIRECTOR_PLACEHOLDER_IMAGE_URL = 'https://via.placeholder.com/180x270.png?text=No+Profile';

async function renderTopDirectorsList() {
    const containerElement = document.getElementById('topDirectorsContainer');
    const errorMessageDiv = document.getElementById('topDirectorsErrorMessage');

    if (!containerElement) {
        console.error("Container element 'topDirectorsContainer' not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Display area for Top Directors not found.";
            errorMessageDiv.classList.remove('hidden');
        }
        return;
    }

    containerElement.innerHTML = '';
    if (errorMessageDiv) errorMessageDiv.classList.add('hidden');

    try {
        const response = await fetch('/api/top-directors?limit=5');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const directors = await response.json();

        if (!directors || !Array.isArray(directors)) {
            throw new Error('Invalid data format for Top Directors from API.');
        }

        if (directors.length === 0) {
            containerElement.innerHTML = `<p class="text-muted text-center w-100" style="grid-column: 1 / -1;">No top directors found.</p>`;
            return;
        }

        directors.forEach(director => {
            const card = document.createElement('div');
            card.className = 'credit-card';
            card.title = `${director.name} - ${director.filmCount} film${director.filmCount !== 1 ? 's' : ''}`;

            const profileImageUrl = director.profilePath || DIRECTOR_PLACEHOLDER_IMAGE_URL;

            const imageElement = document.createElement('img');
            imageElement.className = 'credit-profile-image'; // Styled like a poster
            imageElement.src = profileImageUrl;
            imageElement.alt = `Profile of ${director.name}`;
            imageElement.onerror = function() {
                this.onerror = null;
                this.src = DIRECTOR_PLACEHOLDER_IMAGE_URL;
                this.alt = 'Placeholder image';
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'credit-info'; // Matches movie-card's info section

            const filmCountP = document.createElement('p');
            filmCountP.className = 'credit-film-count'; // For film count
            filmCountP.textContent = `${director.filmCount} film${director.filmCount !== 1 ? 's' : ''}`;

            const nameElement = document.createElement('p');
            nameElement.className = 'credit-name'; // For the director's name
            nameElement.textContent = director.name;

            infoDiv.appendChild(filmCountP); // Typically film count/rewatches first
            infoDiv.appendChild(nameElement);

            card.appendChild(imageElement);
            card.appendChild(infoDiv);
            containerElement.appendChild(card);
        });

    } catch (error) {
        console.error('Error rendering Top Directors list:', error);
        if (errorMessageDiv) {
            errorMessageDiv.textContent = `Could not load Top Directors: ${error.message}`;
            errorMessageDiv.classList.remove('hidden');
        }
        if (containerElement) {
            containerElement.innerHTML = `<p class="text-danger text-center w-100" style="grid-column: 1 / -1;">Error loading directors.</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', renderTopDirectorsList);