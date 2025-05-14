package main

import (
	"database/sql"
	"log"
	"strconv"
)

// FetchFilmCountsByYear queries the database for film counts grouped by release year.
// It uses the global 'db' connection from api_handlers.go (or wherever it's initialized in package main).
func FetchFilmCountsByYear() (ChartData, error) {
	if db == nil {
		log.Println("FetchFilmCountsByYear: Database connection is not initialized.")
		return ChartData{}, sql.ErrConnDone // Or a more specific error
	}

	query := `
		SELECT 
			year, 
			COUNT(*) as movie_count 
		FROM 
			films 
		WHERE 
			year IS NOT NULL
		GROUP BY 
			year 
		ORDER BY 
			year ASC;
	`
	rows, err := db.Query(query)
	if err != nil {
		log.Println("Database query error in FetchFilmCountsByYear:", err)
		return ChartData{}, err
	}
	defer rows.Close()

	var years []string
	var counts []int

	for rows.Next() {
		var releaseYear int64 // Year is not nullable in this specific query due to WHERE clause
		var count int
		if err := rows.Scan(&releaseYear, &count); err != nil {
			log.Println("Row scanning error in FetchFilmCountsByYear:", err)
			return ChartData{}, err
		}
		years = append(years, strconv.FormatInt(releaseYear, 10))
		counts = append(counts, count)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchFilmCountsByYear:", err)
		return ChartData{}, err
	}

	chartData := ChartData{
		Labels: years,
		Datasets: []Dataset{
			{
				Label: "Movies Watched",
				Data:  counts,
			},
		},
	}
	return chartData, nil
}

// FetchFilmCountsByGenre queries the database for film counts grouped by genre.
// It unnests the 'genres' array column.
// It uses the global 'db' connection.
func FetchFilmCountsByGenre() (ChartData, error) {
	if db == nil {
		log.Println("FetchFilmCountsByGenre: Database connection is not initialized.")
		return ChartData{}, sql.ErrConnDone // Or a more specific error
	}

	// The genres column is text[]
	// We need to unnest it and then group by the individual genre.
	query := `
		SELECT 
			g.genre_name, 
			COUNT(*) as movie_count 
		FROM 
			films,
			UNNEST(genres) AS g(genre_name) -- Unnest the array and alias the resulting column
		WHERE 
			g.genre_name IS NOT NULL AND g.genre_name <> '' -- Filter out NULL or empty genres
		GROUP BY 
			g.genre_name 
		ORDER BY 
			movie_count DESC;
	`
	rows, err := db.Query(query)
	if err != nil {
		log.Println("Database query error in FetchFilmCountsByGenre:", err)
		return ChartData{}, err
	}
	defer rows.Close()

	var genres []string
	var counts []int

	for rows.Next() {
		var genreName string
		var count int
		if err := rows.Scan(&genreName, &count); err != nil {
			log.Println("Row scanning error in FetchFilmCountsByGenre:", err)
			return ChartData{}, err
		}
		genres = append(genres, genreName)
		counts = append(counts, count)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchFilmCountsByGenre:", err)
		return ChartData{}, err
	}

	chartData := ChartData{
		Labels: genres,
		Datasets: []Dataset{
			{
				Label: "Movies by Genre",
				Data:  counts,
			},
		},
	}
	return chartData, nil
}
