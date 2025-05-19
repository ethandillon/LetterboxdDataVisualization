// fullscreenChart.js

document.addEventListener('DOMContentLoaded', () => {
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    const fullscreenChartHost = document.getElementById('fullscreenChartHost');
    const fullscreenCanvas = document.getElementById('fullscreenCanvas');
    const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
    const fullscreenBtns = document.querySelectorAll('.fullscreen-btn');

    let fullscreenChartInstance = null;

    async function enterFullscreen(chartId) {
        const originalChartInstance = Chart.getChart(chartId);

        if (!originalChartInstance) {
            console.error('Original chart instance not found for ID:', chartId);
            return;
        }

        let dataForFullscreen;
        // Deep clone original options to modify them safely for fullscreen
        let optionsForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.options));

        optionsForFullscreen.scales = optionsForFullscreen.scales || {};
        optionsForFullscreen.scales.x = optionsForFullscreen.scales.x || {};
        optionsForFullscreen.scales.x.title = optionsForFullscreen.scales.x.title || {}; 
        optionsForFullscreen.scales.x.title.display = optionsForFullscreen.scales.x.title.display || {}; 

        optionsForFullscreen.scales = optionsForFullscreen.scales || {};
        optionsForFullscreen.scales.y = optionsForFullscreen.scales.y || {};
        optionsForFullscreen.scales.y.title = optionsForFullscreen.scales.y.title || {}; 
        optionsForFullscreen.scales.y.title.display = optionsForFullscreen.scales.y.title.display || {}; 

        if (chartId === 'TopDirectorsChart') {
            try {
                // Fetch the top 25 directors data specifically for fullscreen
                const response = await fetch('/api/top-directors?limit=25');
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error fetching top 25 directors: ${response.status} ${errorText}`);
                    // Fallback to original chart data if fetch fails
                    dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                } else {
                    dataForFullscreen = await response.json();
                    if (optionsForFullscreen.plugins?.title) {
                        optionsForFullscreen.plugins.title.text = 'Top 25 Directors by Film Count';
                    }
                }
                optionsForFullscreen.scales.y.ticks.display = true; // << SHOW X-AXIS LABELS IN FULLSCREEN
                optionsForFullscreen.scales.x.ticks.display = true; // << SHOW X-AXIS LABELS IN FULLSCREEN
            } catch (fetchError) {
                console.error('Error fetching top 25 directors data:', fetchError);
                // Fallback to original chart data on fetch error
                dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
            }
        } else if (chartId === 'TopActorsChart') { // <<< CHANGED TO ELSE IF
            try {
                // Fetch the top 25 actors data specifically for fullscreen
                const response = await fetch('/api/top-actors?limit=25');
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`API Error fetching top 25 actors: ${response.status} ${errorText}`);
                    // Fallback to original chart data if fetch fails
                    dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
                } else {
                    dataForFullscreen = await response.json();
                    if (optionsForFullscreen.plugins?.title) {
                        optionsForFullscreen.plugins.title.text = 'Top 25 Actors by Film Count';
                    }
                }
                optionsForFullscreen.scales.y.ticks.display = true; // << SHOW Y-AXIS LABELS IN FULLSCREEN
                optionsForFullscreen.scales.x.ticks.display = true; // << SHOW X-AXIS LABELS IN FULLSCREEN
            } catch (fetchError) {
                console.error('Error fetching top 25 actors data:', fetchError);
                // Fallback to original chart data on fetch error
                dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
            }
        } else {
            // For other charts, use their existing config data
            dataForFullscreen = JSON.parse(JSON.stringify(originalChartInstance.config.data));
        }

        const chartConfig = {
            type: originalChartInstance.config.type,
            data: dataForFullscreen,
            options: {
                ...optionsForFullscreen,
                animation: false, // Disable animation for quicker fullscreen render
                // maintainAspectRatio: false, // This will be set below
                // responsive: true          // This will be set below
            }
        };

        // Ensure maintainAspectRatio is false and responsive is true for the fullscreen chart
        if (chartConfig.options) {
            chartConfig.options.maintainAspectRatio = false;
            chartConfig.options.responsive = true;
        } else {
            chartConfig.options = { maintainAspectRatio: false, responsive: true };
        }

        // Specific legend handling for MoviesByGenrePieChart
        if (chartId === 'MoviesByGenrePieChart') {
            chartConfig.options.plugins = chartConfig.options.plugins || {};
            chartConfig.options.plugins.legend = chartConfig.options.plugins.legend || {};
            const existingLabelOptions = chartConfig.options.plugins.legend.labels || {};

            chartConfig.options.plugins.legend = {
                ...chartConfig.options.plugins.legend,
                display: true,
                position: 'top',
                align: 'center',
                labels: {
                    ...existingLabelOptions,
                    color: (typeof MyAppCharts !== 'undefined' && MyAppCharts.colors) ? MyAppCharts.colors.lightTextColor : '#FFFFFF',
                    font: { size: 12, family: 'Inter' },
                    usePointStyle: true,
                    boxWidth: 10,
                    padding: 15
                }
            };
        }
        // Note: If other charts need specific fullscreen option adjustments (beyond title/scale changes already handled),
        // they would need similar 'else if (chartId === ...)' blocks for optionsForFullscreen modifications.

        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
        }

        const ctx = fullscreenCanvas.getContext('2d');
        fullscreenChartInstance = new Chart(ctx, chartConfig);

        fullscreenOverlay.classList.remove('hidden');
        fullscreenChartHost.classList.remove('hidden');
        document.body.classList.add('fullscreen-active');
    }

    function exitFullscreen() {
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
            fullscreenChartInstance = null;
        }
        fullscreenOverlay.classList.add('hidden');
        fullscreenChartHost.classList.add('hidden');
        document.body.classList.remove('fullscreen-active');
    }

    fullscreenBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const chartId = btn.dataset.chartId;
            if (chartId) {
                enterFullscreen(chartId);
            }
        });
    });

    closeFullscreenBtn.addEventListener('click', exitFullscreen);
    fullscreenOverlay.addEventListener('click', exitFullscreen); // Optional: click outside to close

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !fullscreenChartHost.classList.contains('hidden')) {
            exitFullscreen();
        }
    });
});