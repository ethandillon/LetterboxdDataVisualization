package main

import (
	"log"
	"net/http"
	"os" // Needed for checking file existence
	"path/filepath"
)

func main() {
	port := "3000"
	mux := http.NewServeMux()

	// Handler for the root path ("/") to serve index.html
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Basic request logging
		log.Printf("Received request for: %s from %s", r.URL.Path, r.RemoteAddr)

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		htmlFileName := "index.html"
		// Assume index.html is in the current directory
		htmlFilePath, err := filepath.Abs("./" + htmlFileName)
		if err != nil {
			// Log error if path resolution fails
			log.Printf("Error resolving path for %s: %v", htmlFileName, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Check if file exists
		if _, err := os.Stat(htmlFilePath); os.IsNotExist(err) {
			log.Printf("HTML file not found: %s", htmlFilePath)
			http.NotFound(w, r)
			return
		}

		http.ServeFile(w, r, htmlFilePath)
		// log.Printf("Served %s to %s", htmlFilePath, r.RemoteAddr) // Optional: log successful serving
	})

	// Handler for /style.css to serve the CSS file
	mux.HandleFunc("/style.css", func(w http.ResponseWriter, r *http.Request) {
		// Basic request logging
		log.Printf("Received request for CSS: %s from %s", r.URL.Path, r.RemoteAddr)

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		cssFileName := "style.css"
		// Assume style.css is in the current directory
		cssFilePath, err := filepath.Abs("./" + cssFileName)
		if err != nil {
			// Log error if path resolution fails
			log.Printf("Error resolving path for %s: %v", cssFileName, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Check if file exists
		if _, err := os.Stat(cssFilePath); os.IsNotExist(err) {
			log.Printf("CSS file not found: %s", cssFilePath)
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		http.ServeFile(w, r, cssFilePath)
		// log.Printf("Served %s to %s", cssFilePath, r.RemoteAddr) // Optional: log successful serving
	})

	// Handler for /ChartRenderingScript.js to serve the CSS file
	mux.HandleFunc("/ChartRenderingScript.js", func(w http.ResponseWriter, r *http.Request) {
		// Basic request logging
		log.Printf("Received request for js: %s from %s", r.URL.Path, r.RemoteAddr)

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		jsFileName := "ChartRenderingScript.js"
		// Assume ChartRenderingScript.js is in the current directory
		jsFilePath, err := filepath.Abs("./" + jsFileName)
		if err != nil {
			// Log error if path resolution fails
			log.Printf("Error resolving path for %s: %v", jsFileName, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Check if file exists
		if _, err := os.Stat(jsFilePath); os.IsNotExist(err) {
			log.Printf("js file not found: %s", jsFilePath)
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/js; charset=utf-8")
		http.ServeFile(w, r, jsFilePath)
		// log.Printf("Served %s to %s", jsFilePath, r.RemoteAddr) // Optional: log successful serving
	})

	// Handler for /ChartConfig.js to serve the CSS file
	mux.HandleFunc("/ChartConfig.js", func(w http.ResponseWriter, r *http.Request) {
		// Basic request logging
		log.Printf("Received request for js: %s from %s", r.URL.Path, r.RemoteAddr)

		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		jsFileName := "ChartConfig.js"
		// Assume ChartConfig.js is in the current directory
		jsFilePath, err := filepath.Abs("./" + jsFileName)
		if err != nil {
			// Log error if path resolution fails
			log.Printf("Error resolving path for %s: %v", jsFileName, err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		// Check if file exists
		if _, err := os.Stat(jsFilePath); os.IsNotExist(err) {
			log.Printf("js file not found: %s", jsFilePath)
			http.NotFound(w, r)
			return
		}

		w.Header().Set("Content-Type", "text/js; charset=utf-8")
		http.ServeFile(w, r, jsFilePath)
		// log.Printf("Served %s to %s", jsFilePath, r.RemoteAddr) // Optional: log successful serving
	})

	log.Printf("Server starting on port %s...", port)
	log.Printf("Access the page at http://localhost:%s/", port)

	serverErr := http.ListenAndServe(":"+port, mux)
	if serverErr != nil {
		log.Fatalf("Error starting server: %s\n", serverErr)
	}
}
