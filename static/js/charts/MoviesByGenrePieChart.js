// MoviesByGenrePieChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let filmChartInstance = null;

async function renderChart() {
    const errorMessageDiv = document.getElementById('errorMessage');
    const canvasElement = document.getElementById('MoviesByGenrePieChart');

    if (!canvasElement) {
        console.error("Canvas element 'MoviesByGenrePieChart' not found.");
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
    if (filmChartInstance) {
        filmChartInstance.destroy();
        filmChartInstance = null;
    }

    try {
        // MODIFIED: Fetch from the relative path, now served by the same Go server on port 3000
        const response = await fetch('/api/film-count-by-genre'); 
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const chartData = await response.json();
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data from API.');
        }

        filmChartInstance = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Movies Watched',
                    data: dataset.data
                }))
            },
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