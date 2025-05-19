// TopActorsChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let topActorsChartInstance = null;

async function renderTopActorsChart() {
    const errorMessageDiv = document.getElementById('TopActorsChartErrorMessage');
    const canvasElement = document.getElementById('TopActorsChart');

    if (!canvasElement) {
        console.error("Canvas element 'TopActorsChart' not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Chart canvas for Top Actors not found.";
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
    if (topActorsChartInstance) {
        topActorsChartInstance.destroy();
        topActorsChartInstance = null;
    }

    try {
        // Fetch data for top 5 Actors for initial display
        const response = await fetch('/api/top-actors?limit=5'); // Fetch only top 5
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const chartData = await response.json(); // Contains data for top 5
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data for Top 5 Actors from API.');
        }


        topActorsChartInstance = new Chart(ctx, {
            type: 'bar', // Or 'pie', 'doughnut', 'horizontalBar' if you prefer
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false, // Adjust as needed
                scales: {
                    x: {
                        title: {
                            display: false,
                            text: 'Actor'
                        }
                    },
                    y: {
                        title: {
                            display: false,
                            text: 'Number of Films'
                        },
                        beginAtZero: true,
                        ticks: {
                            // Ensure y-axis ticks are integers if dealing with counts
                            precision: 0
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: "Top 5 Actors by Film Count"
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y + (context.parsed.y === 1 ? ' film' : ' films');
                                }
                                return label;
                            }
                        }
                    },
                    legend: {
                        // Hide legend if there's only one dataset and the title is clear
                        display: chartData.datasets.length > 1
                    }
                }
            }
        });
        if (errorMessageDiv) errorMessageDiv.classList.add('hidden');
    } catch (error) {
        console.error('Error rendering Top Actors chart:', error);
        if (errorMessageDiv) {
            errorMessageDiv.textContent = `Could not load Top Actors chart: ${error.message}`;
            errorMessageDiv.classList.remove('hidden');
        }
    }
}

// Call the function to render the chart when the script loads
renderTopActorsChart();