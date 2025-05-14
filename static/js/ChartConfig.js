// ChartConfig.js

// Create a global namespace object to hold all chart configurations
var MyAppCharts = MyAppCharts || {}; // Ensure it exists or create it

// Simple deep merge function to safely merge options into Chart.js defaults
function _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && !(source[key] instanceof Array) &&
            key in target && target[key] instanceof Object && !(target[key] instanceof Array)) {
            _deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key]; // Assign if source[key] is not an object or target[key] is not an object
        }
    }
    return target;
}


MyAppCharts.colors = {
    primary: 'rgba(59, 130, 246, 0.7)',
    primaryHover: 'rgba(59, 130, 246, 0.9)',
    primaryBorder: 'rgba(59, 130, 246, 1)',
    lightTextColor: '#d1d5db',
    gridColor: 'rgba(209, 213, 219, 0.2)',
    tooltipBackground: 'rgba(0,0,0,0.8)',
    tooltipTextColor: '#ffffff',
    headerTextColor: 'rgb(255, 255, 255)', // Using this for titles
    // ... other colors
};

// Define a new color palette for Pie/Doughnut charts
MyAppCharts.pieColors = [
    '#3b82f6', '#60a5fa', // Blue shades
    '#ec4899', '#f472b6', // Pink shades
    '#14b8a6', '#2dd4bf', // Teal shades
    '#f97316', '#fb923c', // Orange shades
    '#8b5cf6', '#a78bfa', // Violet shades
    '#eab308', '#fde047', // Yellow shades
    '#22c55e', '#4ade80', // Green shades
    '#6b7280', '#9ca3af'  // Gray shades
];


MyAppCharts.globalOptions = {
    responsive: true,
    maintainAspectRatio: false, // Changed to false for better fit in containers
    animation: {
        duration: 1000,
        easing: 'easeInOutQuart',
    },
    plugins: {
        title: {
            display: true,
            align: 'center',
            padding: {
                top: 10,
                bottom: 20
            },
            font: {
                size: 20,
                weight: 'bold',
                family: 'Inter',
            },
            color: MyAppCharts.colors.headerTextColor,
        },
        legend: {
            display: true,
            position: 'top',
            labels: {
                color: MyAppCharts.colors.lightTextColor,
                font: {
                    size: 12,
                    family: 'Inter'
                },
                boxWidth: 12,
                padding: 10
            }
        },
        tooltip: {
            enabled: true,
            mode: 'nearest',
            intersect: false,
            backgroundColor: MyAppCharts.colors.tooltipBackground,
            titleColor: MyAppCharts.colors.tooltipTextColor,
            bodyColor: MyAppCharts.colors.tooltipTextColor,
            displayColors: true,
            padding: 10,
            titleFont: {
                size: 14,
                weight: 'bold',
                family: 'Inter'
            },
            bodyFont: {
                size: 12,
                family: 'Inter'
            }
        }
    },
    scales: {
        x: {
            title: {
                display: true,
                font: { size: 14, weight: 'bold', family: 'Inter' },
                color: MyAppCharts.colors.lightTextColor
            },
            ticks: { color: MyAppCharts.colors.lightTextColor },
            grid: { color: MyAppCharts.colors.gridColor }
        },
        y: {
            beginAtZero: true,
            title: {
                display: true,
                font: { size: 14, weight: 'bold', family: 'Inter' },
                color: MyAppCharts.colors.lightTextColor
            },
            ticks: { color: MyAppCharts.colors.lightTextColor },
            grid: { color: MyAppCharts.colors.gridColor }
        }
    }
};

MyAppCharts.defaultBarDatasetOptions = {
    backgroundColor: MyAppCharts.colors.primary,
    borderColor: MyAppCharts.colors.primaryBorder,
    borderWidth: 1,
    borderRadius: 2,
    hoverBackgroundColor: MyAppCharts.colors.primaryHover,
};

MyAppCharts.defaultPieDoughnutDatasetOptions = {
    backgroundColor: MyAppCharts.pieColors,
    borderColor: '#1f2937',
    borderWidth: 2,
    hoverOffset: 8,
    hoverBorderColor: '#374151',
    hoverBorderWidth: 3
};


