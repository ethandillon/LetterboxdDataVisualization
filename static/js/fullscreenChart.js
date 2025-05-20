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
            // Ensure originalChartInstance.config.options exists, default to empty object if not
            let optionsForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.options || {}));

            // Initialize/ensure scales object and its sub-properties exist for bar/line charts
            // This will be cleaned up later for pie/doughnut charts
            optionsForFullscreen.scales = optionsForFullscreen.scales || {};
            optionsForFullscreen.scales.x = optionsForFullscreen.scales.x || {};
            optionsForFullscreen.scales.x.title = optionsForFullscreen.scales.x.title || {}; 
            optionsForFullscreen.scales.y = optionsForFullscreen.scales.y || {};
            optionsForFullscreen.scales.y.title = optionsForFullscreen.scales.y.title || {};

            if (targetId === 'TopDirectorsChart') {
                try {
                    const response = await fetch('/api/top-directors?limit=25');
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API Error fetching top 25 directors: ${response.status} ${errorText}`);
                        dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                    } else {
                        dataForFullscreen = await response.json();
                        if (optionsForFullscreen.plugins?.title) {
                            optionsForFullscreen.plugins.title.text = 'Top 25 Directors by Film Count';
                        } else {
                            optionsForFullscreen.plugins = optionsForFullscreen.plugins || {};
                            optionsForFullscreen.plugins.title = { display: true, text: 'Top 25 Directors by Film Count', color: '#f3f4f6', font: {size: 16} };
                        }
                    }
                    optionsForFullscreen.scales.y.ticks = optionsForFullscreen.scales.y.ticks || {color: '#9ca3af'};
                    optionsForFullscreen.scales.y.ticks.display = true;
                    optionsForFullscreen.scales.x.ticks = optionsForFullscreen.scales.x.ticks || {color: '#9ca3af'};
                    optionsForFullscreen.scales.x.ticks.display = true;
                } catch (fetchError) {
                    console.error('Error fetching top 25 directors data:', fetchError);
                    dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                }
            } else if (targetId === 'TopActorsChart') {
                try {
                    const response = await fetch('/api/top-actors?limit=25');
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error(`API Error fetching top 25 actors: ${response.status} ${errorText}`);
                        dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                    } else {
                        dataForFullscreen = await response.json();
                        if (optionsForFullscreen.plugins?.title) {
                            optionsForFullscreen.plugins.title.text = 'Top 25 Actors by Film Count';
                        } else {
                             optionsForFullscreen.plugins = optionsForFullscreen.plugins || {};
                             optionsForFullscreen.plugins.title = { display: true, text: 'Top 25 Actors by Film Count', color: '#f3f4f6', font: {size: 16} };
                        }
                    }
                    optionsForFullscreen.scales.y.ticks = optionsForFullscreen.scales.y.ticks || {color: '#9ca3af'};
                    optionsForFullscreen.scales.y.ticks.display = true;
                    optionsForFullscreen.scales.x.ticks = optionsForFullscreen.scales.x.ticks || {color: '#9ca3af'};
                    optionsForFullscreen.scales.x.ticks.display = true;
                } catch (fetchError) {
                    console.error('Error fetching top 25 actors data:', fetchError);
                    dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                }
            } else {
                dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
            }

            const chartConfig = {
                type: originalChartInstance.config.type,
                data: dataForFullscreen,
                options: {
                    ...optionsForFullscreen,
                    animation: false,
                    maintainAspectRatio: false, // Ensure fullscreen chart can resize freely
                    responsive: true,
                }
            };

            // START FIX: Remove scales for pie/doughnut charts
            if (chartConfig.type === 'pie' || chartConfig.type === 'doughnut') {
                if (chartConfig.options.scales) {
                    delete chartConfig.options.scales;
                }
            }
            // END FIX

            // Specific legend handling for MoviesByGenrePieChart (assuming it's a pie or doughnut)
            if (targetId === 'MoviesByGenrePieChart') { // You can also combine with chartConfig.type check if needed
                chartConfig.options.plugins = chartConfig.options.plugins || {};
                chartConfig.options.plugins.legend = chartConfig.options.plugins.legend || {};
                const existingLabelOptions = chartConfig.options.plugins.legend.labels || {};
                chartConfig.options.plugins.legend = {
                    ...(chartConfig.options.plugins.legend), // Preserve other legend settings
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
            // ... (generic content logic remains the same) ...
            fullscreenGenericContentHost.innerHTML = ''; 

            if (targetId === 'mostRewatchedMoviesContainer' && typeof window.MyAppGlobal?.fetchAndDisplayMostRewatched === 'function') {
                
                const header = document.createElement('h3');
                header.className = 'fullscreen-generic-header';
                header.textContent = 'Most Rewatched Movies'; 
                fullscreenGenericContentHost.appendChild(header);

                const gridWrapper = document.createElement('div');
                gridWrapper.className = 'fullscreen-cloned-content-wrapper'; 
                fullscreenGenericContentHost.appendChild(gridWrapper);

                const fullscreenMovieGrid = document.createElement('div');
                fullscreenMovieGrid.className = 'rewatched-movies-grid'; 
                gridWrapper.appendChild(fullscreenMovieGrid);
                
                window.MyAppGlobal.fetchAndDisplayMostRewatched(
                    14, 
                    fullscreenMovieGrid, 
                    'w342'
                );
                fullscreenGenericContentHost.classList.remove('hidden');

            } else {
                const originalContentElement = document.getElementById(targetId);
                if (originalContentElement) {
                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'fullscreen-cloned-content-wrapper'; 
                    
                    const clonedContent = originalContentElement.cloneNode(true);
                    clonedContent.removeAttribute('id'); 
                    
                    contentWrapper.appendChild(clonedContent);
                    fullscreenGenericContentHost.appendChild(contentWrapper);
                    fullscreenGenericContentHost.classList.remove('hidden');
                } else {
                    console.error('Original generic content element not found for ID:', targetId);
                    exitFullscreen(); 
                    return;
                }
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