import os
import psycopg2

database_url = os.getenv("DATABASE_URL")
CONNECT_TIMEOUT = 10

def get_db_connection():
    if database_url:
        return psycopg2.connect(database_url, sslmode="require", connect_timeout=CONNECT_TIMEOUT)
    else:
        return psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            sslmode=os.getenv("DB_SSLMODE"),
            connect_timeout=CONNECT_TIMEOUT
        )
