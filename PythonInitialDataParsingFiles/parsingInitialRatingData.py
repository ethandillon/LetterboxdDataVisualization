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

# CSV file path for ratings (assuming it's in the same directory as the script)
RATINGS_CSV_FILE_PATH = 'LetterBoxdData/ratings.csv' 

def create_tables(conn):
    """
    Ensures the 'films' table is acknowledged (as pre-existing) 
    and creates the 'ratings_entries' table if it doesn't exist.
    """
    with conn.cursor() as cur:
        # We assume 'films' table already exists and is populated as per user's instruction.
        # We can add a check here if needed, but for now, we'll just proceed.
        print("Acknowledging 'films' table as pre-existing.")

        # Create ratings_entries table
        # Stores individual film ratings
        cur.execute("""
            CREATE TABLE IF NOT EXISTS ratings_entries (
                id SERIAL PRIMARY KEY,
                film_id INTEGER REFERENCES films(id) ON DELETE CASCADE, -- Assuming films(id) from previous script
                rating_date DATE,
                rating NUMERIC(2,1),
                letterboxd_rating_uri TEXT UNIQUE NOT NULL
            );
        """)
        print("Table 'ratings_entries' checked/created successfully.")
        conn.commit()

def get_film_id(conn, title, year):
    """
    Gets the ID of an existing film from the 'films' table.
    Returns the film's ID if found, otherwise None.
    This function is identical to the one in the diary parser.
    """
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM films WHERE title = %s AND year = %s;",
            (title, year)
        )
        film_record = cur.fetchone()
        return film_record[0] if film_record else None

def parse_and_insert_ratings(conn, csv_file_path):
    """Parses the ratings CSV file and inserts data into the ratings_entries table."""
    ratings_to_insert = []
    processed_uris = set()
    skipped_film_not_found_count = 0
    skipped_missing_data_count = 0

    try:
        with open(csv_file_path, mode='r', encoding='utf-8-sig') as file:
            csv_reader = csv.DictReader(file)
            
            # Expected columns for ratings.csv: Date,Name,Year,Letterboxd URI,Rating
            required_columns = ['Date', 'Name', 'Year', 'Letterboxd URI', 'Rating']
            if not csv_reader.fieldnames:
                print(f"Error: Ratings CSV file '{csv_file_path}' is empty or has no header row.")
                return
            if not all(col in csv_reader.fieldnames for col in required_columns):
                missing = [col for col in required_columns if col not in csv_reader.fieldnames]
                available = csv_reader.fieldnames
                print(f"Error: Ratings CSV file '{csv_file_path}' is missing required columns: {', '.join(missing)}")
                print(f"Available columns: {', '.join(available)}")
                return

            for row_num, row in enumerate(csv_reader, 1):
                try:
                    film_title = row.get('Name')
                    film_year_str = row.get('Year')
                    letterboxd_uri = row.get('Letterboxd URI')
                    rating_date_str = row.get('Date')
                    rating_value_str = row.get('Rating')

                    # Validate essential fields for a rating entry
                    if not film_title:
                        print(f"Skipping row {row_num} in ratings CSV: 'Name' is missing.")
                        skipped_missing_data_count +=1
                        continue
                    if not letterboxd_uri:
                        print(f"Skipping row {row_num} for film '{film_title}' in ratings CSV: 'Letterboxd URI' is missing.")
                        skipped_missing_data_count +=1
                        continue
                    if not rating_date_str:
                        print(f"Skipping rating for '{film_title}' ({letterboxd_uri}): 'Date' (rating_date) is missing.")
                        skipped_missing_data_count +=1
                        continue
                    # Rating value itself can be empty in CSV if not rated, but URI and Date should exist for a "rating entry"
                    
                    if letterboxd_uri in processed_uris:
                        print(f"Skipping duplicate Letterboxd URI in ratings CSV: {letterboxd_uri}")
                        continue
                    processed_uris.add(letterboxd_uri)

                    film_year = None
                    if film_year_str:
                        try:
                            film_year = int(film_year_str)
                        except ValueError:
                            print(f"Warning: Invalid year '{film_year_str}' for film '{film_title}' in ratings CSV at row {row_num}. Film will be searched with year as NULL.")
                    
                    film_id = get_film_id(conn, film_title, film_year)

                    if film_id is None:
                        print(f"Skipping rating for '{film_title}' (Year: {film_year_str if film_year_str else 'N/A'}): Film not found in 'films' table.")
                        skipped_film_not_found_count += 1
                        continue
                    
                    try:
                        # Letterboxd CSV date format is YYYY-MM-DD
                        rating_date = datetime.strptime(rating_date_str, '%Y-%m-%d').date()
                    except ValueError:
                        print(f"Skipping rating for '{film_title}' ({letterboxd_uri}): Invalid 'Date' format '{rating_date_str}'. Expected YYYY-MM-DD.")
                        skipped_missing_data_count +=1
                        continue

                    rating_value = None
                    if rating_value_str and rating_value_str.strip():
                        try:
                            rating_value = float(rating_value_str)
                            # Letterboxd ratings are 0.5 to 5.0. Schema is NUMERIC(2,1)
                            if not (0.5 <= rating_value <= 5.0): # Allow 0 if it's a valid way to represent "no score" but present
                                print(f"Warning: Rating {rating_value} for '{film_title}' ({letterboxd_uri}) is outside typical Letterboxd range (0.5-5.0).")
                        except ValueError:
                            print(f"Warning: Invalid rating value '{rating_value_str}' for '{film_title}' ({letterboxd_uri}). Setting rating to NULL.")
                    
                    ratings_to_insert.append(
                        (film_id, rating_date, rating_value, letterboxd_uri)
                    )

                except Exception as e:
                    print(f"Error processing row {row_num} in ratings CSV: {row}. Error: {e}")
                    continue 

        if not ratings_to_insert:
            print("No valid rating entries found to insert from ratings CSV.")
        else:
            with conn.cursor() as cur:
                insert_query = """
                    INSERT INTO ratings_entries (film_id, rating_date, rating, letterboxd_rating_uri)
                    VALUES %s
                    ON CONFLICT (letterboxd_rating_uri) DO NOTHING; 
                """
                execute_values(cur, insert_query, ratings_to_insert)
                conn.commit()
                print(f"Successfully processed and attempted to insert {len(ratings_to_insert)} rating entries.")
                print(f"{cur.rowcount} new rating entries were actually inserted (duplicates based on URI were skipped).")

        if skipped_film_not_found_count > 0:
            print(f"{skipped_film_not_found_count} rating entries were skipped because their films were not found in the 'films' table.")
        if skipped_missing_data_count > 0:
            print(f"{skipped_missing_data_count} rating entries were skipped due to missing essential data (Name, URI, or Date).")


    except FileNotFoundError:
        print(f"Error: The ratings CSV file '{csv_file_path}' was not found.")
    except Exception as e:
        print(f"An unexpected error occurred during ratings CSV processing: {e}")


def main():
    """Main function to connect to DB, create tables, and process ratings CSV."""
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
        print("Successfully connected to PostgreSQL database for ratings processing.")

        create_tables(conn) # Ensures ratings_entries table exists
        parse_and_insert_ratings(conn, RATINGS_CSV_FILE_PATH)

    except psycopg2.Error as e:
        print(f"Database connection error: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed after ratings processing.")

if __name__ == "__main__":
    main()
