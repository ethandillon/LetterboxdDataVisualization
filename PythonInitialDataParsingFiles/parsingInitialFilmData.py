import csv
import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor # To fetch rows as dictionaries
import os
import sys # Added for stdout encoding detection
import time # For rate limiting
import requests # For TMDb API calls
from dotenv import load_dotenv
from datetime import datetime # For parsing release dates to get year
import locale # Added for locale-specific encoding detection

load_dotenv()
# --- Configuration ---
# Load environment variables from .env file
# Database connection details from .env file
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")


# Path to Letterboxd CSV file from .env file
CSV_FILE_PATH = "LetterBoxdData/watched.csv"

# TMDb API Key from .env file
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# Define the table name in your PostgreSQL database
TABLE_NAME = "films"

# TMDb API base URL
TMDB_API_URL = "https://api.themoviedb.org/3"

# Delay between TMDb API calls (in seconds) to respect rate limits
API_CALL_DELAY = 0.5 # Adjust as needed, be respectful of TMDb's rate limits

# Number of top actors to store
TOP_N_ACTORS = 5

# --- Helper Functions ---

def safe_print_str(s, default_encoding='utf-8'):
    """
    Safely prepares a string for printing to the console by handling potential encoding issues.
    It attempts to encode to UTF-8 and then decode to the console's effective encoding,
    replacing any characters that cannot be represented.
    """
    if not isinstance(s, str):
        s = str(s) # Ensure it's a string
    
    effective_encoding = sys.stdout.encoding
    
    if not effective_encoding: # If None (e.g., redirected output, some IDEs)
        try:
            # locale.getencoding() is often more reliable than getpreferredencoding on some systems
            effective_encoding = locale.getencoding() 
        except Exception:
            pass 
    
    if not effective_encoding: # If still None after locale check
        effective_encoding = default_encoding

    try:
        # Encode to UTF-8 (a universal format) first, then decode to the effective_encoding.
        # This handles cases where 's' might contain characters not directly mappable
        # by effective_encoding but can be represented by UTF-8 and then 'replaced' during decode.
        return s.encode('utf-8', errors='replace').decode(effective_encoding, errors='replace')
    except Exception:
        # Ultimate fallback: encode to ASCII with replace, then decode.
        # This will lose more data (non-ASCII chars become '?') but is very safe for printing.
        return s.encode('ascii', errors='replace').decode('ascii', errors='replace')


def connect_db():
    """Establishes a connection to the PostgreSQL database."""
    if not DB_PASSWORD:
        print("Error: DB_PASSWORD not found in environment variables.")
        exit()
    if not TMDB_API_KEY:
        print("Error: TMDB_API_KEY not found in environment variables. Please add it to your .env file.")
        exit()
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        print(f"Successfully connected to PostgreSQL database '{safe_print_str(DB_NAME)}' as user '{safe_print_str(DB_USER)}'.")
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL: {e}")
        exit()

def create_table_if_not_exists(conn):
    """
    Creates the table in the database with the TMDb-focused schema,
    including an 'actors' column and a trigger for 'updated_at'.
    """
    cursor = conn.cursor()
    trigger_name_str = f"update_{TABLE_NAME}_modtime"

    create_table_query = sql.SQL("""
        CREATE TABLE IF NOT EXISTS {table} (
            id SERIAL PRIMARY KEY,
            letterboxd_uri TEXT UNIQUE NOT NULL,
            tmdb_id INTEGER UNIQUE,
            title TEXT,
            year INTEGER,
            director TEXT,
            actors TEXT[], 
            poster_path TEXT,
            backdrop_path TEXT,
            overview TEXT,
            runtime INTEGER,
            genres TEXT[],
            release_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """).format(table=sql.Identifier(TABLE_NAME))

    create_trigger_function_query = sql.SQL("""
        CREATE OR REPLACE FUNCTION update_modified_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE 'plpgsql';
    """)

    create_trigger_query = sql.SQL("""
        DROP TRIGGER IF EXISTS {trigger_name} ON {table_name};
        CREATE TRIGGER {trigger_name}
        BEFORE UPDATE ON {table_name}
        FOR EACH ROW
        EXECUTE PROCEDURE update_modified_column();
    """).format(
        trigger_name=sql.Identifier(trigger_name_str),
        table_name=sql.Identifier(TABLE_NAME)
    )

    try:
        cursor.execute(create_table_query)
        print(f"Table '{safe_print_str(TABLE_NAME)}' checked/created successfully (actors column included).")
        cursor.execute(create_trigger_function_query)
        print("Function 'update_modified_column' checked/created successfully.")
        cursor.execute(create_trigger_query)
        print(f"Trigger '{safe_print_str(trigger_name_str)}' on table '{safe_print_str(TABLE_NAME)}' checked/created successfully.")
        conn.commit()
    except psycopg2.Error as e:
        print(f"Error during table or trigger creation: {e}")
        conn.rollback()
        exit()
    finally:
        if cursor and not cursor.closed: cursor.close()


