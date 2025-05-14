// MoviesByReleaseYearChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let moviesByReleaseYearChartInstance = null;

async function renderChart() {
    const errorMessageDiv = document.getElementById('ReleaseYearChartErrorMessage');
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
    if (typeof Chart !== 'undefined' && Chart.getChart) {
        const existingChartOnCanvas = Chart.getChart(canvasElement);
        if (existingChartOnCanvas) {
            existingChartOnCanvas.destroy();
        }
    }
    if (moviesByReleaseYearChartInstance) {
        moviesByReleaseYearChartInstance.destroy();
        moviesByReleaseYearChartInstance = null;
    }

    try {
        // MODIFIED: Fetch from the relative path, now served by the same Go server on port 3000
        const response = await fetch('/api/film-count-by-release-year'); 
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const chartData = await response.json();
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data from API.');
        }

        moviesByReleaseYearChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Movies Watched',
                    data: dataset.data
                }))
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true, // Ensure title display is explicitly true if overriding
                            text: 'Release Year of Film'
                        }
                    },
                    y: {
                        title: {
                            display: true, // Ensure title display is explicitly true if overriding
                            text: 'Number of Movies Watched'
                        },
                        beginAtZero: true // Good practice for bar charts counting items
                    }
                },
                plugins: {
                    title: {
                        text: "Movies Watched by Release Year"
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) { label += context.parsed.y + ' films'; }
                                return label;
                            }
                        }
                    }
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

renderChart();