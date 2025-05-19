package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"strconv"

	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

// Global variable for the database connection, accessible within package main
var db *sql.DB

// InitDB initializes the database connection.
func InitDB() error {
	err := godotenv.Load()
	if err != nil {
		log.Printf("Warning: Error loading .env file: %v. Will attempt to use system environment variables.", err)
	}

	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbDriver := os.Getenv("DB_DRIVER")

	if dbDriver == "" {
		dbDriver = "postgres"
		log.Println("DB_DRIVER not set, defaulting to 'postgres'")
	}
	if dbDriver != "postgres" {
		return fmt.Errorf("this API is configured for PostgreSQL. Please check DB_DRIVER. Found: %s", dbDriver)
	}
	if dbHost == "" || dbPort == "" || dbUser == "" || dbName == "" {
		log.Println("Warning: One or more essential DB connection parameters (DB_HOST, DB_PORT, DB_USER, DB_NAME) are missing.")
	}

	psqlInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)

	db, err = sql.Open(dbDriver, psqlInfo)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %w", err)
	}

	err = db.Ping()
	if err != nil {
		db.Close()
		return fmt.Errorf("failed to ping database: %w", err)
	}
	log.Println("Successfully connected to the PostgreSQL database!")
	return nil
}

func filmCountByReleaseYearHandler(w http.ResponseWriter, r *http.Request) {
	chartData, err := FetchFilmCountsByYear() // Call function from db_queries.go
	if err != nil {
		http.Error(w, "Failed to fetch film counts by year: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error for year chart:", err)
	}
}

func filmCountByGenreHandler(w http.ResponseWriter, r *http.Request) {
	chartData, err := FetchFilmCountsByGenre() // Call function from db_queries.go
	if err != nil {
		http.Error(w, "Failed to fetch film counts by genre: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error for genre chart:", err)
	}
}

func topDirectorsHandler(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 25 // Default to 25 if no limit is specified or if parsing fails

	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err == nil && parsedLimit > 0 {
			limit = parsedLimit
		} else {
			log.Printf("Invalid limit parameter: %s. Using default %d.", limitStr, limit)
		}
	}

	chartData, err := FetchTopDirectors(limit) // Call function from db_queries.go
	if err != nil {
		log.Printf("Error fetching top directors data with limit %d: %v", limit, err)
		http.Error(w, "Failed to fetch top directors data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error for top 5 directors chart:", err)
	}
}

func topActorsHandler(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 25 // Default to 25 if no limit is specified or if parsing fails

	if limitStr != "" {
		parsedLimit, err := strconv.Atoi(limitStr)
		if err == nil && parsedLimit > 0 {
			limit = parsedLimit
		} else {
			log.Printf("Invalid limit parameter: %s. Using default %d.", limitStr, limit)
		}
	}

	chartData, err := FetchTopActors(limit) // Call function from db_queries.go
	if err != nil {
		log.Printf("Error fetching top Actors data with limit %d: %v", limit, err)
		http.Error(w, "Failed to fetch top Actors data", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(chartData); err != nil {
		http.Error(w, "Failed to encode JSON response: "+err.Error(), http.StatusInternalServerError)
		log.Println("JSON encoding error for top 5 Actors chart:", err)
	}
}

func totalMoviesWatchedHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := FetchTotalMoviesWatched()
	if err != nil {
		http.Error(w, "Failed to fetch total movies watched: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func totalMoviesRatedHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := FetchTotalMoviesRated()
	if err != nil {
		http.Error(w, "Failed to fetch total movies rated: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func totalHoursWatchedHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := FetchTotalHoursWatched()
	if err != nil {
		http.Error(w, "Failed to fetch total hours watched: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func rewatchStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := FetchRewatchStats()
	if err != nil {
		http.Error(w, "Failed to fetch rewatch stats: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}