def process_csv_and_insert_data(conn, csv_file_path):
    """
    Reads data from the CSV file and inserts basic film info (letterboxd_uri, title, year).
    """
    cursor = conn.cursor()
    inserted_count = 0
    skipped_count = 0

    if not csv_file_path or csv_file_path == "path/to/your/letterboxd_data.csv":
        print(f"Error: CSV_FILE_PATH is not properly configured: '{safe_print_str(csv_file_path)}'")
        return

    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as csvfile:
            reader = csv.DictReader(csvfile)
            csv_title_col = 'Name'
            csv_year_col = 'Year'
            csv_uri_col = 'Letterboxd URI'

            required_csv_cols = [csv_title_col, csv_year_col, csv_uri_col]
            if not reader.fieldnames:
                print(f"Error: No headers in CSV: {safe_print_str(csv_file_path)}.")
                return
            for col in required_csv_cols:
                if col not in reader.fieldnames:
                    print(f"Error: Required CSV column '{safe_print_str(col)}' not found in headers: {reader.fieldnames}")
                    return

            for row_num, row in enumerate(reader, 1):
                try:
                    letterboxd_uri = row.get(csv_uri_col)
                    title_from_csv = row.get(csv_title_col)
                    title = str(title_from_csv) if title_from_csv is not None else None
                    year_str = row.get(csv_year_col)

                    if not letterboxd_uri:
                        print(f"Skipping row {row_num} due to missing Letterboxd URI.")
                        skipped_count += 1
                        continue
                    
                    year = None
                    if year_str:
                        try:
                            year = int(year_str)
                        except ValueError:
                            print(f"Warning: Row {row_num}: Could not parse year '{safe_print_str(year_str)}' for '{safe_print_str(title)}'. Skipping year.")
                    
                    insert_query = sql.SQL("""
                        INSERT INTO {table} (letterboxd_uri, title, year)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (letterboxd_uri) DO UPDATE SET
                            title = EXCLUDED.title,
                            year = EXCLUDED.year,
                            updated_at = NOW(); 
                    """).format(table=sql.Identifier(TABLE_NAME))
                    cursor.execute(insert_query, (letterboxd_uri, title, year))
                    inserted_count += 1
                except psycopg2.Error as e:
                    print(f"DB Error inserting row {row_num} for URI '{safe_print_str(letterboxd_uri)}': {e}")
                    conn.rollback()
                    skipped_count += 1
                except Exception as e:
                    print(f"Unexpected error with row {row_num} for URI '{safe_print_str(letterboxd_uri)}': {e}")
                    skipped_count += 1
            conn.commit()
            print(f"CSV Data processing complete. Inserted/Updated: {inserted_count}, Skipped: {skipped_count}")
    except FileNotFoundError:
        print(f"Error: CSV file not found at '{safe_print_str(csv_file_path)}'.")
    except Exception as e:
        print(f"An error occurred during CSV processing: {e}")
        if conn and not conn.closed: conn.rollback()
    finally:
        if cursor and not cursor.closed: cursor.close()


