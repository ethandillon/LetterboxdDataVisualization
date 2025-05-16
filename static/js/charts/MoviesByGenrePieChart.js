// MoviesByGenrePieChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let moviesByGenrePieChartInstance = null;

async function renderChart() {
    const errorMessageDiv = document.getElementById('GenreChartErrorMessage');
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
    if (moviesByGenrePieChartInstance) {
        moviesByGenrePieChartInstance.destroy();
        moviesByGenrePieChartInstance = null;
    }

    try {
        const response = await fetch('/api/film-count-by-genre');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const chartData = await response.json();
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data from API.');
        }

        moviesByGenrePieChartInstance = new Chart(ctx, {
            type: 'doughnut', // Changed to doughnut
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Movies Watched',
                    data: dataset.data,
                    backgroundColor: MyAppCharts.pieColors, // Use our defined palette
                    borderColor: '#1f2937',      // Match chart container background (Tailwind gray-800)
                    borderWidth: 2,
                    hoverOffset: 10,              // Slightly larger pop-out on hover
                    hoverBorderColor: '#374151',  // Tailwind gray-700 for hover border
                    hoverBorderWidth: 3
                }))
            },
            options: {
                cutout: '50%', // Adjust for doughnut thickness (e.g., '50%' for thicker, '70%' for thinner)
                plugins: {
                    title: {
                        text: "Movies Watched by Genre"
                    },
                    legend: {
                        display: false,
                        labels: {
                            usePointStyle: true, // Use circular legend color indicators
                            boxWidth: 10         // Smaller box width for point style
                        }
                    },
                    tooltip: {
                        // mode: 'point', // Already set to 'nearest' globally, which is fine.
                        callbacks: {
                            label: function(context) {
                                let label = context.label || ''; // Genre name
                                if (label) { label += ': '; }
                                if (context.parsed !== null) {
                                    label += context.parsed; // The value of the slice

                                    // Calculate and add percentage
                                    const total = context.chart.getDatasetMeta(0).total;
                                    if (total > 0) {
                                        const percentage = ((context.parsed / total) * 100).toFixed(1) + '%';
                                        label += ` (${percentage})`;
                                    }
                                }
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