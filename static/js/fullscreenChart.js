// fullscreenChart.js

document.addEventListener('DOMContentLoaded', () => {
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    const fullscreenChartHost = document.getElementById('fullscreenChartHost');
    const fullscreenCanvas = document.getElementById('fullscreenCanvas');
    const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
    const fullscreenBtns = document.querySelectorAll('.fullscreen-btn');

    let fullscreenChartInstance = null; // To hold the Chart.js instance for the fullscreen view
    let originalChartInstance = null; // To hold the original chart instance

    function enterFullscreen(chartId) {
        originalChartInstance = Chart.getChart(chartId); // Get the Chart.js instance of the original chart

        if (!originalChartInstance) {
            console.error('Original chart instance not found for ID:', chartId);
            return;
        }

        // Clone the configuration of the original chart
        // Important: Use originalChartInstance.config to get all data, options, type
        const chartConfig = {
            type: originalChartInstance.config.type,
            data: JSON.parse(JSON.stringify(originalChartInstance.config.data)), // Deep clone data
            options: JSON.parse(JSON.stringify(originalChartInstance.config.options)) // Deep clone options
        };
        
        // Ensure maintainAspectRatio is false for the fullscreen chart for better responsiveness
        if (chartConfig.options) {
            chartConfig.options.maintainAspectRatio = false;
            chartConfig.options.responsive = true; // Ensure it's responsive
             // Optional: if legends/tooltips get obscured, you might need to adjust their containers
            // or re-evaluate their z-index if they are rendered outside the canvas.
            // For most cases, Chart.js handles this well within its canvas.
        } else {
            chartConfig.options = { maintainAspectRatio: false, responsive: true };
        }


        // Destroy previous fullscreen chart instance if it exists
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
        }

        const ctx = fullscreenCanvas.getContext('2d');
        fullscreenChartInstance = new Chart(ctx, chartConfig);

        fullscreenOverlay.classList.remove('hidden');
        fullscreenChartHost.classList.remove('hidden');
        document.body.classList.add('fullscreen-active'); // Prevent body scroll
    }

    function exitFullscreen() {
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
            fullscreenChartInstance = null;
        }
        originalChartInstance = null; // Clear reference

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
    fullscreenOverlay.addEventListener('click', exitFullscreen); // Optional: close by clicking overlay

    // Optional: Close fullscreen with Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !fullscreenChartHost.classList.contains('hidden')) {
            exitFullscreen();
        }
    });
});