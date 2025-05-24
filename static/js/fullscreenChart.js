// fullscreenChart.js

document.addEventListener('DOMContentLoaded', () => {
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    const fullscreenChartHost = document.getElementById('fullscreenChartHost');

    const fullscreenCanvasContainer = fullscreenChartHost.querySelector('.fullscreen-canvas-container');
    const fullscreenCanvas = document.getElementById('fullscreenCanvas');
    const fullscreenGenericContentHost = document.getElementById('fullscreenGenericContentHost');

    const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
    const fullscreenBtns = document.querySelectorAll('.fullscreen-btn');

    let fullscreenChartInstance = null;
    let currentFullscreenType = null;
    let currentFullscreenTargetId = null;

    // Placeholder URLs for fullscreen credit lists - replace with actuals if needed
    const FULLSCREEN_DIRECTOR_PLACEHOLDER_URL = 'https://via.placeholder.com/180x270.png?text=No+Profile';
    const FULLSCREEN_ACTOR_PLACEHOLDER_URL = 'https://via.placeholder.com/180x270.png?text=No+Profile';

    // Helper function to render a list of credits (actors/directors)
    function renderCreditsListFullscreen(credits, container, placeholderUrl) {
        container.innerHTML = ''; // Clear previous content
        if (!credits || credits.length === 0) {
            container.innerHTML = `<p class="text-muted text-center w-100">No data found.</p>`;
            return;
        }

        credits.forEach(credit => {
            const card = document.createElement('div');
            card.className = 'credit-card'; // Uses styles from style.css
            card.title = `${credit.name} - ${credit.filmCount} film${credit.filmCount !== 1 ? 's' : ''}`;

            const profileImageUrl = credit.profilePath || placeholderUrl;

            const imageElement = document.createElement('img');
            imageElement.className = 'credit-profile-image';
            imageElement.src = profileImageUrl;
            imageElement.alt = `Profile of ${credit.name}`;
            imageElement.onerror = function() {
                this.onerror = null;
                this.src = placeholderUrl;
                this.alt = 'Placeholder image';
            };

            const infoDiv = document.createElement('div');
            infoDiv.className = 'credit-info';

            const filmCountP = document.createElement('p');
            filmCountP.className = 'credit-film-count';
            filmCountP.textContent = `${credit.filmCount} film${credit.filmCount !== 1 ? 's' : ''}`;

            const nameElement = document.createElement('p');
            nameElement.className = 'credit-name';
            nameElement.textContent = credit.name;

            infoDiv.appendChild(filmCountP);
            infoDiv.appendChild(nameElement);

            card.appendChild(imageElement);
            card.appendChild(infoDiv);
            container.appendChild(card);
        });
    }


    async function enterFullscreen(buttonElement) {
        const targetId = buttonElement.dataset.targetId;
        // TopDirectorsChart and TopActorsChart are now generic lists, not charts
        // Their containers are topDirectorsContainer and topActorsContainer
        let type = buttonElement.dataset.type || 'chart';
        if (targetId === 'topDirectorsContainer' || targetId === 'topActorsContainer') {
            type = 'generic'; // Override type for these new list displays
        }


        fullscreenCanvasContainer.classList.add('hidden');
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
            fullscreenChartInstance = null;
        }
        fullscreenGenericContentHost.innerHTML = '';
        fullscreenGenericContentHost.classList.add('hidden');

        currentFullscreenType = type;
        currentFullscreenTargetId = targetId;

        if (type === 'chart') {
            // This section now handles only actual charts like MoviesByReleaseYear, MoviesByGenrePie, MoviesWatchedOverTime
            const originalChartInstance = Chart.getChart(targetId);

            if (!originalChartInstance) {
                console.error('Original chart instance not found for ID:', targetId);
                exitFullscreen();
                return;
            }

            let dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
            let optionsForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.options || {}));

            // Initialize/ensure scales object and its sub-properties exist
            optionsForFullscreen.scales = optionsForFullscreen.scales || {};
            optionsForFullscreen.scales.x = optionsForFullscreen.scales.x || {};
            optionsForFullscreen.scales.x.title = optionsForFullscreen.scales.x.title || {};
            optionsForFullscreen.scales.y = optionsForFullscreen.scales.y || {};
            optionsForFullscreen.scales.y.title = optionsForFullscreen.scales.y.title || {};
            optionsForFullscreen.scales.y.ticks = optionsForFullscreen.scales.y.ticks || {color: '#9ca3af'};
            optionsForFullscreen.scales.y.ticks.display = true;
            optionsForFullscreen.scales.x.ticks = optionsForFullscreen.scales.x.ticks || {color: '#9ca3af'};
            optionsForFullscreen.scales.x.ticks.display = true;


            const chartConfig = {
                type: originalChartInstance.config.type,
                data: dataForFullscreen,
                options: {
                    ...optionsForFullscreen,
                    animation: false,
                    maintainAspectRatio: false,
                    responsive: true,
                }
            };

            if (chartConfig.type === 'pie' || chartConfig.type === 'doughnut') {
                if (chartConfig.options.scales) {
                    delete chartConfig.options.scales;
                }
            }

            if (targetId === 'MoviesByGenrePieChart') {
                chartConfig.options.plugins = chartConfig.options.plugins || {};
                chartConfig.options.plugins.legend = chartConfig.options.plugins.legend || {};
                const existingLabelOptions = chartConfig.options.plugins.legend.labels || {};
                chartConfig.options.plugins.legend = {
                    ...(chartConfig.options.plugins.legend),
                    display: true,
                    position: 'top',
                    align: 'center',
                    labels: {
                        ...existingLabelOptions,
                        color: (typeof MyAppCharts !== 'undefined' && MyAppCharts.colors) ? MyAppCharts.colors.lightTextColor : '#f3f4f6',
                        font: { size: 12, family: 'Inter' },
                        usePointStyle: true,
                        boxWidth: 10,
                        padding: 15
                    }
                };
            }

            const ctx = fullscreenCanvas.getContext('2d');
            fullscreenChartInstance = new Chart(ctx, chartConfig);
            fullscreenCanvasContainer.classList.remove('hidden');

        } else if (type === 'generic') {
            fullscreenGenericContentHost.innerHTML = ''; // Clear previous

            // Create common wrapper structure for generic content
            const header = document.createElement('h3');
            header.className = 'fullscreen-generic-header';
            fullscreenGenericContentHost.appendChild(header);

            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'fullscreen-cloned-content-wrapper';
            fullscreenGenericContentHost.appendChild(gridWrapper);

            let contentGridElement; // This will hold the actual grid

            if (targetId === 'mostRewatchedMoviesContainer' && typeof window.MyAppGlobal?.fetchAndDisplayMostRewatched === 'function') {
                header.textContent = 'Most Rewatched Movies (Top 14)';
                contentGridElement = document.createElement('div');
                contentGridElement.className = 'rewatched-movies-grid'; // Use specific class
                gridWrapper.appendChild(contentGridElement);

                window.MyAppGlobal.fetchAndDisplayMostRewatched(
                    14,
                    contentGridElement,
                    'w342' // Larger poster size for fullscreen
                );

            } else if (targetId === 'topDirectorsContainer') {
                header.textContent = 'Top Directors (Top 20)';
                contentGridElement = document.createElement('div');
                contentGridElement.className = 'credits-grid'; // Use specific class
                gridWrapper.appendChild(contentGridElement);

                try {
                    const response = await fetch('/api/top-directors?limit=20');
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const directorsData = await response.json();
                    renderCreditsListFullscreen(directorsData, contentGridElement, FULLSCREEN_DIRECTOR_PLACEHOLDER_URL);
                } catch (err) {
                    console.error('Error fetching/rendering top directors for fullscreen:', err);
                    contentGridElement.innerHTML = `<p class="text-danger text-center w-100">Error loading directors.</p>`;
                }

            } else if (targetId === 'topActorsContainer') {
                header.textContent = 'Top Actors (Top 20)';
                contentGridElement = document.createElement('div');
                contentGridElement.className = 'credits-grid'; // Use specific class
                gridWrapper.appendChild(contentGridElement);

                try {
                    const response = await fetch('/api/top-actors?limit=20');
                    if (!response.ok) throw new Error(`API Error: ${response.status}`);
                    const actorsData = await response.json();
                    renderCreditsListFullscreen(actorsData, contentGridElement, FULLSCREEN_ACTOR_PLACEHOLDER_URL);
                } catch (err) {
                    console.error('Error fetching/rendering top actors for fullscreen:', err);
                    contentGridElement.innerHTML = `<p class="text-danger text-center w-100">Error loading actors.</p>`;
                }

            } else { // Fallback for other generic content (if any)
                header.textContent = 'Fullscreen View'; // Generic title
                const originalContentElement = document.getElementById(targetId);
                if (originalContentElement) {
                    const clonedContent = originalContentElement.cloneNode(true);
                    clonedContent.removeAttribute('id');
                    gridWrapper.appendChild(clonedContent); // Add cloned content to the wrapper
                } else {
                    console.error('Original generic content element not found for ID:', targetId);
                    header.textContent = 'Error: Content not found';
                    gridWrapper.innerHTML = `<p class="text-danger text-center w-100">Content not found.</p>`;
                }
            }
            fullscreenGenericContentHost.classList.remove('hidden');
        } else {
            console.error('Unknown fullscreen type or missing target ID.');
            exitFullscreen();
            return;
        }

        fullscreenOverlay.classList.remove('hidden');
        fullscreenChartHost.classList.remove('hidden');
        document.body.classList.add('fullscreen-active');
    }

    function exitFullscreen() {
        if (currentFullscreenType === 'chart' && fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
            fullscreenChartInstance = null;
        } else if (currentFullscreenType === 'generic') {
            fullscreenGenericContentHost.innerHTML = '';
        }

        fullscreenOverlay.classList.add('hidden');
        fullscreenChartHost.classList.add('hidden');

        fullscreenCanvasContainer.classList.add('hidden');
        fullscreenGenericContentHost.classList.add('hidden');

        document.body.classList.remove('fullscreen-active');
        currentFullscreenType = null;
        currentFullscreenTargetId = null;
    }

    fullscreenBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            enterFullscreen(btn);
        });
    });

    closeFullscreenBtn.addEventListener('click', exitFullscreen);
    fullscreenOverlay.addEventListener('click', exitFullscreen);

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !fullscreenChartHost.classList.contains('hidden')) {
            exitFullscreen();
        }
    });
});