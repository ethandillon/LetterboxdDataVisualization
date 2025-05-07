import psycopg2
from psycopg2 import sql
from psycopg2.extras import RealDictCursor
import os
import sys
import time
import requests
from dotenv import load_dotenv
from datetime import datetime
import locale

# --- Configuration ---
load_dotenv() # Load environment variables from .env file

# Database connection details from .env file
DB_NAME = os.getenv("DB_NAME", "your_db_name_default")
DB_USER = os.getenv("DB_USER", "your_db_user_default")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

# TMDb API Key from .env file
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# Define the table name in your PostgreSQL database
TABLE_NAME = "films" # As per your last script version

# TMDb API base URL
TMDB_API_URL = "https://api.themoviedb.org/3"
API_CALL_DELAY = 0.5 # Delay between TMDb API calls
TOP_N_ACTORS = 5     # Number of top actors to store

# --- Helper Functions ---

def safe_print_str(s, default_encoding='utf-8'):
    """Safely prepares a string for printing to the console."""
    if not isinstance(s, str):
        s = str(s)
    effective_encoding = sys.stdout.encoding or locale.getencoding() or default_encoding
    try:
        return s.encode('utf-8', errors='replace').decode(effective_encoding, errors='replace')
    except Exception:
        return s.encode('ascii', errors='replace').decode('ascii', errors='replace')

def connect_db():
    """Establishes a connection to the PostgreSQL database."""
    if not DB_PASSWORD:
        print("Error: DB_PASSWORD not found. Ensure it's in your .env file.")
        return None
    if not TMDB_API_KEY:
        print("Error: TMDB_API_KEY not found. Ensure it's in your .env file.")
        return None
    if DB_NAME == "your_db_name_default" or DB_USER == "your_db_user_default":
        print("Warning: Using default database name or user. Set DB_NAME/DB_USER in .env if not intended.")
    
    try:
        conn = psycopg2.connect(
            dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD, host=DB_HOST, port=DB_PORT
        )
        print(f"Successfully connected to PostgreSQL database '{safe_print_str(DB_NAME)}'.")
        return conn
    except psycopg2.OperationalError as e:
        print(f"Error connecting to PostgreSQL: {e}")
        return None

