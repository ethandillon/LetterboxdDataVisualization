// Store the chart instance globally so it can be destroyed
let filmChartInstance = null;

// Function to fetch data and render the chart
async function renderChart() {
    const errorMessageDiv = document.getElementById('errorMessage');
    const lightTextColor = '#d1d5db'; // Tailwind gray-300 for text in dark mode
    const gridColor = 'rgba(209, 213, 219, 0.2)'; // Lighter grid lines for dark mode

    try {
        // Fetch data from the Go API endpoint
        const response = await fetch('http://localhost:8080/film-count-by-release-year');

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}. ${errorText ? 'Server says: ' + errorText : ''}`);
        }

        const chartData = await response.json();

        if (!chartData || !chartData.labels || !chartData.datasets || chartData.datasets.length === 0) {
            throw new Error('Fetched data is not in the expected format for Chart.js.');
        }

        const ctx = document.getElementById('filmCountChart').getContext('2d');

        // Destroy existing chart instance if it exists
        if (filmChartInstance) {
            filmChartInstance.destroy();
        }

        // Create the new chart instance
        filmChartInstance = new Chart(ctx, { // Assign to the global variable
            type: 'bar',
            data: {
                labels: chartData.labels,
                datasets: chartData.datasets.map(dataset => ({
                    label: dataset.label || 'Movies Watched',
                    data: dataset.data,
                    backgroundColor: dataset.backgroundColor && dataset.backgroundColor.length > 0 ? dataset.backgroundColor[0] : 'rgba(59, 130, 246, 0.7)',
                    borderColor: dataset.borderColor && dataset.borderColor.length > 0 ? dataset.borderColor[0] : 'rgba(59, 130, 246, 1)',
                    borderWidth: dataset.borderWidth || 1,
                    borderRadius: 2,
                    hoverBackgroundColor: dataset.backgroundColor && dataset.backgroundColor.length > 0 ? dataset.backgroundColor[0].replace('0.7', '0.9') : 'rgba(59, 130, 246, 0.9)',
                }))
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: 1000, 
                    easing: 'easeInOutQuart',
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Movies Watched',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: lightTextColor
                        },
                        ticks: {
                            color: lightTextColor
                        },
                        grid: {
                            color: gridColor
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Release Year',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: lightTextColor
                        },
                        ticks: {
                            color: lightTextColor
                        },
                        grid: {
                            color: gridColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: lightTextColor
                        }
                    },
                    tooltip: {
                        enabled: true,
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: {
                            size: 14,
                            weight: 'bold',
                        },
                        bodyFont: {
                            size: 12,
                        },
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        displayColors: false,
                    }
                }
            }
        });
        errorMessageDiv.classList.add('hidden'); // Hide error message on success
    } catch (error) {
        console.error('Error rendering chart:', error);
        errorMessageDiv.textContent = `Could not load chart data: ${error.message}. Please ensure the API is running and accessible.`;
        errorMessageDiv.classList.remove('hidden');
    }
}

// Call the function to render the chart when the page loads
if (document.readyState === 'loading') { 
    document.addEventListener('DOMContentLoaded', renderChart);
} else { 
    renderChart();
}
