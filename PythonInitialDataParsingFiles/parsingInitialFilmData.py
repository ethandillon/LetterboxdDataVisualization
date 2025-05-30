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
TMDB_PROFILE_SIZE = "w185" # Example profile image size for actors and directors

# Delay between TMDb API calls (in seconds) to respect rate limits
# Consider increasing this if you have many directors per film.
API_CALL_DELAY = 0.6 # Adjusted slightly for more calls

# Number of top actors to store
TOP_N_ACTORS = 5

# Threshold for title similarity (0.0 to 1.0). 
# A higher value means stricter matching.
TITLE_SIMILARITY_THRESHOLD = 0.8

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
            effective_encoding = locale.getencoding() 
        except Exception:
            pass 
    
    if not effective_encoding: # If still None after locale check
        effective_encoding = default_encoding

    try:
        return s.encode('utf-8', errors='replace').decode(effective_encoding, errors='replace')
    except Exception:
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
    including multiple directors with profile paths and actor profile paths.
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
            directors_profile_paths TEXT[], -- New column for director profile images
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
        print(f"Table '{safe_print_str(TABLE_NAME)}' checked/created successfully (schema includes: directors_profile_paths TEXT[]).")
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
    if not isinstance(s1, str) or not isinstance(s2, str): return 0.0
    s1_lower, s2_lower = s1.lower(), s2.lower()
    if not s1_lower and not s2_lower: return 1.0
    if not s1_lower or not s2_lower: return 0.0
    distance = Levenshtein.distance(s1_lower, s2_lower)
    max_len = max(len(s1_lower), len(s2_lower))
    if max_len == 0: return 1.0 if distance == 0 else 0.0
    return 1.0 - (distance / max_len)

def get_closest_year_match(tmdb_results, target_year, original_lb_title):
    if not tmdb_results or not original_lb_title: return None
    candidates_info = []
    for result in tmdb_results:
        tmdb_title = result.get('title')
        if not tmdb_title: continue
        similarity_score = calculate_normalized_similarity(original_lb_title, tmdb_title)
        if similarity_score >= TITLE_SIMILARITY_THRESHOLD:
            candidates_info.append({'result_obj': result, 'similarity': similarity_score, 'popularity': result.get('popularity', 0.0)})
    if not candidates_info: return None
    exact_year_matches, close_year_matches, other_title_matches = [], [], []
    for cand_info in candidates_info:
        result_obj, tmdb_year = cand_info['result_obj'], None
        release_date_str = result_obj.get('release_date')
        if release_date_str and isinstance(release_date_str, str) and len(release_date_str) >= 4:
            try:
                tmdb_year_str = release_date_str.split('-')[0]
                if len(tmdb_year_str) == 4: tmdb_year = int(tmdb_year_str)
            except ValueError: tmdb_year = None
        if target_year is not None and tmdb_year is not None:
            year_difference = abs(tmdb_year - target_year)
            if tmdb_year == target_year: exact_year_matches.append(cand_info)
            elif year_difference <= YEAR_DIFF_THRESHOLD_FOR_MATCHING:
                cand_info['year_diff'] = year_difference; close_year_matches.append(cand_info)
            else: other_title_matches.append(cand_info)
        else: other_title_matches.append(cand_info)
    if exact_year_matches:
        exact_year_matches.sort(key=lambda x: (x['similarity'], x['popularity']), reverse=True)
        return exact_year_matches[0]['result_obj']
    if close_year_matches:
        close_year_matches.sort(key=lambda x: (x['year_diff'], -x['similarity'], -x['popularity']))
        return close_year_matches[0]['result_obj']
    if other_title_matches:
        other_title_matches.sort(key=lambda x: (x['similarity'], x['popularity']), reverse=True)
        return other_title_matches[0]['result_obj']
    return None