def add_film_by_tmdb_id(conn, new_tmdb_id):
    """
    Fetches film data from TMDb using new_tmdb_id and inserts it as a new entry
    into the database table.
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Check if this TMDb ID already exists in the database
        cursor.execute(sql.SQL("SELECT id, title, letterboxd_uri FROM {table} WHERE tmdb_id = %s").format(table=sql.Identifier(TABLE_NAME)), (new_tmdb_id,))
        existing_film = cursor.fetchone()
        if existing_film:
            print(f"Error: A film with TMDb ID {new_tmdb_id} already exists in your database:")
            print(f"  -> DB ID: {existing_film['id']}, Title: '{safe_print_str(existing_film['title'])}', Letterboxd URI: {safe_print_str(existing_film['letterboxd_uri'])}")
            print("No new entry will be added.")
            return

        # 2. Fetch movie details from TMDb
        print(f"Fetching details from TMDb for ID: {new_tmdb_id}...")
        details_url = f"{TMDB_API_URL}/movie/{new_tmdb_id}"
        details_params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits'}
        
        response = requests.get(details_url, params=details_params)
        response.raise_for_status() # Raise an exception for HTTP errors (e.g., 404 Not Found)
        movie_details = response.json()
        time.sleep(API_CALL_DELAY) # Be respectful of API limits

        tmdb_title = movie_details.get('title')
        if not tmdb_title: # Basic check if we got a valid movie object
            print(f"Error: Could not retrieve a valid title from TMDb for ID {new_tmdb_id}. Aborting.")
            return

        print(f"  -> TMDb: Found '{safe_print_str(tmdb_title)}' ({movie_details.get('release_date')})")

        # 3. Extract data
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
        release_date_obj = None # For the database
        tmdb_year = None      # For the 'year' column

        if release_date_str:
            try:
                # Validate format and prepare for DB
                datetime.strptime(release_date_str, '%Y-%m-%d') 
                release_date_obj = release_date_str
                if len(release_date_str) >= 4:
                    tmdb_year = int(release_date_str.split('-')[0])
            except ValueError:
                print(f"  -> TMDb: Invalid release date format '{safe_print_str(release_date_str)}'. Year and Release Date will be stored as NULL.")
        
        # Generate a placeholder Letterboxd URI since this is a TMDb-first entry
        # This is to satisfy the NOT NULL UNIQUE constraint on letterboxd_uri
        # Ensure this placeholder is unique enough. Appending tmdb_id should make it unique.
        placeholder_letterboxd_uri = f"tmdb_entry_placeholder_{new_tmdb_id}"

        # 4. Insert the new film into the database
        insert_query = sql.SQL("""
            INSERT INTO {table} (
                letterboxd_uri, tmdb_id, title, year, director, actors,
                poster_path, backdrop_path, overview, runtime, genres, release_date
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id; 
        """).format(table=sql.Identifier(TABLE_NAME))
        
        cursor.execute(insert_query, (
            placeholder_letterboxd_uri,
            new_tmdb_id,
            tmdb_title,
            tmdb_year,
            director_name,
            actors_list if actors_list else None,
            poster_path,
            backdrop_path,
            overview,
            runtime,
            genres_list if genres_list else None,
            release_date_obj
        ))
        new_db_id = cursor.fetchone()['id']
        conn.commit()
        print(f"  -> DB: Successfully added new film '{safe_print_str(tmdb_title)}' with DB ID {new_db_id} and TMDb ID {new_tmdb_id}.")
        print(f"     Letterboxd URI placeholder: {placeholder_letterboxd_uri}")

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"  -> Error: TMDb ID {new_tmdb_id} not found on The Movie Database.")
        else:
            print(f"  -> TMDb API HTTP Error: {e.status_code} - {safe_print_str(e.response.text if e.response and hasattr(e.response, 'text') else 'No response text')}")
    except requests.exceptions.RequestException as e:
        print(f"  -> TMDb API Request Error: {e}")
    except psycopg2.Error as e:
        print(f"  -> Database Error: {e}")
        if conn and not conn.closed: conn.rollback()
    except Exception as e:
        print(f"  -> An unexpected error occurred: {type(e).__name__} - {e}")
    finally:
        if cursor and not cursor.closed: cursor.close()

# --- Main Execution ---
if __name__ == "__main__":
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            sys.stderr.reconfigure(encoding='utf-8', errors='replace')
            print("Attempted to reconfigure stdout/stderr to UTF-8.")
        except Exception as e_reconfigure:
            print(f"Note: Could not reconfigure stdout/stderr: {e_reconfigure}")
            try:
                os.system("chcp 65001 > nul") # Suppress chcp output
                print("Attempted to set console to UTF-8 via chcp 65001.")
            except Exception as e_chcp:
                print(f"Note: Could not set console via chcp: {e_chcp}")

    db_connection = connect_db()

    if db_connection:
        try:
            while True:
                try:
                    tmdb_id_input = input("Enter the TMDb ID of the film to add (or 'q' to quit): ")
                    if tmdb_id_input.lower() == 'q':
                        break
                    tmdb_id_to_add = int(tmdb_id_input)
                    
                    add_film_by_tmdb_id(db_connection, tmdb_id_to_add)
                    print("-" * 30) # Separator for next entry

                except ValueError:
                    print("Invalid input. Please enter a numeric TMDb ID or 'q'.")
                except KeyboardInterrupt:
                    print("\nOperation cancelled by user.")
                    break
            
        finally:
            if db_connection and not db_connection.closed:
                db_connection.close()
                print("\nPostgreSQL connection closed.")
    else:
        print("Could not establish database connection. Exiting tool.")
