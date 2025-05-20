package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
)

// Content types constants for consistency
const (
	contentTypeHTML = "text/html; charset=utf-8"
	contentTypeCSS  = "text/css; charset=utf-8"
	contentTypeJS   = "application/javascript; charset=utf-8"
)

// registerStaticAsset creates a handler for a specific static file.
// - mux: The ServeMux to register the route with.
// - urlRoute: The URL path for the asset (e.g., "/style.css").
// - assetRelPath: The file path relative to the "static" directory (e.g., "css/style.css").
// - contentType: The MIME type of the asset.
func registerStaticAsset(mux *http.ServeMux, urlRoute string, assetRelPath string, contentType string) {
	fullDiskPath := filepath.Join("static", assetRelPath)

	mux.HandleFunc(urlRoute, func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s for %s", r.Method, r.URL.Path, r.RemoteAddr, urlRoute)

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Check if file exists (maintains original logging behavior)
		if _, err := os.Stat(fullDiskPath); os.IsNotExist(err) {
			log.Printf("Static file not found: %s (disk path) for route %s", fullDiskPath, urlRoute)
			http.NotFound(w, r)
			return
		}

		if contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		http.ServeFile(w, r, fullDiskPath)
	})
	log.Printf("Static asset registered: %s -> %s", urlRoute, fullDiskPath) // Added log for static asset registration
}

// registerAPIHandler registers an API endpoint and logs its registration.
func registerAPIHandler(mux *http.ServeMux, path string, handler http.HandlerFunc) {
	mux.HandleFunc(path, handler)
	log.Printf("API endpoint registered: %s", path)
}

// logServerStartupInfo logs messages about server startup and accessible URLs.
func logServerStartupInfo(port string, apiPaths []string) {
	baseURL := "http://localhost:" + port
	log.Printf("Server starting on port %s...", port)
	log.Printf("Access the application at %s/", baseURL)
	for _, apiPath := range apiPaths {
		log.Printf("API available at: %s%s", baseURL, apiPath)
	}
}

func main() {
	// Initialize Database Connection (assuming InitDB and db are defined elsewhere, typically api_handlers.go or a db.go)
	if err := InitDB(); err != nil {
		log.Fatalf("FATAL: Failed to initialize database: %v. Server cannot start without DB.", err)
	}
	// db.Close() will be handled in the server error block or via a defer if InitDB returns the db instance.

	port := "3000" // You can make this configurable via environment variable if needed
	mux := http.NewServeMux()

	// --- Static File Handlers ---

	// Root handler for index.html (special case)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		// Serve index.html only for the exact root path "/"
		if r.URL.Path == "/" {
			htmlFilePath := filepath.Join("static", "index.html")
			// Check if index.html exists
			if _, err := os.Stat(htmlFilePath); os.IsNotExist(err) {
				log.Printf("File not found: %s (index.html)", htmlFilePath)
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", contentTypeHTML)
			http.ServeFile(w, r, htmlFilePath)
		} else {
			// For any other path not explicitly handled, let other handlers try,
			// or if no other handler matches, it will implicitly be a 404.
			// We can explicitly serve 404 if we want to prevent any ambiguity
			// but usually the ServeMux handles this if no other route matches.
			// For clarity, if we want to ensure only defined static assets and API routes are served:
			// http.NotFound(w, r) // This line would make any non-defined path a 404 immediately.
			// However, typically we let other registered handlers attempt to match first.
			// The current setup is fine; if no other handler matches, it will be a 404.
		}
	})
	log.Printf("Root handler registered for / -> static/index.html")

	// Register other static assets
	registerStaticAsset(mux, "/style.css", "css/style.css", contentTypeCSS)
	registerStaticAsset(mux, "/MoviesByReleaseYearChart.js", "js/charts/MoviesByReleaseYearChart.js", contentTypeJS)
	registerStaticAsset(mux, "/MoviesByGenrePieChart.js", "js/charts/MoviesByGenrePieChart.js", contentTypeJS)
	registerStaticAsset(mux, "/TopDirectorsChart.js", "js/charts/TopDirectorsChart.js", contentTypeJS)
	registerStaticAsset(mux, "/TopActorsChart.js", "js/charts/TopActorsChart.js", contentTypeJS)
	registerStaticAsset(mux, "/ChartConfig.js", "js/ChartConfig.js", contentTypeJS)
	registerStaticAsset(mux, "/fullscreenChart.js", "js/fullscreenChart.js", contentTypeJS)
	registerStaticAsset(mux, "/statsLoader.js", "js/statsLoader.js", contentTypeJS) // Added statsLoader.js
	registerStaticAsset(mux, "/mostRewatchedMovies.js", "js/charts/mostRewatchedMovies.js", contentTypeJS)

	// --- API Endpoints ---
	// (Assuming handler functions like filmCountByReleaseYearHandler are defined in api_handlers.go)
	apiPaths := []string{
		"/api/film-count-by-release-year",
		"/api/film-count-by-genre",
		"/api/top-directors",
		"/api/top-actors",
		"/api/stats/total-watched",
		"/api/stats/total-rated",
		"/api/stats/total-hours",
		"/api/stats/rewatches",
		"/api/most-rewatched-movies", // New API endpoint
	}

	registerAPIHandler(mux, apiPaths[0], filmCountByReleaseYearHandler)
	registerAPIHandler(mux, apiPaths[1], filmCountByGenreHandler)
	registerAPIHandler(mux, apiPaths[2], topDirectorsHandler)
	registerAPIHandler(mux, apiPaths[3], topActorsHandler)
	registerAPIHandler(mux, apiPaths[4], totalMoviesWatchedHandler)
	registerAPIHandler(mux, apiPaths[5], totalMoviesRatedHandler)
	registerAPIHandler(mux, apiPaths[6], totalHoursWatchedHandler)
	registerAPIHandler(mux, apiPaths[7], rewatchStatsHandler)
	registerAPIHandler(mux, apiPaths[8], mostRewatchedMoviesHandler) // Register new handler

	// --- Server Startup ---
	logServerStartupInfo(port, apiPaths)

	serverErr := http.ListenAndServe(":"+port, mux)
	if serverErr != nil {
		// Assuming 'db' is a global variable accessible here (e.g., from api_handlers.go or a db.go file in package main)
		if db != nil {
			log.Println("Closing database connection due to server error...")
			err := db.Close()
			if err != nil {
				log.Printf("Error closing database connection: %v", err)
			}
		}
		log.Fatalf("Error starting server: %s\n", serverErr)
	}
}
