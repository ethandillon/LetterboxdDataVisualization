import csv
import os
import psycopg2
from psycopg2 import sql
from psycopg2.extras import execute_values
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables from .env file
load_dotenv()

# Database connection parameters
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")

# CSV file path (assuming it's in the same directory as the script)
CSV_FILE_PATH = 'LetterBoxdData/diary.csv' 

def create_tables(conn):
    """Creates the films and diary_entries tables if they don't exist."""
    with conn.cursor() as cur:
        # Create films table (IF NOT EXISTS is safe)
        # Stores unique films to avoid redundancy
        cur.execute("""
            CREATE TABLE IF NOT EXISTS films (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                year INTEGER,
                CONSTRAINT unique_film UNIQUE (title, year) 
            );
        """)
        print("Table 'films' checked/created successfully (if not exists).")

        # Create diary_entries table
        # Stores individual watch diary entries
        cur.execute("""
            CREATE TABLE IF NOT EXISTS diary_entries (
                id SERIAL PRIMARY KEY,
                film_id INTEGER REFERENCES films(id) ON DELETE CASCADE,
                watched_date DATE,
                rewatch BOOLEAN DEFAULT FALSE,
                rating NUMERIC(2,1),
                letterboxd_diary_uri TEXT UNIQUE NOT NULL
            );
        """)
        print("Table 'diary_entries' checked/created successfully.")
        conn.commit()

def get_film_id(conn, title, year):
    """
    Gets the ID of an existing film from the 'films' table.
    Returns the film's ID if found, otherwise None.
    """
    with conn.cursor() as cur:
        # Try to find the film
        cur.execute(
            "SELECT id FROM films WHERE title = %s AND year = %s;",
            (title, year)
        )
        film_record = cur.fetchone()

        if film_record:
            return film_record[0]
        else:
            # Film not found in the database
            return None

def parse_and_insert_diary(conn, csv_file_path):
    """Parses the CSV file and inserts data into the diary_entries table."""
    entries_to_insert = []
    processed_uris = set()
    skipped_film_not_found_count = 0

    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as file: # utf-8-sig to handle potential BOM
            csv_reader = csv.DictReader(file)
            
            required_columns = ['Name', 'Year', 'Letterboxd URI', 'Watched Date']
            if not csv_reader.fieldnames: # Handle empty CSV or header issue
                print("Error: CSV file is empty or has no header row.")
                return
            if not all(col in csv_reader.fieldnames for col in required_columns):
                missing = [col for col in required_columns if col not in csv_reader.fieldnames]
                print(f"Error: CSV file is missing required columns: {', '.join(missing)}")
                print(f"Available columns: {', '.join(csv_reader.fieldnames)}")
                return

            for row_num, row in enumerate(csv_reader, 1):
                try:
                    film_title = row.get('Name')
                    film_year_str = row.get('Year')
                    letterboxd_uri = row.get('Letterboxd URI')
                    
                    if not film_title:
                        print(f"Skipping row {row_num}: 'Name' is missing.")
                        continue
                    if not letterboxd_uri:
                        print(f"Skipping row {row_num} for film '{film_title}': 'Letterboxd URI' is missing.")
                        continue
                    
                    if letterboxd_uri in processed_uris:
                        print(f"Skipping duplicate Letterboxd URI in CSV: {letterboxd_uri}")
                        continue
                    processed_uris.add(letterboxd_uri)

                    film_year = None
                    if film_year_str:
                        try:
                            film_year = int(film_year_str)
                        except ValueError:
                            print(f"Warning: Invalid year '{film_year_str}' for film '{film_title}' at row {row_num}. Film will be searched with year as NULL.")
                    
                    # Get film_id from existing films table
                    film_id = get_film_id(conn, film_title, film_year)

                    if film_id is None:
                        # Film not found in the 'films' table, so skip this diary entry
                        print(f"Skipping diary entry for '{film_title}' (Year: {film_year_str if film_year_str else 'N/A'}): Film not found in 'films' table.")
                        skipped_film_not_found_count += 1
                        continue

                    watched_date_str = row.get('Watched Date')
                    if not watched_date_str:
                        print(f"Skipping entry for '{film_title}' ({letterboxd_uri}): 'Watched Date' is missing.")
                        continue
                    
                    try:
                        watched_date = datetime.strptime(watched_date_str, '%Y-%m-%d').date()
                    except ValueError:
                        print(f"Skipping entry for '{film_title}' ({letterboxd_uri}): Invalid 'Watched Date' format '{watched_date_str}'. Expected YYYY-MM-DD.")
                        continue

                    rewatch = row.get('Rewatch', '').strip().lower() == 'yes'
                    rating_str = row.get('Rating', '').strip()
                    rating = None
                    if rating_str:
                        try:
                            rating = float(rating_str)
                            if not (0.5 <= rating <= 5.0 or rating == 0):
                                print(f"Warning: Rating {rating} for '{film_title}' ({letterboxd_uri}) is outside typical Letterboxd range (0.5-5.0).")
                        except ValueError:
                            print(f"Warning: Invalid rating value '{rating_str}' for '{film_title}' ({letterboxd_uri}). Setting rating to NULL.")
                    
                    entries_to_insert.append(
                        (film_id, watched_date, rewatch, rating, letterboxd_uri)
                    )

                except Exception as e:
                    print(f"Error processing row {row_num}: {row}. Error: {e}")
                    continue 

        if not entries_to_insert:
            print("No valid diary entries found to insert.")
            if skipped_film_not_found_count > 0:
                 print(f"{skipped_film_not_found_count} entries were skipped because their films were not found in the 'films' table.")
            return

        with conn.cursor() as cur:
            insert_query = """
                INSERT INTO diary_entries (film_id, watched_date, rewatch, rating, letterboxd_diary_uri)
                VALUES %s
                ON CONFLICT (letterboxd_diary_uri) DO NOTHING; 
            """
            execute_values(cur, insert_query, entries_to_insert)
            conn.commit()
            print(f"Successfully processed and attempted to insert {len(entries_to_insert)} diary entries.")
            print(f"{cur.rowcount} new diary entries were actually inserted (duplicates based on URI were skipped).")
            if skipped_film_not_found_count > 0:
                 print(f"{skipped_film_not_found_count} entries were skipped because their films were not found in the 'films' table.")


    except FileNotFoundError:
        print(f"Error: The file {csv_file_path} was not found.")
    except Exception as e:
        print(f"An unexpected error occurred during CSV processing: {e}")


def main():
    """Main function to connect to DB, create tables, and process CSV."""
    conn = None
    try:
        if not all([DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT]):
            print("Error: Database credentials are not fully set in the .env file.")
            print("Please ensure DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, and DB_PORT are defined.")
            return

        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        print("Successfully connected to PostgreSQL database.")

        create_tables(conn) # Ensures diary_entries table exists, checks films table
        parse_and_insert_diary(conn, CSV_FILE_PATH)

    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main()
