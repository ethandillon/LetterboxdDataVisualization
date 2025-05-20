package main

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
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

// FetchTopDirectors retrieves the top 5 directors by the number of films they directed.
func FetchTopDirectors(limit int) (ChartData, error) {
	if db == nil {
		log.Println("FetchTopDirectors: Database connection is not initialized.")
		return ChartData{}, sql.ErrConnDone // Or a more specific error
	}

	// Query to get the top 5 directors by film count
	query := fmt.Sprintf(`
		SELECT
			director,
			COUNT(*) as film_count
		FROM
			films
		WHERE
			director IS NOT NULL AND director <> ''
		GROUP BY
			director
		ORDER BY
			film_count DESC
		LIMIT %d;
	`, limit)

	rows, err := db.Query(query)
	if err != nil {
		log.Println("Database query error in FetchTopDirectors:", err)
		return ChartData{}, err
	}
	defer rows.Close()

	var directorNames []string
	var filmCounts []int

	for rows.Next() {
		var directorName string
		var count int
		if err := rows.Scan(&directorName, &count); err != nil {
			log.Println("Row scanning error in FetchTopDirectors:", err)
			return ChartData{}, err
		}
		directorNames = append(directorNames, directorName)
		filmCounts = append(filmCounts, count)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchTopDirectors:", err)
		return ChartData{}, err
	}

	chartData := ChartData{
		Labels: directorNames,
		Datasets: []Dataset{
			{
				Label: "Top Directors by Film Count",
				Data:  filmCounts,
			},
		},
	}
	return chartData, nil
}

func FetchTopActors(limit int) (ChartData, error) {
	if db == nil {
		log.Println("FetchTopActors: Database connection is not initialized.")
		return ChartData{}, sql.ErrConnDone // Or a more specific error
	}

	// Query to get the top 5 Actors by film count
	query := fmt.Sprintf(`
		SELECT 
			g.actors_name, 
			COUNT(*) as movie_count 
		FROM 
			films,
			UNNEST(actors) AS g(actors_name) -- Unnest the array and alias the resulting column
		WHERE 
			g.actors_name IS NOT NULL AND g.actors_name <> '' -- Filter out NULL or empty genres
		GROUP BY 
			g.actors_name 
		ORDER BY 
			movie_count DESC
		LIMIT %d;
	`, limit)

	rows, err := db.Query(query)
	if err != nil {
		log.Println("Database query error in FetchTopActors:", err)
		return ChartData{}, err
	}
	defer rows.Close()

	var directorNames []string
	var filmCounts []int

	for rows.Next() {
		var directorName string
		var count int
		if err := rows.Scan(&directorName, &count); err != nil {
			log.Println("Row scanning error in FetchTopActors:", err)
			return ChartData{}, err
		}
		directorNames = append(directorNames, directorName)
		filmCounts = append(filmCounts, count)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchTopActors:", err)
		return ChartData{}, err
	}

	chartData := ChartData{
		Labels: directorNames,
		Datasets: []Dataset{
			{
				Label: "Top Actors by Film Count",
				Data:  filmCounts,
			},
		},
	}
	return chartData, nil
}

// FetchTotalMoviesWatched queries the total number of films.
func FetchTotalMoviesWatched() (StatCount, error) {
	if db == nil {
		log.Println("FetchTotalMoviesWatched: Database connection is not initialized.")
		return StatCount{}, sql.ErrConnDone
	}

	var count int64
	query := `
	SELECT COUNT(*) FROM films;
	`
	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		log.Println("Database query error in FetchTotalMoviesWatched:", err)
		return StatCount{}, err
	}
	return StatCount{Count: count}, nil
}

