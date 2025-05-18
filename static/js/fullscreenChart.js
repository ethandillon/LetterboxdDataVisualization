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

        // --- MODIFICATION FOR TOP DIRECTORS CHART ---
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
                    // Update titles in options for the fullscreen view (Top 25)
                    if (optionsForFullscreen.scales?.x?.title) {
                        optionsForFullscreen.scales.x.title.text = 'Director (Top 25)';
                    }
                    if (optionsForFullscreen.plugins?.title) {
                        optionsForFullscreen.plugins.title.text = 'Top 25 Directors by Film Count';
                    }
                }
            } catch (fetchError) {
                console.error('Error fetching top 25 directors data:', fetchError);
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
                animation: false,
                maintainAspectRatio: false,
                responsive: true
            }
        };

        // Ensure maintainAspectRatio is false for the fullscreen chart for better responsiveness
        if (chartConfig.options) {
            chartConfig.options.maintainAspectRatio = false;
            chartConfig.options.responsive = true;
        } else {
            chartConfig.options = { maintainAspectRatio: false, responsive: true };
        }

        // Specific legend handling for MoviesByGenrePieChart (as in your original code)
        if (chartId === 'MoviesByGenrePieChart') {
            // Ensure plugins object and legend object exist before trying to modify/spread them
            chartConfig.options.plugins = chartConfig.options.plugins || {};
            chartConfig.options.plugins.legend = chartConfig.options.plugins.legend || {};
            const existingLabelOptions = chartConfig.options.plugins.legend.labels || {};

            chartConfig.options.plugins.legend = {
                ...chartConfig.options.plugins.legend, // Spread existing general legend options
                display: true,
                position: 'top',
                align: 'center',
                labels: {
                    ...existingLabelOptions, // Spread existing label options
                    color: (typeof MyAppCharts !== 'undefined' && MyAppCharts.colors) ? MyAppCharts.colors.lightTextColor : '#FFFFFF', // Fallback color
                    font: { size: 12, family: 'Inter' },
                    usePointStyle: true,
                    boxWidth: 10,
                    padding: 15
                }
            };
        }
        // The original 'else if (chartConfig.options.plugins.legend)' for other charts
        // is implicitly handled because we are cloning the entire options object.
        // If a chart's legend was displayed, it will remain displayed unless overridden.

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
            const chartId = btn.dataset.chartId; // e.g., "TopDirectorsChart", "MoviesByGenrePieChart"
            if (chartId) {
                enterFullscreen(chartId);
            }
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