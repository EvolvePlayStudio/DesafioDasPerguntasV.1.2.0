import os

# Só carrega o .env se estiver rodando localmente
if os.environ.get("FLASK_ENV") != "production":
    from dotenv import load_dotenv
    load_dotenv()

email_remetente = os.getenv("EMAIL_REMETENTE")
senha_app = os.getenv("SENHA_APP")
porta_email = os.getenv("EMAIL_PORT")
base_url = os.getenv("APP_BASE_URL")
