import os
from dotenv import load_dotenv
load_dotenv()

email_remetente = os.getenv("EMAIL_REMETENTE")
senha_app = os.getenv("SENHA_APP")
google_client_id = os.getenv("GOOGLE_CLIENT_ID")
porta_email = os.getenv("EMAIL_PORT")
base_url = os.getenv("APP_BASE_URL")