def enrich_films_with_tmdb_data(conn):
    """
    Fetches films from DB that need TMDb enrichment, searches TMDb,
    extracts details including multiple directors with profile paths, top actors with profile paths,
    and updates the DB.
    """
    # --- BEGIN SCHEMA VALIDATION ---
    columns_to_check_for_null_filter = [
        "tmdb_id", "poster_path", "actors", "directors", 
        "actor_profile_paths", "directors_profile_paths" # Added directors_profile_paths
    ]
    expected_column_types = {
        "tmdb_id": "INTEGER", "poster_path": "TEXT", "actors": "TEXT[]", "directors": "TEXT[]",
        "actor_profile_paths": "TEXT[]", "directors_profile_paths": "TEXT[]" # Added directors_profile_paths
    }
    column_check_cursor = None
    try:
        column_check_cursor = conn.cursor()
        for col_name in columns_to_check_for_null_filter:
            try:
                column_check_cursor.execute(sql.SQL("SELECT {column} FROM {table} LIMIT 0").format(
                    column=sql.Identifier(col_name), table=sql.Identifier(TABLE_NAME)))
            except psycopg2.ProgrammingError as pe:
                if "column" in str(pe).lower() and "does not exist" in str(pe).lower():
                    print(f"\n--- SCHEMA MISMATCH DETECTED ---")
                    print(f"Critical Error: Column '{safe_print_str(col_name)}' (expected type: {expected_column_types.get(col_name, 'UNKNOWN')}) "
                          f"does not exist in '{safe_print_str(TABLE_NAME)}'.")
                    print(f"PostgreSQL Hint: {pe.diag.message_primary if hasattr(pe, 'diag') and pe.diag.message_primary else 'No hint.'}")
                    print(f"Please ensure your DB schema matches the script's `create_table_if_not_exists` definition.")
                    print(f"You may need to: `ALTER TABLE {safe_print_str(TABLE_NAME)} ADD COLUMN {safe_print_str(col_name)} {expected_column_types.get(col_name, 'APPROPRIATE_TYPE')};`")
                    print(f"--- SCRIPT EXECUTION HALTED ---")
                    conn.rollback(); return
                else: raise
    except psycopg2.Error as e: print(f"PostgreSQL error during schema validation: {e}"); conn.rollback(); return
    except Exception as e: print(f"Unexpected error during schema validation: {e}"); conn.rollback(); return
    finally:
        if column_check_cursor and not column_check_cursor.closed: column_check_cursor.close()
    # --- END SCHEMA VALIDATION ---

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    select_query = sql.SQL("""
        SELECT id, letterboxd_uri, title, year 
        FROM {table} 
        WHERE (
            tmdb_id IS NULL OR poster_path IS NULL OR 
            actors IS NULL OR directors IS NULL OR 
            actor_profile_paths IS NULL OR directors_profile_paths IS NULL 
        ) AND title IS NOT NULL
        ORDER BY id; 
    """).format(table=sql.Identifier(TABLE_NAME))

    try:
        cursor.execute(select_query)
        films_to_enrich = cursor.fetchall()
        total_films_to_process = len(films_to_enrich)
        print(f"Found {total_films_to_process} films to enrich/update with TMDb data (including director profiles).")

        if not films_to_enrich:
            print("No films found requiring TMDb data enrichment.")
            return
        
        updated_count, deleted_count, skipped_due_to_collision = 0, 0, 0

        for idx, film in enumerate(films_to_enrich):
            original_film_title = film['title'] 
            current_film_title_safe_for_print = safe_print_str(original_film_title)
            
            print(f"\nProcessing ({idx + 1}/{total_films_to_process}): '{current_film_title_safe_for_print}' (LB Year: {film['year']}) - URI: {safe_print_str(film['letterboxd_uri'])}")
            tmdb_movie_id, selected_tmdb_movie_obj = None, None
            
            try:
                search_params_year = {'api_key': TMDB_API_KEY, 'query': original_film_title}
                if film['year']: search_params_year['year'] = film['year']
                
                response_year_search = requests.get(f"{TMDB_API_URL}/search/movie", params=search_params_year)
                response_year_search.raise_for_status()
                search_results_with_year = response_year_search.json().get('results', [])
                time.sleep(API_CALL_DELAY)
                selected_tmdb_movie_obj = get_closest_year_match(search_results_with_year, film['year'], original_film_title)
                
                if selected_tmdb_movie_obj:
                    tmdb_movie_id = selected_tmdb_movie_obj.get('id')
                    print(f"  -> TMDb: Tentative match (year pref): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                if not selected_tmdb_movie_obj: 
                    if film['year']: print(f"  -> TMDb: No strong match with year. Trying title-only for '{current_film_title_safe_for_print}'.")
                    title_only_params = {'api_key': TMDB_API_KEY, 'query': original_film_title}
                    response_title_only_search = requests.get(f"{TMDB_API_URL}/search/movie", params=title_only_params)
                    response_title_only_search.raise_for_status()
                    search_results_title_only = response_title_only_search.json().get('results', [])
                    time.sleep(API_CALL_DELAY)
                    selected_tmdb_movie_obj = get_closest_year_match(search_results_title_only, film['year'], original_film_title)
                    if selected_tmdb_movie_obj:
                        tmdb_movie_id = selected_tmdb_movie_obj.get('id')
                        print(f"  -> TMDb: Matched (title-only, new logic): '{safe_print_str(selected_tmdb_movie_obj.get('title'))}' ({selected_tmdb_movie_obj.get('release_date')}), ID: {tmdb_movie_id}")
                
                if not selected_tmdb_movie_obj:
                    print(f"  -> TMDb: No suitable match for '{current_film_title_safe_for_print}'. Deleting from DB.")
                    delete_cursor = conn.cursor(); delete_query = sql.SQL("DELETE FROM {table} WHERE letterboxd_uri = %s;").format(table=sql.Identifier(TABLE_NAME))
                    delete_cursor.execute(delete_query, (film['letterboxd_uri'],)); conn.commit(); deleted_count += 1
                    print(f"  -> DB: Deleted '{current_film_title_safe_for_print}' (URI: {safe_print_str(film['letterboxd_uri'])}).")
                    if delete_cursor and not delete_cursor.closed: delete_cursor.close()
                    continue 

                tmdb_id_to_insert = selected_tmdb_movie_obj.get('id')
                
                if tmdb_id_to_insert: # Collision Check
                    collision_check_cursor = conn.cursor(cursor_factory=RealDictCursor)
                    collision_query = sql.SQL("SELECT letterboxd_uri FROM {table} WHERE tmdb_id = %s").format(table=sql.Identifier(TABLE_NAME))
                    collision_check_cursor.execute(collision_query, (tmdb_id_to_insert,))
                    existing_film = collision_check_cursor.fetchone()
                    if collision_check_cursor and not collision_check_cursor.closed: collision_check_cursor.close()
                    if existing_film and existing_film['letterboxd_uri'] != film['letterboxd_uri']:
                        print(f"  -> COLLISION: TMDb ID {tmdb_id_to_insert} for '{current_film_title_safe_for_print}' "
                              f"already used by URI '{safe_print_str(existing_film['letterboxd_uri'])}'. Skipping update for current film.")
                        skipped_due_to_collision += 1; continue
                
                details_url = f"{TMDB_API_URL}/movie/{tmdb_movie_id}"
                details_params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits'}
                response = requests.get(details_url, params=details_params)
                response.raise_for_status()
                movie_details = response.json()
                time.sleep(API_CALL_DELAY)

                directors_list, director_profiles_list = [], []
                actors_list, actor_profiles_list = [], []

                if 'credits' in movie_details:
                    # Process Directors
                    if 'crew' in movie_details['credits']:
                        for crew_member in movie_details['credits']['crew']:
                            if crew_member.get('job') == 'Director' and crew_member.get('name'):
                                directors_list.append(crew_member['name'])
                                director_person_id = crew_member.get('id')
                                director_profile_url = None
                                if director_person_id:
                                    try:
                                        print(f"    Fetching profile for director: {safe_print_str(crew_member['name'])} (ID: {director_person_id})")
                                        person_url = f"{TMDB_API_URL}/person/{director_person_id}"
                                        person_params = {'api_key': TMDB_API_KEY}
                                        person_response = requests.get(person_url, params=person_params)
                                        person_response.raise_for_status() # Raise HTTPError for bad responses (4XX or 5XX)
                                        person_details = person_response.json()
                                        time.sleep(API_CALL_DELAY) # Delay after each person API call
                                        
                                        if person_details.get('profile_path'):
                                            director_profile_url = f"{TMDB_IMAGE_BASE_URL}{TMDB_PROFILE_SIZE}{person_details['profile_path']}"
                                            print(f"      -> Found profile path for {safe_print_str(crew_member['name'])}")
                                        else:
                                            print(f"      -> No profile path for {safe_print_str(crew_member['name'])}")
                                    except requests.exceptions.HTTPError as he:
                                        print(f"      -> TMDb API HTTP Error fetching director {safe_print_str(crew_member['name'])} (ID: {director_person_id}): {he.response.status_code if he.response else 'Unknown'}")
                                        time.sleep(API_CALL_DELAY) # Delay even on error
                                    except requests.exceptions.RequestException as re:
                                        print(f"      -> TMDb API Request Error fetching director {safe_print_str(crew_member['name'])} (ID: {director_person_id}): {re}")
                                        time.sleep(API_CALL_DELAY) # Delay even on error
                                    except Exception as e_person:
                                        print(f"      -> Unexpected error fetching director profile {safe_print_str(crew_member['name'])}: {e_person}")
                                        time.sleep(API_CALL_DELAY) # Delay even on error
                                director_profiles_list.append(director_profile_url)
                            # Check if we have more directors than can be stored (unlikely with TEXT[] but good to be aware)

                    # Process Actors
                    if 'cast' in movie_details['credits']:
                        for actor_data in movie_details['credits']['cast'][:TOP_N_ACTORS]: 
                            if actor_data.get('name'): 
                                actors_list.append(actor_data['name'])
                                actor_profile_path = actor_data.get('profile_path')
                                actor_profiles_list.append(f"{TMDB_IMAGE_BASE_URL}{TMDB_PROFILE_SIZE}{actor_profile_path}" if actor_profile_path else None)
                            else:
                                actor_profiles_list.append(None) # Maintain parallelism

                poster_path = movie_details.get('poster_path')
                backdrop_path = movie_details.get('backdrop_path')
                runtime = movie_details.get('runtime')
                genres_list = [genre['name'] for genre in movie_details.get('genres', []) if genre.get('name')]
                release_date_str = movie_details.get('release_date')
                release_date = None
                if release_date_str:
                    try:
                        datetime.strptime(release_date_str, '%Y-%m-%d'); release_date = release_date_str
                    except ValueError: print(f"  -> TMDb: Invalid release date format '{safe_print_str(release_date_str)}'. Skipping.")

                update_cursor = conn.cursor()
                update_query = sql.SQL("""
                    UPDATE {table} SET
                        tmdb_id = %s, directors = %s, directors_profile_paths = %s, 
                        actors = %s, actor_profile_paths = %s,
                        poster_path = %s, backdrop_path = %s, runtime = %s,
                        genres = %s, release_date = %s, updated_at = NOW()
                    WHERE letterboxd_uri = %s;
                """).format(table=sql.Identifier(TABLE_NAME))
                
                update_cursor.execute(update_query, (
                    tmdb_movie_id, 
                    directors_list if directors_list else None, 
                    director_profiles_list if director_profiles_list else None,
                    actors_list if actors_list else None, 
                    actor_profiles_list if actor_profiles_list else None,
                    poster_path, backdrop_path, runtime, genres_list if genres_list else None,
                    release_date, film['letterboxd_uri']
                ))
                conn.commit(); updated_count +=1
                print(f"  -> DB: Updated '{current_film_title_safe_for_print}' (TMDb ID {tmdb_movie_id}) with {len(directors_list)} Director(s) (profiles: {sum(1 for p in director_profiles_list if p)}) and {len(actors_list)} Actor(s).")
                if update_cursor and not update_cursor.closed: update_cursor.close()

            except requests.exceptions.HTTPError as e:
                error_msg = safe_print_str(e.response.text if e.response and hasattr(e.response, 'text') else 'No response text')
                print(f"  -> TMDb API HTTP Error for '{current_film_title_safe_for_print}': {e.response.status_code if e.response else 'N/A'} - {error_msg}")
                if e.response and e.response.status_code == 404: print(f"  -> TMDb: Movie ID {tmdb_movie_id if tmdb_movie_id else '(unknown)'} not found (404).")
                time.sleep(API_CALL_DELAY) 
            except requests.exceptions.RequestException as e: print(f"  -> TMDb API Request Error for '{current_film_title_safe_for_print}': {e}"); time.sleep(API_CALL_DELAY) 
            except psycopg2.Error as e: print(f"  -> DB Update/Delete Error for '{current_film_title_safe_for_print}': {e}"); conn.rollback() 
            except Exception as e: print(f"  -> Unexpected error for '{current_film_title_safe_for_print}': {type(e).__name__} - {e}"); import traceback; traceback.print_exc()

        print(f"\nFinished TMDb enrichment. Updated: {updated_count}, Deleted: {deleted_count}, Skipped (Collision): {skipped_due_to_collision}, Total Processed: {total_films_to_process}.")

    except psycopg2.Error as e:
        print(f"DB error during film selection: {e}")
        if hasattr(e, 'diag') and e.diag.message_primary: print(f"PostgreSQL Primary Error: {e.diag.message_primary}")
        conn.rollback() 
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
        except Exception as e: print(f"Note: Could not reconfigure stdout/stderr: {e}")
        try:
            os.system("chcp 65001 > nul"); print("Attempted chcp 65001.")
        except Exception as e: print(f"Note: chcp 65001 failed: {e}")
    try:
        db_connection = connect_db()
        if db_connection:
            print("\n--- Ensuring Table Schema ---")
            create_table_if_not_exists(db_connection)
            print("--- Table Schema Checked ---\n")
            print("\n--- Starting CSV Processing (Optional) ---")
            # process_csv_and_insert_data(db_connection, CSV_FILE_PATH) # Uncomment if needed for initial load or update from CSV
            print("--- Finished CSV Processing (or skipped) ---\n")
            print("--- Starting TMDb Enrichment ---")
            enrich_films_with_tmdb_data(db_connection)
            print("--- Finished TMDb Enrichment ---")
    finally:
        if db_connection and not db_connection.closed:
            db_connection.close()
            print("\nPostgreSQL connection closed.")