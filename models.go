package main

// ChartData struct to hold the data for Charts.js
type ChartData struct {
	Labels   []string  `json:"labels"`
	Datasets []Dataset `json:"datasets"`
}

// Dataset struct for ChartData
type Dataset struct {
	Label string `json:"label"`
	Data  []int  `json:"data"`
	// Optional: Add other Chart.js dataset properties if needed globally
	// BackgroundColor []string `json:"backgroundColor,omitempty"`
	// BorderColor     []string `json:"borderColor,omitempty"`
	// BorderWidth     int      `json:"borderWidth,omitempty"`
}
