# --- START OF FILE parsingInitialFilmData.py ---

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

try:
    import Levenshtein
except ImportError:
    print("Error: The 'python-Levenshtein' library is not installed.")
    print("Please install it by running: pip install python-Levenshtein")
    sys.exit(1)

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
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"
TMDB_PROFILE_SIZE = "w185" # Example profile image size

# Delay between TMDb API calls (in seconds) to respect rate limits
API_CALL_DELAY = 0.5 # Adjust as needed, be respectful of TMDb's rate limits

# Number of top actors to store
TOP_N_ACTORS = 5

# Threshold for title similarity (0.0 to 1.0). 
# A higher value means stricter matching.
TITLE_SIMILARITY_THRESHOLD = 0.8  # Example: 80% similarity required

# Maximum allowed year difference for a "close" year match
YEAR_DIFF_THRESHOLD_FOR_MATCHING = 2 


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
    including multiple directors and actor profile paths, and removing overview.
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
            directors TEXT[], 
            actors TEXT[],
            actor_profile_paths TEXT[], 
            poster_path TEXT,
            backdrop_path TEXT,
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
        print(f"Table '{safe_print_str(TABLE_NAME)}' checked/created successfully (schema includes: directors TEXT[], actor_profile_paths TEXT[]).")
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

def calculate_normalized_similarity(s1, s2):
    """
    Calculates normalized Levenshtein similarity between two strings.
    Returns a float between 0.0 (no similarity) and 1.0 (exact match).
    Comparison is case-insensitive.
    """
    if not isinstance(s1, str) or not isinstance(s2, str):
        return 0.0 # Or raise an error, but for this context, 0.0 is safer

    s1_lower = s1.lower()
    s2_lower = s2.lower()

    if not s1_lower and not s2_lower: # Both empty
        return 1.0
    if not s1_lower or not s2_lower: # One is empty
        return 0.0

    distance = Levenshtein.distance(s1_lower, s2_lower)
    max_len = max(len(s1_lower), len(s2_lower))
    
    if max_len == 0: # Should be caught by above checks, but as a safeguard
        return 1.0 if distance == 0 else 0.0 
        
    similarity = 1.0 - (distance / max_len)
    return similarity


def get_closest_year_match(tmdb_results, target_year, original_lb_title):
    """
    Finds the TMDb result that best matches the original_lb_title and target_year,
    using Levenshtein distance for title similarity and a configurable threshold.
    """
    if not tmdb_results or not original_lb_title:
        return None

    # 1. Calculate similarity for all results and filter by TITLE_SIMILARITY_THRESHOLD
    candidates_info = []
    for result in tmdb_results:
        tmdb_title = result.get('title')
        if not tmdb_title:
            continue
        
        similarity_score = calculate_normalized_similarity(original_lb_title, tmdb_title)
        
        if similarity_score >= TITLE_SIMILARITY_THRESHOLD:
            candidates_info.append({
                'result_obj': result, 
                'similarity': similarity_score,
                'popularity': result.get('popularity', 0.0) # Ensure popularity is float for sorting
            })

    if not candidates_info:
        # print(f"  DEBUG: No TMDb results for '{safe_print_str(original_lb_title)}' met similarity threshold {TITLE_SIMILARITY_THRESHOLD}.")
        return None

    # 2. Categorize candidates by year match quality
    exact_year_matches = []
    close_year_matches = []
    other_title_matches = [] # Matches that pass similarity but not year criteria, or if target_year is None

    for cand_info in candidates_info:
        result_obj = cand_info['result_obj']
        tmdb_year = None
        release_date_str = result_obj.get('release_date')

        if release_date_str and isinstance(release_date_str, str) and len(release_date_str) >= 4:
            try:
                tmdb_year_str = release_date_str.split('-')[0]
                if len(tmdb_year_str) == 4: # Basic validation for year format
                    tmdb_year = int(tmdb_year_str)
            except ValueError:
                # print(f"  DEBUG: Could not parse year from release_date '{release_date_str}' for TMDb title '{result_obj.get('title')}'.")
                tmdb_year = None 

        if target_year is not None and tmdb_year is not None:
            year_difference = abs(tmdb_year - target_year)
            if tmdb_year == target_year:
                exact_year_matches.append(cand_info)
            elif year_difference <= YEAR_DIFF_THRESHOLD_FOR_MATCHING:
                cand_info['year_diff'] = year_difference 
                close_year_matches.append(cand_info)
            else:
                other_title_matches.append(cand_info)
        else: # target_year is None, or tmdb_year could not be determined for this result
            other_title_matches.append(cand_info)

    # 3. Select best match based on prioritized categories
    if exact_year_matches:
        # Sort by similarity (desc), then popularity (desc)
        exact_year_matches.sort(key=lambda x: (x['similarity'], x['popularity']), reverse=True)
        # print(f"  DEBUG: Exact year match chosen for '{safe_print_str(original_lb_title)}': '{safe_print_str(exact_year_matches[0]['result_obj'].get('title'))}' (Sim: {exact_year_matches[0]['similarity']:.2f})")
        return exact_year_matches[0]['result_obj']
    
    if close_year_matches:
        # Sort by year_diff (asc), then similarity (desc), then popularity (desc)
        close_year_matches.sort(key=lambda x: (x['year_diff'], -x['similarity'], -x['popularity']))
        # print(f"  DEBUG: Close year match chosen for '{safe_print_str(original_lb_title)}': '{safe_print_str(close_year_matches[0]['result_obj'].get('title'))}' (Diff: {close_year_matches[0]['year_diff']}, Sim: {close_year_matches[0]['similarity']:.2f})")
        return close_year_matches[0]['result_obj']

    if other_title_matches:
        # Sort by similarity (desc), then popularity (desc)
        other_title_matches.sort(key=lambda x: (x['similarity'], x['popularity']), reverse=True)
        # print(f"  DEBUG: Other title match chosen for '{safe_print_str(original_lb_title)}': '{safe_print_str(other_title_matches[0]['result_obj'].get('title'))}' (Sim: {other_title_matches[0]['similarity']:.2f})")
        return other_title_matches[0]['result_obj']
        
    # print(f"  DEBUG: No suitable match found for '{safe_print_str(original_lb_title)}' after all selection logic.")
    return None


