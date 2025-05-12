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

// Global variable for the database connection, accessible within package main
var db *sql.DB

// InitDB initializes the database connection.
// It's called by main.go
func InitDB() error {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		// Log as a warning, as environment variables might be set directly (e.g., in production)
		log.Printf("Warning: Error loading .env file: %v. Will attempt to use system environment variables.", err)
	}

	// Database connection details from .env or system environment
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbDriver := os.Getenv("DB_DRIVER")

	if dbDriver == "" {
		dbDriver = "postgres" // Default to postgres if not set
		log.Println("DB_DRIVER not set, defaulting to 'postgres'")
	}

	if dbDriver != "postgres" {
		return fmt.Errorf("this API is configured for PostgreSQL. Please check DB_DRIVER in environment. Found: %s", dbDriver)
	}

	// Basic check for essential connection parameters
	if dbHost == "" || dbPort == "" || dbUser == "" || dbName == "" {
		log.Println("Warning: One or more essential DB connection parameters (DB_HOST, DB_PORT, DB_USER, DB_NAME) are missing from environment variables. Connection might fail.")
	}

	psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	// Open database connection
	db, err = sql.Open(dbDriver, psqlInfo)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}

	// Check the connection
	err = db.Ping()
	if err != nil {
		// It's good practice to close the db if ping fails after open
		db.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}
	log.Println("Successfully connected to the PostgreSQL database!")
	return nil
}

func filmCountByReleaseYearHandler(w http.ResponseWriter, r *http.Request) {
	if db == nil {
		log.Println("Error in filmCountByReleaseYearHandler: Database connection is not initialized.")
		http.Error(w, "Database connection not available", http.StatusInternalServerError)
		return
	}

	// Query the database
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
				Label: "Movies Watched",
				Data:  counts,
			},
		},
	}

	// Set content type to JSON
	w.Header().Set("Content-Type", "application/json")
	// CORS header might not be strictly needed if frontend and API are same-origin.
	// If you encounter CORS issues, uncomment this.
	// w.Header().Set("Access-Control-Allow-Origin", "*")

	// Encode and send the JSON response
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error:", err)
	}
}
