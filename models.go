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

// StatCount struct for simple count statistics.
type StatCount struct {
	Count int64 `json:"count"`
}

// HoursWatchedStat struct for total hours watched statistics.
type HoursWatchedStat struct {
	TotalHours float64 `json:"total_hours"`
}

// RewatchStatsData struct for rewatch vs new watch statistics.
type RewatchStatsData struct {
	Rewatches  int64 `json:"rewatches"`
	NewWatches int64 `json:"new_watches"`
}

type RewatchedMovieData struct {
	FilmID       int    `json:"film_id"`
	Title        string `json:"title"`
	PosterPath   string `json:"poster_path"`
	FilmLink     string `json:"letterboxd_uri"`
	RewatchCount int    `json:"rewatch_count"`
}

type MoviesWatchedOverTimeChartData struct {
	Labels   []interface{} `json:"labels"` // MODIFIED: Changed from []string to []interface{}
	Datasets []Dataset     `json:"datasets"`
}

// TopCreditData holds information for a single top actor or director.
type TopCreditData struct {
	Name        string `json:"name"`
	FilmCount   int    `json:"filmCount"`
	ProfilePath string `json:"profilePath,omitempty"` // omitempty if no path or it's an empty string
}