function applyChartDefaults() {
    if (typeof Chart === 'undefined') {
        console.error("Chart.js is not loaded yet. Cannot apply defaults.");
        return;
    }
    if (!MyAppCharts || !MyAppCharts.globalOptions) {
        console.error("MyAppCharts.globalOptions is not defined. Cannot apply defaults.");
        return;
    }

    console.log("Applying MyAppCharts defaults to Chart.js...");

    if (MyAppCharts.globalOptions.responsive !== undefined) {
        Chart.defaults.responsive = MyAppCharts.globalOptions.responsive;
    }
    if (MyAppCharts.globalOptions.maintainAspectRatio !== undefined) {
        Chart.defaults.maintainAspectRatio = MyAppCharts.globalOptions.maintainAspectRatio;
    }
    if (MyAppCharts.globalOptions.animation) {
        Chart.defaults.animation = Chart.defaults.animation || {};
        _deepMerge(Chart.defaults.animation, MyAppCharts.globalOptions.animation);
    }

    // Apply plugin defaults
    if (MyAppCharts.globalOptions.plugins) {
        Chart.defaults.plugins = Chart.defaults.plugins || {};

        // *** THIS WAS THE MISSING PIECE ***
        if (MyAppCharts.globalOptions.plugins.title) {
            Chart.defaults.plugins.title = Chart.defaults.plugins.title || {};
            _deepMerge(Chart.defaults.plugins.title, MyAppCharts.globalOptions.plugins.title);
        }
        // *** END OF FIX ***

        if (MyAppCharts.globalOptions.plugins.legend) {
            Chart.defaults.plugins.legend = Chart.defaults.plugins.legend || {};
            _deepMerge(Chart.defaults.plugins.legend, MyAppCharts.globalOptions.plugins.legend);
        }
        if (MyAppCharts.globalOptions.plugins.tooltip) {
            Chart.defaults.plugins.tooltip = Chart.defaults.plugins.tooltip || {};
            _deepMerge(Chart.defaults.plugins.tooltip, MyAppCharts.globalOptions.plugins.tooltip);
        }
    }

    if (MyAppCharts.globalOptions.scales) {
        const xStyleDefaults = MyAppCharts.globalOptions.scales.x;
        if (xStyleDefaults) {
            Chart.defaults.scale.title = Chart.defaults.scale.title || {};
            _deepMerge(Chart.defaults.scale.title, xStyleDefaults.title);
            if (Chart.defaults.scale.title) delete Chart.defaults.scale.title.text;

            Chart.defaults.scale.ticks = Chart.defaults.scale.ticks || {};
            _deepMerge(Chart.defaults.scale.ticks, xStyleDefaults.ticks);
            
            Chart.defaults.scale.grid = Chart.defaults.scale.grid || {};
            _deepMerge(Chart.defaults.scale.grid, xStyleDefaults.grid);
        }
        
        const ySpecificDefaults = MyAppCharts.globalOptions.scales.y;
        if (ySpecificDefaults) { // Check if ySpecificDefaults exists
            if (ySpecificDefaults.beginAtZero !== undefined) {
                Chart.defaults.scales.linear = Chart.defaults.scales.linear || {};
                Chart.defaults.scales.linear.beginAtZero = ySpecificDefaults.beginAtZero;
            }
            // For y-axis title, ticks, grid, if they were different from x, you'd merge them specifically
            // For now, they'll inherit from the general Chart.defaults.scale settings applied via xStyleDefaults
        }
    }

    if (MyAppCharts.defaultBarDatasetOptions) {
        Chart.defaults.datasets = Chart.defaults.datasets || {};
        Chart.defaults.datasets.bar = Chart.defaults.datasets.bar || {};
        _deepMerge(Chart.defaults.datasets.bar, MyAppCharts.defaultBarDatasetOptions);
    }
    
    if (MyAppCharts.defaultPieDoughnutDatasetOptions) {
        Chart.defaults.datasets = Chart.defaults.datasets || {};
        Chart.defaults.datasets.pie = Chart.defaults.datasets.pie || {};
        _deepMerge(Chart.defaults.datasets.pie, MyAppCharts.defaultPieDoughnutDatasetOptions);
        
        Chart.defaults.datasets.doughnut = Chart.defaults.datasets.doughnut || {};
        _deepMerge(Chart.defaults.datasets.doughnut, MyAppCharts.defaultPieDoughnutDatasetOptions);
    }

    console.log("Chart.js defaults AFTER MyAppCharts merge (Title):", JSON.parse(JSON.stringify(Chart.defaults.plugins.title)));
    // console.log("Chart.js defaults after MyAppCharts merge (Full):", JSON.parse(JSON.stringify(Chart.defaults))); // For more extensive debugging
}

applyChartDefaults();