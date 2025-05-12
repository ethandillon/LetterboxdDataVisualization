package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	// Initialize Database Connection (from DataRequestHandler.go)
	// This will make the 'db' variable in DataRequestHandler.go available.
	if err := InitDB(); err != nil {
		log.Fatalf("FATAL: Failed to initialize database: %v. Server cannot start without DB.", err)
	}
	// If InitDB was successful, the global `db` variable (in DataRequestHandler.go, package main) is initialized.
	// It's good practice to ensure db is closed on application exit, though ListenAndServe blocks.
	// A defer here won't run until ListenAndServe errors or the program is terminated.
	// If the server stops gracefully, db might not be closed.
	// For robust applications, signal handling for graceful shutdown is recommended.
	// defer func() {
	// 	if db != nil {
	// 		log.Println("Closing database connection on server shutdown...")
	// 		db.Close()
	// 	}
	// }()

	port := "3000" // Port for the main web server and API
	mux := http.NewServeMux()

	// Handler for the root path ("/") to serve index.html
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if r.URL.Path != "/" {
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

	// Handler for /style.css
	mux.HandleFunc("/style.css", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		cssFilePath := filepath.Join("static", "css", "style.css")
		if _, err := os.Stat(cssFilePath); os.IsNotExist(err) {
			log.Printf("File not found: %s", cssFilePath)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		http.ServeFile(w, r, cssFilePath)
	})

	// Handler for /MoviesByReleaseYearChart.js
	mux.HandleFunc("/MoviesByReleaseYearChart.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		jsFilePath := filepath.Join("static", "js", "charts", "MoviesByReleaseYearChart.js")
		if _, err := os.Stat(jsFilePath); os.IsNotExist(err) {
			log.Printf("File not found: %s", jsFilePath)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8") // Correct MIME type
		http.ServeFile(w, r, jsFilePath)
	})

	// Handler for /ChartConfig.js
	mux.HandleFunc("/ChartConfig.js", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Request: %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		jsFilePath := filepath.Join("static", "js", "ChartConfig.js")
		if _, err := os.Stat(jsFilePath); os.IsNotExist(err) {
			log.Printf("File not found: %s", jsFilePath)
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8") // Correct MIME type
		http.ServeFile(w, r, jsFilePath)
	})

	// Register the API handler from DataRequestHandler.go
	// This uses the filmCountByReleaseYearHandler function and the `db` variable
	// from DataRequestHandler.go, as they are in the same `main` package.
	mux.HandleFunc("/film-count-by-release-year", filmCountByReleaseYearHandler)
	log.Printf("API endpoint /film-count-by-release-year registered.")

	log.Printf("Server starting on port %s...", port)
	log.Printf("Access the application at http://localhost:%s/", port)
	log.Printf("API data available at http://localhost:%s/film-count-by-release-year", port)

	serverErr := http.ListenAndServe(":"+port, mux)
	if serverErr != nil {
		// If db was initialized, attempt to close it.
		if db != nil {
			log.Println("Closing database connection due to server error...")
			db.Close()
		}
		log.Fatalf("Error starting server: %s\n", serverErr)
	}
}