def get_closest_year_match(tmdb_results, target_year, original_lb_title):
    """
    Finds the TMDb result that best matches the target_year and original_lb_title.
    Prioritizes exact year matches, then close year matches, using popularity as a tie-breaker.
    """
    if not tmdb_results:
        return None

    best_overall_match = None

    # Phase 1: Look for exact year matches
    if target_year is not None:
        exact_year_matches = []
        for result in tmdb_results:
            release_date_str = result.get('release_date')
            if release_date_str and len(release_date_str) >= 4:
                try:
                    tmdb_year_str = release_date_str.split('-')[0]
                    if len(tmdb_year_str) == 4:
                        tmdb_year = int(tmdb_year_str)
                        if tmdb_year == target_year:
                            exact_year_matches.append(result)
                except ValueError:
                    continue # Skip if year parsing fails for this result
        
        if exact_year_matches:
            # If multiple exact year matches, pick the most popular.
            # A more advanced version could use title similarity here.
            best_overall_match = max(exact_year_matches, key=lambda x: x.get('popularity', 0), default=None)
            # Simple title check: if the LB title isn't a substring of TMDb title (and vice-versa), it might be a poor match.
            # This is a basic heuristic. For "Wonder" vs "Wonder Woman", this might still pick "Wonder Woman".
            # A more robust solution would involve string similarity scores (e.g., Levenshtein distance).
            if best_overall_match and original_lb_title:
                tmdb_title_lower = best_overall_match.get('title','').lower()
                lb_title_lower = original_lb_title.lower()
                if not (lb_title_lower in tmdb_title_lower or tmdb_title_lower in lb_title_lower):
                    # If titles seem too different, perhaps reconsider this match.
                    # For now, we'll still return it if it's the best exact year match by popularity.
                    # print(f"  -> Note: Exact year match '{safe_print_str(best_overall_match.get('title'))}' title differs from '{safe_print_str(original_lb_title)}'.")
                    pass
            if best_overall_match:
                return best_overall_match # Return the best exact year match

    # Phase 2: If no exact year match, or target_year was None, look for closest year matches
    # This phase is broader.
    closest_year_candidates = []
    min_abs_year_diff = float('inf')
    year_diff_threshold = 2 # Only consider films within +/- 2 years if target_year is known

    for result in tmdb_results:
        release_date_str = result.get('release_date')
        if release_date_str and len(release_date_str) >= 4:
            try:
                tmdb_year_str = release_date_str.split('-')[0]
                if len(tmdb_year_str) == 4:
                    tmdb_year = int(tmdb_year_str)
                    current_abs_year_diff = abs(tmdb_year - target_year) if target_year is not None else 0 # Treat as 0 diff if no target year

                    if target_year is None or current_abs_year_diff <= year_diff_threshold:
                        if current_abs_year_diff < min_abs_year_diff:
                            min_abs_year_diff = current_abs_year_diff
                            closest_year_candidates = [result]
                        elif current_abs_year_diff == min_abs_year_diff:
                            closest_year_candidates.append(result)
            except ValueError:
                continue
    
    if closest_year_candidates:
        best_overall_match = max(closest_year_candidates, key=lambda x: x.get('popularity', 0), default=None)
        if best_overall_match:
            return best_overall_match

    # Phase 3: Absolute fallback if no suitable matches found by year logic
    if not best_overall_match and tmdb_results:
        return tmdb_results[0] # Return the first result (often most popular overall by TMDb)

    return None # No match found


