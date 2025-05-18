package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// Initialize Database Connection (from api_handlers.go)
	if err := InitDB(); err != nil {
		log.Fatalf("FATAL: Failed to initialize database: %v. Server cannot start without DB.", err)
	}
	// defer func() { // Ensure DB connection is closed when main exits (e.g., on server error)
	// 	if db != nil {
	// 		log.Println("Closing database connection on server shutdown...")
	// 		db.Close()
	// 	}
	// }()

	port := "3000"
	mux := http.NewServeMux()

	// --- Static File Handlers ---
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/" {
			// Serve static files if path is not root, or 404
			// This simple example only serves index.html at root.
			// For a more general static file server, see http.FileServer.
			http.NotFound(w, r)
			return
		}
		htmlFilePath := filepath.Join("static", "index.html")
		if _, err := os.Stat(htmlFilePath); os.IsNotExist(err) {
			log.Printf("File not found: %s", htmlFilePath)
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, htmlFilePath)
	})

	mux.HandleFunc("/style.css", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		cssFilePath := filepath.Join("static", "css", "style.css")
		serveStaticFile(w, r, cssFilePath, "text/css; charset=utf-8")
	})

	mux.HandleFunc("/MoviesByReleaseYearChart.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		jsFilePath := filepath.Join("static", "js", "charts", "MoviesByReleaseYearChart.js")
		serveStaticFile(w, r, jsFilePath, "application/javascript; charset=utf-8")
	})

	// Example: Add a route for a new JS chart file for genres
	mux.HandleFunc("/MoviesByGenrePieChart.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		jsFilePath := filepath.Join("static", "js", "charts", "MoviesByGenrePieChart.js") // Assume you create this file
		serveStaticFile(w, r, jsFilePath, "application/javascript; charset=utf-8")
	})

	mux.HandleFunc("/TopDirectorsChart.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		jsFilePath := filepath.Join("static", "js", "charts", "TopDirectorsChart.js") // Assume you create this file
		serveStaticFile(w, r, jsFilePath, "application/javascript; charset=utf-8")
	})

	mux.HandleFunc("/ChartConfig.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		jsFilePath := filepath.Join("static", "js", "ChartConfig.js")
		serveStaticFile(w, r, jsFilePath, "application/javascript; charset=utf-8")
	})

	mux.HandleFunc("/fullscreenChart.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		jsFilePath := filepath.Join("static", "js", "fullscreenChart.js")
		serveStaticFile(w, r, jsFilePath, "application/javascript; charset=utf-8")
	})

	// --- API Endpoints ---
	// Using /api/ prefix for API routes is a good practice
	mux.HandleFunc("/api/film-count-by-release-year", filmCountByReleaseYearHandler)
	mux.HandleFunc("/api/film-count-by-genre", filmCountByGenreHandler)
	mux.HandleFunc("/api/top-directors", topDirectorsHandler)

	log.Printf("API endpoint /api/film-count-by-release-year registered.")
	log.Printf("API endpoint /api/film-count-by-genre registered.")
	log.Printf("API endpoint /api/top-directors registered.")

	log.Printf("Server starting on port %s...", port)
	log.Printf("Access the application at http://localhost:%s/", port)
	log.Printf("API data by year: http://localhost:%s/api/film-count-by-release-year", port)
	log.Printf("API data by genre: http://localhost:%s/api/film-count-by-genre", port)
	log.Printf("API data by top directors: http://localhost:%s/api/top-directors", port)

	serverErr := http.ListenAndServe(":"+port, mux)
	if serverErr != nil {
		if db != nil { // db is the global variable from api_handlers.go
			log.Println("Closing database connection due to server error...")
			db.Close()
		}
		log.Fatalf("Error starting server: %s\n", serverErr)
	}
}

// Helper function to serve static files
func serveStaticFile(w http.ResponseWriter, r *http.Request, filePath string, contentType string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Printf("Static file not found: %s", filePath)
		http.NotFound(w, r)
		return
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	http.ServeFile(w, r, filePath)
}
