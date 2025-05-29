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

    async function enterFullscreen(buttonElement) {
        const targetId = buttonElement.dataset.targetId;
        const type = buttonElement.dataset.type || 'chart'; 

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
            const originalChartInstance = Chart.getChart(targetId); 

            if (!originalChartInstance) {
                console.error('Original chart instance not found for ID:', targetId);
                exitFullscreen(); 
                return;
            }

            let dataForFullscreen;
            let optionsForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.options || {}));

            optionsForFullscreen.scales = optionsForFullscreen.scales || {};
            optionsForFullscreen.scales.x = optionsForFullscreen.scales.x || {};
            optionsForFullscreen.scales.x.title = optionsForFullscreen.scales.x.title || {}; 
            optionsForFullscreen.scales.y = optionsForFullscreen.scales.y || {};
            optionsForFullscreen.scales.y.title = optionsForFullscreen.scales.y.title || {};

            // NOTE: The TopDirectorsChart and TopActorsChart are no longer Chart.js charts.
            // The logic for fetching Top 25 Directors/Actors for charts is removed from here.
            // If other charts need special data fetching, that logic remains.
            // For example, if MoviesByReleaseYearChart needed more data for fullscreen:
            // if (targetId === 'MoviesByReleaseYearChart') { ... } 
            
            dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));


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
            fullscreenGenericContentHost.innerHTML = ''; 

            let headerText = '';
            let fetchFunction = null;
            let gridItemClass = ''; // To distinguish between movie grid and person grid for styling if needed
            let limit = 0;

            if (targetId === 'mostRewatchedMoviesContainer') {
                headerText = 'Most Rewatched Movies';
                fetchFunction = window.MyAppGlobal?.fetchAndDisplayMostRewatched;
                gridItemClass = 'rewatched-movies-grid'; // Existing class
                limit = 14; // e.g. 2 rows of 7
            } else if (targetId === 'TopDirectorsListContainer') {
                headerText = 'Top 25 Directors';
                fetchFunction = window.MyAppGlobal?.fetchAndDisplayTopDirectors;
                gridItemClass = 'person-grid'; // New class for person grid
                limit = 28; // e.g. 4 rows of 7
            } else if (targetId === 'TopActorsListContainer') {
                headerText = 'Top 25 Actors';
                fetchFunction = window.MyAppGlobal?.fetchAndDisplayTopActors;
                gridItemClass = 'person-grid';
                limit = 28; // e.g. 4 rows of 7
            }

            if (fetchFunction) {
                const header = document.createElement('h3');
                header.className = 'fullscreen-generic-header';
                header.textContent = headerText;
                fullscreenGenericContentHost.appendChild(header);

                const gridWrapper = document.createElement('div');
                gridWrapper.className = 'fullscreen-cloned-content-wrapper'; 
                fullscreenGenericContentHost.appendChild(gridWrapper);

                const fullscreenGrid = document.createElement('div');
                fullscreenGrid.className = gridItemClass; // Use specific grid class
                // ID is not strictly necessary for fullscreenGrid as it's temporary
                gridWrapper.appendChild(fullscreenGrid);
                
                // Call the specific fetch function
                // The fetch functions now take (limit, containerElementOrId, errorElementId)
                // For fullscreen, we pass the actual element and null for errorElementId as errors are handled by the function
                fetchFunction(limit, fullscreenGrid, null); 
                fullscreenGenericContentHost.classList.remove('hidden');
            } else if (document.getElementById(targetId)) { // Fallback for other generic content
                const originalContentElement = document.getElementById(targetId);
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'fullscreen-cloned-content-wrapper'; 
                
                const clonedContent = originalContentElement.cloneNode(true);
                clonedContent.removeAttribute('id'); 
                
                contentWrapper.appendChild(clonedContent);
                fullscreenGenericContentHost.appendChild(contentWrapper);
                fullscreenGenericContentHost.classList.remove('hidden');
            } else {
                console.error('Original generic content element not found or fetch function missing for ID:', targetId);
                exitFullscreen(); 
                return;
            }
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