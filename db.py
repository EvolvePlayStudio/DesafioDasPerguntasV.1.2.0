import os
import psycopg2

database_url = os.getenv("DATABASE_URL")

if database_url:
    def get_db_connection():
        # Esse valor será o Internal Database URL completo
        return psycopg2.connect(database_url, sslmode="require")
else:
    def get_db_connection():
        return psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            sslmode=os.getenv("DB_SSLMODE")
        )