// FetchTotalMoviesRated queries the total number of films that have a rating.
func FetchTotalMoviesRated() (StatCount, error) {
	if db == nil {
		log.Println("FetchTotalMoviesRated: Database connection is not initialized.")
		return StatCount{}, sql.ErrConnDone
	}

	var count int64
	// Assuming 'rating' column exists and is NULL if not rated.
	query := `
	SELECT COUNT(*) FROM ratings_entries WHERE rating IS NOT NULL;
	`
	err := db.QueryRow(query).Scan(&count)
	if err != nil {
		log.Println("Database query error in FetchTotalMoviesRated:", err)
		return StatCount{}, err
	}
	return StatCount{Count: count}, nil
}

// FetchTotalHoursWatched queries the total runtime of all films and converts it to hours.
func FetchTotalHoursWatched() (HoursWatchedStat, error) {
	if db == nil {
		log.Println("FetchTotalHoursWatched: Database connection is not initialized.")
		return HoursWatchedStat{}, sql.ErrConnDone
	}

	var totalMinutes sql.NullInt64 // Use sql.NullInt64 to handle potential NULL sum
	// Assuming 'runtime' column stores duration in minutes.
	// COALESCE ensures 0 is returned if no films or all runtimes are NULL.
	query := `
	SELECT COALESCE(SUM(runtime), 0) FROM films WHERE runtime IS NOT NULL;
	`
	err := db.QueryRow(query).Scan(&totalMinutes)
	if err != nil {
		log.Println("Database query error in FetchTotalHoursWatched:", err)
		return HoursWatchedStat{}, err
	}

	hours := 0.0
	if totalMinutes.Valid {
		hours = float64(totalMinutes.Int64) / 60.0
	}

	return HoursWatchedStat{TotalHours: hours}, nil
}

// FetchRewatchStats queries the number of rewatched films vs new watches.
func FetchRewatchStats() (RewatchStatsData, error) {
	if db == nil {
		log.Println("FetchRewatchStats: Database connection is not initialized.")
		return RewatchStatsData{}, sql.ErrConnDone
	}

	var rewatches, newWatches int64
	// Assuming 'is_rewatch' is a BOOLEAN column.
	// Films with is_rewatch = FALSE or IS NULL are considered new watches.
	query := `
		SELECT
			COALESCE(SUM(CASE WHEN rewatch = TRUE THEN 1 ELSE 0 END), 0) as rewatches,
			COALESCE(SUM(CASE WHEN rewatch = FALSE OR rewatch IS NULL THEN 1 ELSE 0 END), 0) as new_watches
		FROM diary_entries;
	`
	err := db.QueryRow(query).Scan(&rewatches, &newWatches)
	if err != nil {
		log.Println("Database query error in FetchRewatchStats:", err)
		return RewatchStatsData{}, err
	}
	return RewatchStatsData{Rewatches: rewatches, NewWatches: newWatches}, nil
}

// FetchMostRewatchedMovies queries the database for movies with the highest rewatch counts.
func FetchMostRewatchedMovies(limit int) ([]RewatchedMovieData, error) {
	if db == nil {
		log.Println("FetchMostRewatchedMovies: Database connection is not initialized.")
		return nil, sql.ErrConnDone
	}

	query := fmt.Sprintf(`
		SELECT
			f.id AS film_id,
			f.title,
			f.poster_path,
			f.letterboxd_uri,
			COUNT(de.id) AS rewatch_count
		FROM
			films f
		JOIN
			diary_entries de ON f.id = de.film_id
		WHERE
			de.rewatch = TRUE
		GROUP BY
			f.id, f.title, f.poster_path
		ORDER BY
			rewatch_count DESC, f.title ASC
		LIMIT %d;
	`, limit)

	rows, err := db.Query(query)
	if err != nil {
		log.Printf("Database query error in FetchMostRewatchedMovies (limit %d): %v", limit, err)
		return nil, err
	}
	defer rows.Close()

	var movies []RewatchedMovieData
	for rows.Next() {
		var movie RewatchedMovieData
		// Ensure poster_path can be NULL in the DB and handle it
		var posterPath sql.NullString
		if err := rows.Scan(&movie.FilmID, &movie.Title, &posterPath, &movie.FilmLink, &movie.RewatchCount); err != nil {
			log.Println("Row scanning error in FetchMostRewatchedMovies:", err)
			return nil, err
		}
		if posterPath.Valid {
			movie.PosterPath = posterPath.String
		} else {
			movie.PosterPath = "" // Or a placeholder path
		}
		movies = append(movies, movie)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchMostRewatchedMovies:", err)
		return nil, err
	}

	return movies, nil
}

