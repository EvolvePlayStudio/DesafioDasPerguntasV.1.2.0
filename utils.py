import os
from datetime import timezone, timedelta
from zoneinfo import ZoneInfo

# Só carrega o .env se estiver rodando localmente
if os.environ.get("FLASK_ENV") != "production":
    from dotenv import load_dotenv
    load_dotenv()

email_remetente = os.getenv("EMAIL_REMETENTE")
senha_app = os.getenv("SENHA_APP")
porta_email = os.getenv("EMAIL_PORT")
base_url = os.getenv("APP_BASE_URL")
AMAZON_TRACKING_ID = os.getenv('AMAZON_TRACKING_ID')

temas_disponiveis = ["Artes", "Astronomia", "Biologia", "Esportes", "Filosofia", "Física", "Geografia", "História", "Mídia", "Música", "Química", "Variedades"]

tz_sp = ZoneInfo("America/Sao_Paulo")
email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
dominios_permitidos = {
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
    "protonmail.com", "icloud.com", "live.com"
}
dominios_descartaveis = {
    "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com"
}
CAPTCHA_BASE_DIR = "static/captcha_imgs"
FUSO_SERVIDOR = timezone(timedelta(hours=-3)) # Depois ver se não dá para tirar esta variável
QUESTION_CONFIG = {
    'discursiva': {
        'table': 'perguntas_discursivas',
        'select_cols': [
            'p.id_pergunta',
            'p.subtemas',
            'p.enunciado',
            'p.respostas_corretas',   
            'p.dica',
            'p.nota',
            "COALESCE(f.estrelas, NULL) AS estrelas",
            "COALESCE(f.comentario, NULL) AS comentario",
            "r.id_resposta IS NOT NULL AS respondida",
            "p.dificuldade",
            "p.versao",
            "p.disponivel_visitantes",
            "p.prioridade_usuarios"
        ],
        'select_cols_visitante': [
            'p.id_pergunta',
            'p.subtemas',
            'p.enunciado',
            'p.respostas_corretas',   
            'p.dica',
            'p.nota',
            "COALESCE(f.estrelas, NULL) AS estrelas",
            "COALESCE(f.comentario, NULL) AS comentario",
            "p.dificuldade",
            "p.versao",
            "p.disponivel_visitantes"
        ],
        'tipo_str': 'Discursiva'
    },
    'objetiva': {
        'table': 'perguntas_objetivas',
        'select_cols': [
            'p.id_pergunta',
            'p.subtemas',
            'p.enunciado',
            'p.alternativa_a',
            'p.alternativa_b',
            'p.alternativa_c',
            'p.alternativa_d',
            'p.resposta_correta',
            'p.nota',
            "COALESCE(f.estrelas, NULL) AS estrelas",
            "COALESCE(f.comentario, NULL) AS comentario",
            "r.id_resposta IS NOT NULL AS respondida",
            "p.dificuldade",
            "p.versao",
            "p.disponivel_visitantes",
            "p.prioridade_usuarios"
        ],
        'select_cols_visitante': [
            'p.id_pergunta',
            'p.subtemas',
            'p.enunciado',
            'p.alternativa_a',
            'p.alternativa_b',
            'p.alternativa_c',
            'p.alternativa_d',
            'p.resposta_correta',
            'p.nota',
            "COALESCE(f.estrelas, NULL) AS estrelas",
            "COALESCE(f.comentario, NULL) AS comentario",
            "p.dificuldade",
            "p.versao",
            "p.disponivel_visitantes"
        ],
        'tipo_str': 'Objetiva'
    }
}
EMAILS_PROIBIDOS = ['admin@gmail.com', 'teste@gmail.com']
privileged_ids = (4, 6, 16)  # ids com permissão para ver perguntas inativas