def enrich_films_with_tmdb_data(conn):
    """
    Fetches films from DB that need TMDb enrichment, searches TMDb,
    extracts details including multiple directors, top actors with profile paths,
    and updates the DB (overview removed).
    """
    # --- BEGIN SCHEMA VALIDATION ---
    # Columns specifically used in the WHERE clause for NULL checks during enrichment query
    columns_to_check_for_null_filter = ["tmdb_id", "poster_path", "actors", "directors", "actor_profile_paths"]
    expected_column_types = { # Used for providing helpful error messages
        "tmdb_id": "INTEGER",
        "poster_path": "TEXT",
        "actors": "TEXT[]",
        "directors": "TEXT[]",
        "actor_profile_paths": "TEXT[]"
    }
    column_check_cursor = None
    try:
        column_check_cursor = conn.cursor()
        for col_name in columns_to_check_for_null_filter:
            try:
                # Try a minimal query to check for column existence. LIMIT 0 means no data is fetched.
                column_check_cursor.execute(sql.SQL("SELECT {column} FROM {table} LIMIT 0").format(
                    column=sql.Identifier(col_name),
                    table=sql.Identifier(TABLE_NAME)
                ))
            except psycopg2.ProgrammingError as pe:
                # Check if the error is specifically about a missing column
                if "column" in str(pe).lower() and "does not exist" in str(pe).lower():
                    print(f"\n--- SCHEMA MISMATCH DETECTED ---")
                    print(f"Critical Error: The column '{safe_print_str(col_name)}' (expected type: {expected_column_types.get(col_name, 'UNKNOWN')}) "
                          f"does not exist in your '{safe_print_str(TABLE_NAME)}' table.")
                    print(f"The script expects this column for its enrichment process, as defined in its `create_table_if_not_exists` function.")
                    print(f"This usually occurs if the table was created by an older version of this script, "
                          f"manually with a different schema, or if an `ALTER TABLE` operation was incomplete.")
                    print(f"PostgreSQL Hint: {pe.diag.message_primary if hasattr(pe, 'diag') and pe.diag.message_primary else 'No hint available.'}")


                    print(f"\nTo resolve this, you need to align your database schema with the script's expectations:")
                    print(f"1. Inspect your current table schema. In psql, connect to your database '{safe_print_str(DB_NAME)}' and run: \\d {safe_print_str(TABLE_NAME)}")
                    print(f"2. Compare it with the schema defined in this script's `create_table_if_not_exists` function.")
                    print(f"3. You may need to:")
                    print(f"   a) Manually ALTER the table. Examples:")
                    print(f"      - If '{safe_print_str(col_name)}' is missing: `ALTER TABLE {safe_print_str(TABLE_NAME)} ADD COLUMN {safe_print_str(col_name)} {expected_column_types.get(col_name, 'APPROPRIATE_TYPE')};`")
                    print(f"      - If the column exists but has a different name (e.g., 'director' instead of 'directors'): "
                          f"`ALTER TABLE {safe_print_str(TABLE_NAME)} RENAME COLUMN old_column_name TO {safe_print_str(col_name)};`")
                    print(f"      - If the column exists but has the wrong type (e.g., TEXT instead of TEXT[] for 'directors'): "
                          f"`ALTER TABLE {safe_print_str(TABLE_NAME)} ALTER COLUMN {safe_print_str(col_name)} TYPE {expected_column_types.get(col_name, 'APPROPRIATE_TYPE')};` (may require a USING clause for complex conversions).")
                    print(f"   b) If this is a fresh setup or you are okay with losing ALL data in the '{safe_print_str(TABLE_NAME)}' table, "
                          f"you can DROP the table (`DROP TABLE {safe_print_str(TABLE_NAME)};`) and let this script recreate it on the next run.")
                    print(f"--- SCRIPT EXECUTION HALTED DUE TO SCHEMA MISMATCH ---")
                    conn.rollback() # Ensure no pending transaction from the failed check
                    return # Stop further processing in this function
                else:
                    raise # Re-raise other programming errors not related to missing columns
        # If all checks pass, optionally print a success message
        # print("Schema validation: All critical columns for enrichment query exist.")
    except psycopg2.Error as e: # Catch other database errors during validation
        print(f"A PostgreSQL error occurred during schema validation: {e}")
        conn.rollback()
        return
    except Exception as e: # Catch any other unexpected errors
        print(f"An unexpected error occurred during schema validation: {e}")
        conn.rollback() # Rollback if an error occurred
        return
    finally:
        if column_check_cursor and not column_check_cursor.closed:
            column_check_cursor.close()
    # --- END SCHEMA VALIDATION ---

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    select_query = sql.SQL("""
        SELECT id, letterboxd_uri, title, year 
        FROM {table} 
        WHERE (tmdb_id IS NULL OR poster_path IS NULL OR actors IS NULL OR directors IS NULL OR actor_profile_paths IS NULL) 
        AND title IS NOT NULL
        ORDER BY id; 
    """).format(table=sql.Identifier(TABLE_NAME))

    try:
        cursor.execute(select_query)
        films_to_enrich = cursor.fetchall()
        total_films_to_process = len(films_to_enrich) # Renamed for clarity
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
            selected_tmdb_movie_obj = None
            
            try:
                # First search attempt: Title + Year (if available)
                search_params_year = {'api_key': TMDB_API_KEY, 'query': original_film_title}
                if film['year']:
                    search_params_year['year'] = film['year']
                
                response_year_search = requests.get(f"{TMDB_API_URL}/search/movie", params=search_params_year)
                response_year_search.raise_for_status()
                search_results_with_year = response_year_search.json().get('results', [])
                time.sleep(API_CALL_DELAY)

                selected_tmdb_movie_obj = get_closest_year_match(search_results_with_year, film['year'], original_film_title)
                
                if selected_tmdb_movie_obj:
                    tmdb_movie_id = selected_tmdb_movie_obj.get('id')
                    print(f"  -> TMDb: Tentative match (year pref search): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                # Second search attempt: Title only (if first failed or film has no year for stricter first search)
                if not selected_tmdb_movie_obj: 
                    if film['year']: # Only print if we tried with year and it failed
                        print(f"  -> TMDb: No strong match with year. Trying title-only search for '{current_film_title_safe_for_print}'.")
                    
                    title_only_params = {'api_key': TMDB_API_KEY, 'query': original_film_title}
                    response_title_only_search = requests.get(f"{TMDB_API_URL}/search/movie", params=title_only_params)
                    response_title_only_search.raise_for_status()
                    search_results_title_only = response_title_only_search.json().get('results', [])
                    time.sleep(API_CALL_DELAY)
                    
                    selected_tmdb_movie_obj = get_closest_year_match(search_results_title_only, film['year'], original_film_title)
                    if selected_tmdb_movie_obj:
                        tmdb_movie_id = selected_tmdb_movie_obj.get('id')
                        print(f"  -> TMDb: Matched (title-only search, new logic): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                if not selected_tmdb_movie_obj: # Check after both attempts
                    print(f"  -> TMDb: Could not find a suitable match for '{current_film_title_safe_for_print}' based on similarity and year. Deleting row from database.")
                    delete_cursor = conn.cursor()
                    delete_query = sql.SQL("DELETE FROM {table} WHERE letterboxd_uri = %s;").format(table=sql.Identifier(TABLE_NAME))
                    delete_cursor.execute(delete_query, (film['letterboxd_uri'],))
                    conn.commit()
                    deleted_count += 1
                    print(f"  -> DB: Deleted row for '{current_film_title_safe_for_print}' (URI: {safe_print_str(film['letterboxd_uri'])}).")
                    if delete_cursor and not delete_cursor.closed: delete_cursor.close()
                    continue 

                # At this point, selected_tmdb_movie_obj is not None and tmdb_movie_id should be set
                tmdb_id_to_insert = selected_tmdb_movie_obj.get('id') # This is now guaranteed to be from a good match
                
                # Collision Check
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
                        continue
                
                # Fetch detailed movie info
                details_url = f"{TMDB_API_URL}/movie/{tmdb_movie_id}"
                details_params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits'}
                response = requests.get(details_url, params=details_params)
                response.raise_for_status()
                movie_details = response.json()
                time.sleep(API_CALL_DELAY)

                directors_list = []
                actors_list = []
                actor_profiles_list = []

                if 'credits' in movie_details:
                    if 'crew' in movie_details['credits']:
                        for crew_member in movie_details['credits']['crew']:
                            if crew_member.get('job') == 'Director':
                                if crew_member.get('name'):
                                    directors_list.append(crew_member.get('name'))
                    if 'cast' in movie_details['credits']:
                        for actor_data in movie_details['credits']['cast'][:TOP_N_ACTORS]: 
                            if actor_data.get('name'): 
                                actors_list.append(actor_data.get('name'))
                                if actor_data.get('profile_path'):
                                    actor_profiles_list.append(f"{TMDB_IMAGE_BASE_URL}{TMDB_PROFILE_SIZE}{actor_data.get('profile_path')}")
                                else:
                                    actor_profiles_list.append(None) # Or a placeholder URL
                            else: # If actor name is missing, but we need to keep arrays parallel
                                actor_profiles_list.append(None)


                poster_path = movie_details.get('poster_path')
                backdrop_path = movie_details.get('backdrop_path')
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

                update_cursor = conn.cursor()
                update_query = sql.SQL("""
                    UPDATE {table} SET
                        tmdb_id = %s, directors = %s, actors = %s, actor_profile_paths = %s,
                        poster_path = %s, backdrop_path = %s, runtime = %s,
                        genres = %s, release_date = %s, updated_at = NOW()
                    WHERE letterboxd_uri = %s;
                """).format(table=sql.Identifier(TABLE_NAME))
                
                update_cursor.execute(update_query, (
                    tmdb_movie_id, 
                    directors_list if directors_list else None, 
                    actors_list if actors_list else None, 
                    actor_profiles_list if actor_profiles_list else None,
                    poster_path,
                    backdrop_path, runtime, genres_list if genres_list else None,
                    release_date, film['letterboxd_uri']
                ))
                conn.commit()
                updated_count +=1
                print(f"  -> DB: Successfully updated '{current_film_title_safe_for_print}' with TMDb ID {tmdb_movie_id}, {len(directors_list)} Director(s), {len(actors_list)} Actors with profile paths.")
                if update_cursor and not update_cursor.closed: update_cursor.close()

            except requests.exceptions.HTTPError as e:
                error_message = f"No response text (status code: {e.response.status_code if e.response else 'Unknown'})"
                if e.response and hasattr(e.response, 'text') and e.response.text:
                    error_message = safe_print_str(e.response.text)
                print(f"  -> TMDb API HTTP Error for '{current_film_title_safe_for_print}': {e.response.status_code if e.response else 'Unknown status'} - {error_message}")
                if e.response and e.response.status_code == 404: 
                    print(f"  -> TMDb: Movie ID {tmdb_movie_id if tmdb_movie_id else '(unknown from search)'} not found (404) when fetching details.")
                time.sleep(API_CALL_DELAY) 
            except requests.exceptions.RequestException as e:
                print(f"  -> TMDb API Request Error for '{current_film_title_safe_for_print}': {e}")
                time.sleep(API_CALL_DELAY) 
            except psycopg2.Error as e: 
                print(f"  -> DB Update/Delete Error for '{current_film_title_safe_for_print}': {e}")
                if conn and not conn.closed: conn.rollback() 
            except Exception as e: 
                print(f"  -> Unexpected error processing '{current_film_title_safe_for_print}': {type(e).__name__} - {e}")
                import traceback
                traceback.print_exc() # For detailed debugging of unexpected errors


        print(f"\nFinished TMDb data enrichment process. Updated: {updated_count}, Deleted: {deleted_count}, Skipped (Collision): {skipped_due_to_collision}, Total Processed in this run: {total_films_to_process}.")


    except psycopg2.Error as e: # This will catch the original error if schema validation wasn't present or if it's a different DB error
        print(f"Database error during film selection or processing: {e}")
        if hasattr(e, 'diag') and e.diag.message_primary:
             print(f"PostgreSQL Primary Error: {e.diag.message_primary}")
        if conn and not conn.closed: conn.rollback() 
    finally:
        if cursor and not cursor.closed : cursor.close()


# --- Main Execution ---
if __name__ == "__main__":
    db_connection = None

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
            print("Attempted to reconfigure stdout/stderr to UTF-8.")
        except Exception as e_reconfigure:
            print(f"Note: Could not reconfigure stdout/stderr to UTF-8: {e_reconfigure}")
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