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
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

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

def update_film_manually(conn, db_film_id, manual_tmdb_id):
    """
    Fetches data from TMDb using manual_tmdb_id and updates the film
    identified by db_film_id in the database.
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Check if the film with db_film_id exists
        cursor.execute(sql.SQL("SELECT title, letterboxd_uri FROM {table} WHERE id = %s").format(table=sql.Identifier(TABLE_NAME)), (db_film_id,))
        film_to_update = cursor.fetchone()
        if not film_to_update:
            print(f"Error: No film found in table '{TABLE_NAME}' with id = {db_film_id}.")
            return

        print(f"Found film in DB: '{safe_print_str(film_to_update['title'])}' (ID: {db_film_id}, URI: {safe_print_str(film_to_update['letterboxd_uri'])}).")

        # 2. Check for TMDb ID collision: if this TMDb ID is already used by a *different* film
        cursor.execute(sql.SQL("SELECT id, title FROM {table} WHERE tmdb_id = %s AND id != %s").format(table=sql.Identifier(TABLE_NAME)), (manual_tmdb_id, db_film_id))
        colliding_film = cursor.fetchone()
        if colliding_film:
            print(f"WARNING: TMDb ID {manual_tmdb_id} is already assigned to a different film in your database:")
            print(f"  -> Existing DB Film ID: {colliding_film['id']}, Title: '{safe_print_str(colliding_film['title'])}'")
            confirm = input(f"Do you still want to assign TMDb ID {manual_tmdb_id} to film ID {db_film_id} ('{safe_print_str(film_to_update['title'])}')? (yes/no): ").lower()
            if confirm != 'yes':
                print("Update cancelled by user due to TMDb ID collision.")
                return
        
        # 3. Fetch movie details from TMDb
        print(f"Fetching details from TMDb for ID: {manual_tmdb_id}...")
        details_url = f"{TMDB_API_URL}/movie/{manual_tmdb_id}"
        details_params = {'api_key': TMDB_API_KEY, 'append_to_response': 'credits'}
        
        response = requests.get(details_url, params=details_params)
        response.raise_for_status() # Raise an exception for HTTP errors
        movie_details = response.json()
        time.sleep(API_CALL_DELAY) # Be respectful of API limits

        print(f"  -> TMDb: Found '{safe_print_str(movie_details.get('title'))}' ({movie_details.get('release_date')})")

        # 4. Extract data
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
        if release_date_str:
            try:
                datetime.strptime(release_date_str, '%Y-%m-%d') # Validate format
                release_date_obj = release_date_str
            except ValueError:
                print(f"  -> TMDb: Invalid release date format '{safe_print_str(release_date_str)}'. Will store as NULL.")

        # 5. Update the database
        update_query = sql.SQL("""
            UPDATE {table} SET
                tmdb_id = %s,
                title = %s, 
                year = %s, 
                director = %s,
                actors = %s,
                poster_path = %s,
                backdrop_path = %s,
                overview = %s,
                runtime = %s,
                genres = %s,
                release_date = %s,
                updated_at = NOW()
            WHERE id = %s;
        """).format(table=sql.Identifier(TABLE_NAME))
        
        # Extract year from TMDb release_date for the 'year' column
        tmdb_year = None
        if release_date_str and len(release_date_str) >= 4:
            try:
                tmdb_year = int(release_date_str.split('-')[0])
            except ValueError:
                pass # tmdb_year remains None

        cursor.execute(update_query, (
            manual_tmdb_id,
            movie_details.get('title'), # Update title from TMDb
            tmdb_year,                  # Update year from TMDb
            director_name,
            actors_list if actors_list else None,
            poster_path,
            backdrop_path,
            overview,
            runtime,
            genres_list if genres_list else None,
            release_date_obj,
            db_film_id
        ))
        conn.commit()
        print(f"  -> DB: Successfully updated film ID {db_film_id} ('{safe_print_str(movie_details.get('title'))}') with TMDb ID {manual_tmdb_id}.")

    except requests.exceptions.HTTPError as e:
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
                os.system("chcp 65001 > nul")
                print("Attempted to set console to UTF-8 via chcp 65001.")
            except Exception as e_chcp:
                print(f"Note: Could not set console via chcp: {e_chcp}")

    db_connection = connect_db()

    if db_connection:
        try:
            while True:
                try:
                    db_id_input = input("Enter the database ID of the film to update (or 'q' to quit): ")
                    if db_id_input.lower() == 'q':
                        break
                    db_id = int(db_id_input)
                    break
                except ValueError:
                    print("Invalid input. Please enter a numeric ID or 'q'.")
            
            if db_id_input.lower() != 'q':
                while True:
                    try:
                        tmdb_id_input = input(f"Enter the TMDb ID for film with database ID {db_id} (or 'q' to quit): ")
                        if tmdb_id_input.lower() == 'q':
                            break
                        manual_tmdb_id_val = int(tmdb_id_input)
                        break
                    except ValueError:
                        print("Invalid input. Please enter a numeric TMDb ID or 'q'.")

                if tmdb_id_input.lower() != 'q':
                    update_film_manually(db_connection, db_id, manual_tmdb_id_val)

        finally:
            if db_connection and not db_connection.closed:
                db_connection.close()
                print("\nPostgreSQL connection closed.")
    else:
        print("Could not establish database connection. Exiting.")