def enrich_films_with_tmdb_data(conn):
    """
    Fetches films from DB that need TMDb enrichment, searches TMDb with improved logic,
    extracts details including top actors, updates the DB, or deletes if no match.
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    select_query = sql.SQL("""
        SELECT id, letterboxd_uri, title, year 
        FROM {table} 
        WHERE (tmdb_id IS NULL OR poster_path IS NULL OR actors IS NULL) AND title IS NOT NULL
        ORDER BY id; 
    """).format(table=sql.Identifier(TABLE_NAME))

    try:
        cursor.execute(select_query)
        films_to_enrich = cursor.fetchall()
        total_films_to_process = len(films_to_enrich)
        print(f"Found {total_films_to_process} films to enrich/update with TMDb data.")

        if not films_to_enrich:
            print("No films found requiring TMDb data enrichment.")
            return
        
        updated_count = 0 
        deleted_count = 0
        skipped_due_to_collision = 0

        for idx, film in enumerate(films_to_enrich):
            original_film_title = film['title'] 
            current_film_title_safe_for_print = safe_print_str(original_film_title)
            
            print(f"\nProcessing ({idx + 1}/{total_films_to_process}): '{current_film_title_safe_for_print}' (Letterboxd Year: {film['year']}) - URI: {safe_print_str(film['letterboxd_uri'])}")
            tmdb_movie_id = None
            selected_tmdb_movie_obj = None # Store the full chosen TMDb movie object
            
            try:
                # Initial search: prefer with year if available
                search_params = {'api_key': TMDB_API_KEY, 'query': original_film_title} 
                if film['year']:
                    search_params['year'] = film['year']
                
                response = requests.get(f"{TMDB_API_URL}/search/movie", params=search_params)
                response.raise_for_status()
                search_results_with_year = response.json().get('results', [])
                time.sleep(API_CALL_DELAY)

                current_best_match = get_closest_year_match(search_results_with_year, film['year'], original_film_title)
                if current_best_match:
                    selected_tmdb_movie_obj = current_best_match
                    tmdb_movie_id = selected_tmdb_movie_obj['id']
                    print(f"  -> TMDb: Tentative match (year pref search): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                # If no match with year, or to refine, try title-only search
                if not tmdb_movie_id and film['year']: # Only do title-only if year search failed or was inconclusive
                    print(f"  -> TMDb: No strong match with year. Trying title-only search for '{current_film_title_safe_for_print}'.")
                    title_only_params = {'api_key': TMDB_API_KEY, 'query': original_film_title}
                    response = requests.get(f"{TMDB_API_URL}/search/movie", params=title_only_params)
                    response.raise_for_status()
                    search_results_title_only = response.json().get('results', [])
                    time.sleep(API_CALL_DELAY)
                    
                    current_best_match_title_only = get_closest_year_match(search_results_title_only, film['year'], original_film_title)
                    if current_best_match_title_only:
                        # Prefer this match if it's better or if previous was None
                        selected_tmdb_movie_obj = current_best_match_title_only
                        tmdb_movie_id = selected_tmdb_movie_obj['id']
                        print(f"  -> TMDb: Matched (title-only search, closest year logic): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                if not tmdb_movie_id:
                    print(f"  -> TMDb: Could not find a suitable match for '{current_film_title_safe_for_print}'. Deleting row from database.")
                    delete_cursor = conn.cursor()
                    delete_query = sql.SQL("DELETE FROM {table} WHERE letterboxd_uri = %s;").format(table=sql.Identifier(TABLE_NAME))
                    delete_cursor.execute(delete_query, (film['letterboxd_uri'],))
                    conn.commit()
                    deleted_count += 1
                    print(f"  -> DB: Deleted row for '{current_film_title_safe_for_print}' (URI: {safe_print_str(film['letterboxd_uri'])}).")
                    if delete_cursor and not delete_cursor.closed: delete_cursor.close()
                    continue 

                # Check for TMDb ID collision BEFORE attempting to update
                tmdb_id_to_insert = selected_tmdb_movie_obj.get('id') # This is the ID we intend to use
                if tmdb_id_to_insert:
                    collision_check_cursor = conn.cursor(cursor_factory=RealDictCursor)
                    collision_query = sql.SQL("SELECT letterboxd_uri FROM {table} WHERE tmdb_id = %s").format(table=sql.Identifier(TABLE_NAME))
                    collision_check_cursor.execute(collision_query, (tmdb_id_to_insert,))
                    existing_film_with_tmdb_id = collision_check_cursor.fetchone()
                    if collision_check_cursor and not collision_check_cursor.closed: collision_check_cursor.close()

                    if existing_film_with_tmdb_id and existing_film_with_tmdb_id['letterboxd_uri'] != film['letterboxd_uri']:
                        print(f"  -> COLLISION: TMDb ID {tmdb_id_to_insert} for '{current_film_title_safe_for_print}' (URI: {safe_print_str(film['letterboxd_uri'])}) "
                              f"is already assigned to a different film (URI: {safe_print_str(existing_film_with_tmdb_id['letterboxd_uri'])}). "
                              f"Skipping update for '{current_film_title_safe_for_print}' to avoid conflict.")
                        skipped_due_to_collision += 1
                        continue # Move to the next film

                # Fetch details for the confirmed tmdb_movie_id
                details_url = f"{TMDB_API_URL}/movie/{tmdb_movie_id}" # tmdb_movie_id is from selected_tmdb_movie_obj
                details_params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits'}
                response = requests.get(details_url, params=details_params)
                response.raise_for_status()
                movie_details = response.json()
                time.sleep(API_CALL_DELAY)

                # Extract data (director, actors, etc.) from movie_details
                director_name = None
                actors_list = []
                if 'credits' in movie_details:
                    if 'crew' in movie_details['credits']:
                        for crew_member in movie_details['credits']['crew']:
                            if crew_member.get('job') == 'Director':
                                director_name = crew_member.get('name')
                                break 
                    if 'cast' in movie_details['credits']:
                        for actor_data in movie_details['credits']['cast'][:TOP_N_ACTORS]: 
                            if actor_data.get('name'): 
                                actors_list.append(actor_data.get('name'))
                
                poster_path = movie_details.get('poster_path')
                backdrop_path = movie_details.get('backdrop_path')
                overview = movie_details.get('overview')
                runtime = movie_details.get('runtime')
                genres_list = [genre['name'] for genre in movie_details.get('genres', []) if genre.get('name')]
                release_date_str = movie_details.get('release_date')
                release_date = None
                if release_date_str:
                    try:
                        datetime.strptime(release_date_str, '%Y-%m-%d') 
                        release_date = release_date_str
                    except ValueError:
                        print(f"  -> TMDb: Invalid release date format '{safe_print_str(release_date_str)}'. Skipping date.")

                # Update the database
                update_cursor = conn.cursor()
                update_query = sql.SQL("""
                    UPDATE {table} SET
                        tmdb_id = %s, director = %s, actors = %s, poster_path = %s,
                        backdrop_path = %s, overview = %s, runtime = %s,
                        genres = %s, release_date = %s, updated_at = NOW()
                    WHERE letterboxd_uri = %s;
                """).format(table=sql.Identifier(TABLE_NAME))
                
                update_cursor.execute(update_query, (
                    tmdb_movie_id, director_name, actors_list if actors_list else None, poster_path, # Use tmdb_movie_id
                    backdrop_path, overview, runtime, genres_list if genres_list else None,
                    release_date, film['letterboxd_uri']
                ))
                conn.commit()
                updated_count +=1
                print(f"  -> DB: Successfully updated '{current_film_title_safe_for_print}' with TMDb ID {tmdb_movie_id}, Director, {len(actors_list)} Actors.")
                if update_cursor and not update_cursor.closed: update_cursor.close()

            except requests.exceptions.HTTPError as e:
                print(f"  -> TMDb API HTTP Error for '{current_film_title_safe_for_print}': {e.status_code} - {safe_print_str(e.response.text if e.response and hasattr(e.response, 'text') else 'No response text')}")
                if e.response and e.response.status_code == 404: # Not found on TMDb
                    print(f"  -> TMDb: Movie ID {tmdb_movie_id if tmdb_movie_id else '(unknown)'} not found (404).")
                time.sleep(API_CALL_DELAY) 
            except requests.exceptions.RequestException as e:
                print(f"  -> TMDb API Request Error for '{current_film_title_safe_for_print}': {e}")
                time.sleep(API_CALL_DELAY) 
            except psycopg2.Error as e: # Catch database errors specifically
                print(f"  -> DB Update/Delete Error for '{current_film_title_safe_for_print}': {e}")
                if conn and not conn.closed: conn.rollback() # Rollback on DB error
            except Exception as e: # Catch any other unexpected errors
                print(f"  -> Unexpected error processing '{current_film_title_safe_for_print}': {type(e).__name__} - {e}")


        print(f"\nFinished TMDb data enrichment process. Updated: {updated_count}, Deleted: {deleted_count}, Skipped (Collision): {skipped_due_to_collision}, Total Processed in this run: {total_films_to_process}.")

    except psycopg2.Error as e:
        print(f"Database error during film selection: {e}")
        if conn and not conn.closed: conn.rollback() 
    finally:
        if cursor and not cursor.closed : cursor.close()


# --- Main Execution ---
if __name__ == "__main__":
    db_connection = None
    # Attempt to set console to UTF-8 on Windows.
    # This is best-effort; PYTHONIOENCODING=utf-8 environment variable is more reliable.
    if sys.platform == "win32":
        try:
            # os.system("chcp 65001 > nul") # This can be disruptive if it prints to stdout
            # A more direct way to try and influence Python's own I/O encoding
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
            print("Attempted to reconfigure stdout/stderr to UTF-8.")
        except Exception as e_reconfigure:
            print(f"Note: Could not reconfigure stdout/stderr to UTF-8: {e_reconfigure}")
            # Fallback: try chcp if reconfigure fails or isn't enough
            try:
                os.system("chcp 65001 > nul")
                print("Attempted to set console to UTF-8 via chcp 65001 (fallback).")
            except Exception as e_chcp:
                print(f"Note: Could not set console to UTF-8 via chcp: {e_chcp}")


    try:
        db_connection = connect_db()
        if db_connection:
            print("\n--- Ensuring Table Schema ---")
            create_table_if_not_exists(db_connection)
            print("--- Table Schema Checked ---\n")

            print("\n--- Starting CSV Processing (Optional) ---")
            # process_csv_and_insert_data(db_connection, CSV_FILE_PATH) # Uncomment if needed
            print("--- Finished CSV Processing (or skipped) ---\n")

            print("--- Starting TMDb Enrichment ---")
            enrich_films_with_tmdb_data(db_connection)
            print("--- Finished TMDb Enrichment ---")

    finally:
        if db_connection and not db_connection.closed:
            db_connection.close()
            print("\nPostgreSQL connection closed.")
