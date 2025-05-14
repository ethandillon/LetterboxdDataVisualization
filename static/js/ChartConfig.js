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
    // ... other colors
};

MyAppCharts.globalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 1000,
        easing: 'easeInOutQuart',
    },
    plugins: {
        legend: {
            display: true,
            position: 'top',
            labels: {
                color: MyAppCharts.colors.lightTextColor,
                font: {
                    size: 12,
                    family: 'Inter'
                }
            }
        },
        tooltip: {
            enabled: true,
            mode: 'index',
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
    scales: { // These are conceptual defaults for X and Y axes
        x: { // Style settings from here will be applied to Chart.defaults.scale
            title: {
                display: true,
                text: 'Default X Axis',
                font: { size: 14, weight: 'bold', family: 'Inter' },
                color: MyAppCharts.colors.lightTextColor
            },
            ticks: { color: MyAppCharts.colors.lightTextColor },
            grid: { color: MyAppCharts.colors.gridColor }
        },
        y: { // Specific properties like beginAtZero and styles (if different)
            beginAtZero: true,
            title: {
                display: true,
                text: 'Default Y Axis',
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

    // Apply global options using deep merge for objects
    if (MyAppCharts.globalOptions.responsive !== undefined) {
        Chart.defaults.responsive = MyAppCharts.globalOptions.responsive;
    }
    if (MyAppCharts.globalOptions.maintainAspectRatio !== undefined) {
        Chart.defaults.maintainAspectRatio = MyAppCharts.globalOptions.maintainAspectRatio;
    }
    if (MyAppCharts.globalOptions.animation) {
        _deepMerge(Chart.defaults.animation, MyAppCharts.globalOptions.animation);
    }

    // // Apply plugin defaults
    // if (MyAppCharts.globalOptions.plugins) {
    //     if (MyAppCharts.globalOptions.plugins.legend) {
    //         _deepMerge(Chart.defaults.plugins.legend, MyAppCharts.globalOptions.plugins.legend);
    //     }
    //     if (MyAppCharts.globalOptions.plugins.tooltip) {
    //         _deepMerge(Chart.defaults.plugins.tooltip, MyAppCharts.globalOptions.plugins.tooltip);
    //     }
    // }

    // Apply scale defaults (to Chart.defaults.scale for broad application)
    // We'll use settings from 'x' as the base for Chart.defaults.scale visual properties.
    // Individual charts can override axis titles.
    if (MyAppCharts.globalOptions.scales) {
        const xStyleDefaults = MyAppCharts.globalOptions.scales.x;
        if (xStyleDefaults) {
            if (xStyleDefaults.title) _deepMerge(Chart.defaults.scale.title, xStyleDefaults.title);
            if (xStyleDefaults.ticks) _deepMerge(Chart.defaults.scale.ticks, xStyleDefaults.ticks);
            if (xStyleDefaults.grid)  _deepMerge(Chart.defaults.scale.grid, xStyleDefaults.grid);
        }
        
        // Apply y-axis specific `beginAtZero` to linear scales or general scale default
        const ySpecificDefaults = MyAppCharts.globalOptions.scales.y;
        if (ySpecificDefaults && ySpecificDefaults.beginAtZero !== undefined) {
            if (Chart.defaults.scales && Chart.defaults.scales.linear) { // For Chart.js v3/4 structure
                Chart.defaults.scales.linear.beginAtZero = ySpecificDefaults.beginAtZero;
            } else { // Fallback for older or different structures
                Chart.defaults.scale.beginAtZero = ySpecificDefaults.beginAtZero;
            }
        }
        // If y-axis title/ticks/grid styles are meant to be different globally, this needs more complex logic
        // (e.g., using Chart.overrides). For now, x-axis styles are global, y-axis title text gets overridden in specific chart.
    }

    // Merge dataset specific defaults
    if (MyAppCharts.defaultBarDatasetOptions) {
        if (!Chart.defaults.datasets) Chart.defaults.datasets = {}; // Ensure datasets object exists
        if (!Chart.defaults.datasets.bar) Chart.defaults.datasets.bar = {}; // Ensure bar object exists
        _deepMerge(Chart.defaults.datasets.bar, MyAppCharts.defaultBarDatasetOptions);
    }
    // Add for other chart types like line, pie, etc.
    // if (MyAppCharts.defaultLineDatasetOptions) {
    //     if (!Chart.defaults.datasets.line) Chart.defaults.datasets.line = {};
    //     _deepMerge(Chart.defaults.datasets.line, MyAppCharts.defaultLineDatasetOptions);
    // }

    console.log("Chart.js defaults after MyAppCharts merge:", JSON.parse(JSON.stringify(Chart.defaults)));
}

// Call applyChartDefaults directly at the end of this script.
// This assumes Chart.js has been loaded before this script.
applyChartDefaults();