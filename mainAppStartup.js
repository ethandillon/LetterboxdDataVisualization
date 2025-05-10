// mainAppStartup.js
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/auto/+esm';
import { globalChartOptions, defaultBarDatasetOptions, defaultLineDatasetOptions, chartColors } from './ChartConfig.js'; // Assuming chartColors is exported for this

console.log("mainAppStartup.js: Chart imported:", Chart);
console.log("mainAppStartup.js: globalChartOptions imported:", JSON.parse(JSON.stringify(globalChartOptions)));

// Apply general defaults (excluding plugins for a moment)
const { plugins, ...otherGlobalOptions } = globalChartOptions;
Object.assign(Chart.defaults, otherGlobalOptions);

// Apply plugin defaults more specifically
// For the legend:
if (plugins && plugins.legend) {
    // Chart.defaults.plugins.legend = { ...Chart.defaults.plugins.legend, ...plugins.legend }; // Merge
    // OR, if you want to be very direct for testing:
    Chart.defaults.plugins.legend = plugins.legend;
    console.log("Manually set Chart.defaults.plugins.legend to:", JSON.parse(JSON.stringify(Chart.defaults.plugins.legend)));
} else {
    console.warn("globalChartOptions.plugins.legend is not defined!");
}

// For the tooltip (example):
if (plugins && plugins.tooltip) {
    // Chart.defaults.plugins.tooltip = { ...Chart.defaults.plugins.tooltip, ...plugins.tooltip }; // Merge
    Chart.defaults.plugins.tooltip = plugins.tooltip; // Direct set for testing
    console.log("Manually set Chart.defaults.plugins.tooltip to:", JSON.parse(JSON.stringify(Chart.defaults.plugins.tooltip)));
}


// --- The rest of your default settings ---
// Specific dataset defaults
if (!Chart.defaults.elements) Chart.defaults.elements = {};
if (!Chart.defaults.elements.bar) Chart.defaults.elements.bar = {};

if (!Chart.defaults.datasets) Chart.defaults.datasets = {};
Chart.defaults.datasets.bar = { ...Chart.defaults.datasets.bar, ...defaultBarDatasetOptions };
Chart.defaults.datasets.line = { ...Chart.defaults.datasets.line, ...defaultLineDatasetOptions };

if (!Chart.defaults.scale) Chart.defaults.scale = {};

console.log("mainAppStartup.js: Chart.defaults fully configured. Check expanded object below:");
console.log(Chart.defaults); // Log the whole defaults object