// FetchFilmCountsByWatchDate retrieves movie counts grouped by month and year,
// formatting labels for Chart.js to show the year only on the first month of that year displayed.
func FetchFilmCountsByWatchDate() (MoviesWatchedOverTimeChartData, error) {
	if db == nil {
		log.Println("FetchFilmCountsByWatchDate: Database connection is not initialized.")
		return MoviesWatchedOverTimeChartData{}, sql.ErrConnDone
	}

	// The SQL query needs to provide year and month name, ordered correctly.
	// EXTRACT(MONTH FROM watched_date) is crucial for correct chronological ordering.
	query := `
SELECT
    EXTRACT(YEAR FROM watched_date) AS watch_year,
    TRIM(TO_CHAR(watched_date, 'Month')) AS month_name, -- e.g., "January", "February"
    COUNT(*) AS movies_watched_count
FROM
    diary_entries
WHERE
    watched_date IS NOT NULL
GROUP BY
    watch_year,        -- Year
    month_name,        -- Textual month name
    EXTRACT(MONTH FROM watched_date) -- Numeric month for correct grouping and ordering
ORDER BY
    watch_year ASC,
    EXTRACT(MONTH FROM watched_date) ASC; -- Order chronologically by year, then by numeric month
`
	rows, err := db.Query(query)
	if err != nil {
		log.Println("Database query error in FetchFilmCountsByWatchDate:", err)
		return MoviesWatchedOverTimeChartData{}, err
	}
	defer rows.Close()

	var chartLabels []interface{} // Will hold strings or []string
	var movieCounts []int

	var previousYear int64 = 0 // Initialize to a value that won't match the first actual year

	for rows.Next() {
		var watchYear int64
		var monthNameFromDB string // e.g., "OCTOBER  " or "November" depending on DB and TO_CHAR
		var moviesWatchedCount int

		// Scan the three columns from the query result
		if err := rows.Scan(&watchYear, &monthNameFromDB, &moviesWatchedCount); err != nil {
			log.Println("Row scanning error in FetchFilmCountsByWatchDate:", err)
			return MoviesWatchedOverTimeChartData{}, err
		}

		// Process monthNameFromDB to ensure consistent Title Casing (e.g., "January")
		// TRIM in SQL should handle spaces. This handles casing.
		processedMonthName := strings.Title(strings.ToLower(monthNameFromDB))

		var currentLabel interface{}
		if watchYear != previousYear {
			// This is the first month of this 'watchYear' encountered in the dataset,
			// or it's the very first data point.
			currentLabel = []string{processedMonthName, strconv.FormatInt(watchYear, 10)}
			previousYear = watchYear // Update previousYear for the next iteration
		} else {
			// This is a subsequent month for the current 'previousYear'.
			currentLabel = processedMonthName
		}

		chartLabels = append(chartLabels, currentLabel)
		movieCounts = append(movieCounts, moviesWatchedCount)
	}

	if err := rows.Err(); err != nil {
		log.Println("Rows iteration error in FetchFilmCountsByWatchDate:", err)
		return MoviesWatchedOverTimeChartData{}, err
	}

	MoviesWatchedOverTimeChartData := MoviesWatchedOverTimeChartData{
		Labels: chartLabels,
		Datasets: []Dataset{
			{
				Label: "Movies Watched per Month",
				Data:  movieCounts,
			},
		},
	}
	return MoviesWatchedOverTimeChartData, nil
}
