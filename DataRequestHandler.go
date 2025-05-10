package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/joho/godotenv" // For loading .env files
	_ "github.com/lib/pq"      // PostgreSQL driver
)

// Struct to hold the data for Charts.js
type ChartData struct {
	Labels   []string  `json:"labels"` // Years
	Datasets []Dataset `json:"datasets"`
}

type Dataset struct {
	Label string `json:"label"` // e.g., "Movies Watched"
	Data  []int  `json:"data"`  // Counts
}

// Global variable for the database connection
var db *sql.DB

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file: ", err)
	}

	// Database connection details from .env
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbDriver := os.Getenv("DB_DRIVER")

	if dbDriver != "postgres" {
		log.Fatalf("This API is configured for PostgreSQL. Please check DB_DRIVER in .env file. Found: %s", dbDriver)
	}

	psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Open database connection
	db, err = sql.Open(dbDriver, psqlInfo)
	if err != nil {
		log.Fatal("Failed to open database connection: ", err)
	}
	// It's good practice to defer db.Close() here if db is truly global and lives for the app's lifetime.
	// However, for many web servers, managing connection pools or per-request connections might be better.
	// For simplicity in this example, we'll keep it global and close on exit if main were to end.
	// But since ListenAndServe blocks, this defer might not run until server error.
	// Proper connection management is key in production.

	// Check the connection
	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to ping database: ", err)
	}
	fmt.Println("Successfully connected to the PostgreSQL database!")

	// Define API endpoints
	http.HandleFunc("/film-count-by-release-year", filmCountByReleaseYearHandler)

	// Start the server
	port := os.Getenv("API_PORT")
	if port == "" {
		port = "8080" // Default port
	}
	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func filmCountByReleaseYearHandler(w http.ResponseWriter, r *http.Request) {
	// Query the database
	// Since the entire table 'films' contains watched movies,
	// we group by the 'year' column (which corresponds to release_year).
	query := `
		SELECT 
			year, 
			COUNT(*) as movie_count 
		FROM 
			films 
		GROUP BY 
			year 
		ORDER BY 
			year ASC;
	`
	rows, err := db.Query(query)
	if err != nil {
		http.Error(w, "Database query failed: "+err.Error(), http.StatusInternalServerError)
		log.Println("Database query error:", err)
		return
	}
	defer rows.Close()

	var years []string
	var counts []int

	for rows.Next() {
		var releaseYear sql.NullInt64 // Use sql.NullInt64 for potentially NULL year column
		var count int
		if err := rows.Scan(&releaseYear, &count); err != nil {
			http.Error(w, "Failed to scan row: "+err.Error(), http.StatusInternalServerError)
			log.Println("Row scanning error:", err)
			return
		}
		// Only include years that are not NULL
		if releaseYear.Valid {
			years = append(years, strconv.FormatInt(releaseYear.Int64, 10))
			counts = append(counts, count)
		}
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "Error during rows iteration: "+err.Error(), http.StatusInternalServerError)
		log.Println("Rows iteration error:", err)
		return
	}

	// Prepare data for Charts.js
	chartData := ChartData{
		Labels: years,
		Datasets: []Dataset{
			{
				Label: "Movies Watched", // Updated label
				Data:  counts,
				// Optional: Add some default styling for the chart
				// BackgroundColor: []string{"rgba(54, 162, 235, 0.2)"}, // Example blue
				// BorderColor:     []string{"rgba(54, 162, 235, 1)"},
				// BorderWidth: 1,
			},
		},
	}

	// Set content type to JSON
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*") // Optional: Add CORS header if frontend is on a different domain

	// Encode and send the JSON response
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error:", err)
	}
}
