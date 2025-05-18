// TopDirectorsChart.js
// No 'import Chart from ...' line needed. Chart is global.
// No 'import ... from ./chartConfig.js'. MyAppCharts is global if needed, but defaults are applied.

let topDirectorsChartInstance = null;

async function renderTopDirectorsChart() {
    const errorMessageDiv = document.getElementById('Top5DirectorsChartErrorMessage');
    const canvasElement = document.getElementById('Top5DirectorsChart');

    if (!canvasElement) {
        console.error("Canvas element 'TopDirectorsChart' not found.");
        if (errorMessageDiv) {
            errorMessageDiv.textContent = "Chart canvas for Top Directors not found.";
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
    if (topDirectorsChartInstance) {
        topDirectorsChartInstance.destroy();
        topDirectorsChartInstance = null;
    }

    try {
        // Fetch data for top five directors
        const response = await fetch('/api/top-five-directors');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${errorText || response.statusText}`);
        }
        const chartData = await response.json();
        if (!chartData || !chartData.labels || !chartData.datasets) {
            throw new Error('Invalid chart data for Top Directors from API.');
        }

        topDirectorsChartInstance = new Chart(ctx, {
            type: 'bar', // Or 'pie', 'doughnut', 'horizontalBar' if you prefer
            data: {
                labels: chartData.labels, // Director names
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Number of Films', // Fallback label
                    data: dataset.data, 
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // Adjust as needed
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Director'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Films Directed'
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
                        text: "Top 5 Directors by Film Count"
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
        console.error('Error rendering Top Directors chart:', error);
        if (errorMessageDiv) {
            errorMessageDiv.textContent = `Could not load Top Directors chart: ${error.message}`;
            errorMessageDiv.classList.remove('hidden');
        }
    }
}

// Call the function to render the chart when the script loads
renderTopDirectorsChart();