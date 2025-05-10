// MoviesByReleaseYearChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let filmChartInstance = null;

async function renderChart() {
    const errorMessageDiv = document.getElementById('errorMessage');
    const canvasElement = document.getElementById('MoviesByReleaseYearChart');

    if (!canvasElement) {
        console.error("Canvas element 'MoviesByReleaseYearChart' not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Chart canvas not found.";
            errorMessageDiv.classList.remove('hidden');
        }
        return;
    }
    const ctx = canvasElement.getContext('2d');

    // Destroy existing chart instance if it exists
    // Chart.getChart might still work if Chart is global and properly initialized
    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const existingChartOnCanvas = Chart.getChart(canvasElement);
        if (existingChartOnCanvas) {
            existingChartOnCanvas.destroy();
        }
    }
    // Fallback or primary way if not using Chart.getChart:
    if (filmChartInstance) {
        filmChartInstance.destroy();
        filmChartInstance = null;
    }

    try {
        const response = await fetch('http://localhost:8080/film-count-by-release-year');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText}`);
        }
        const chartData = await response.json();
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data from API.');
        }

        // The Chart.defaults (set by chartConfig.js via the inline script in HTML)
        // will be automatically used by new Chart()

        filmChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Movies Watched',
                    data: dataset.data
                    // Dataset-specific styling (like backgroundColor, borderColor)
                    // will come from Chart.defaults.datasets.bar if set by MyAppCharts.defaultBarDatasetOptions
                }))
            },
            options: {
                // Only provide options here if they are specific to THIS chart
                // and NEED to override the global defaults from MyAppCharts.globalOptions.
                // For example, if the default axis titles are generic, override them here:
                scales: {
                    x: {
                        title: {
                            text: 'Release Year of Film' // Override default X title
                        }
                    },
                    y: {
                        title: {
                            text: 'Number of Movies Watched' // Override default Y title
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        // Example: Specific tooltip callback for THIS chart
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) { label += context.parsed.y + ' films'; }
                                return label;
                            }
                        }
                        // The rest of the tooltip (colors, fonts, etc.) will come from defaults
                    }
                    // Legend will fully come from defaults
                }
            }
        });
        if (errorMessageDiv) errorMessageDiv.classList.add('hidden');
    } catch (error) {
        console.error('Error rendering chart:', error);
        if (errorMessageDiv) {
            errorMessageDiv.textContent = `Could not load chart: ${error.message}`;
            errorMessageDiv.classList.remove('hidden');
        }
    }
}

// Since MoviesByReleaseYearChart.js is loaded with 'defer',
// the DOM will be ready when it executes.
// However, to be absolutely safe and consistent with applying defaults,
// ensure renderChart also runs after DOMContentLoaded.
// The inline script already handles calling applyChartDefaults on DOMContentLoaded.
// The 'defer' attribute on this script itself means it runs after DOM parsing
// and before DOMContentLoaded typically, or around the same time.
// A simple call or wrapping in DOMContentLoaded here is fine.

// document.addEventListener('DOMContentLoaded', renderChart);
// OR, if 'defer' is reliable enough for your simple DOM access needs in renderChart:
renderChart();
// For robustness, especially if renderChart itself does complex DOM setup beyond getElementById:
// document.addEventListener('DOMContentLoaded', renderChart);
// Given the setup, a direct call after 'defer' is usually fine for finding elements.
// The critical part is that applyChartDefaults happens AFTER Chart.js loads and BEFORE new Chart()