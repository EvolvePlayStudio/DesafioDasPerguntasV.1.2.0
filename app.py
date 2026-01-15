from flask import Flask, jsonify, render_template, request, session, redirect, send_file, url_for, make_response, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from utils import *
import secrets
import smtplib
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
import re
import logging
import sys
import traceback
from apscheduler.schedulers.background import BackgroundScheduler
from atualizar_perguntas_dicas import *
import random, string, time
from PIL import Image, ImageEnhance, ImageFilter
from io import BytesIO
import urllib.parse
import qrcode
from functools import wraps
import pytz

# Definir timezone de São Paulo
tz_sp = pytz.timezone("America/Sao_Paulo")

app = Flask(__name__, static_folder='static', template_folder='templates')
# Para fazer depuração na render
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

temas_disponiveis = ["Artes", "Astronomia", "Biologia", "Esportes", "Filosofia", "Geografia", "História", "Mídia", "Música", "Química", "Tecnologia", "Variedades"]

# IDs de perguntas para os usuários no modo visitante
ids_perguntas_objetivas_visitante = {"Artes": [163, 172, 333, 336, 353], "Astronomia": [6, 12, 479, 492, 500], "Biologia": [18, 22, 371, 580, 585], "Esportes": [55, 66, 63, 467, 471], "Filosofia": [142, 149, 150, 302, 305], "Geografia": [80, 84, 86, 93, 316], "História": [35, 41, 42, 118, 127], "Mídia": [99, 106, 381, 385, 391], "Música": [219, 222, 226, 229, 231], "Química": [184, 188, 189, 202, 538], "Tecnologia": [243, 246, 251, 273, 415], "Variedades": [136, 192, 270, 451, 627]}
"""
ids_perguntas_discursivas_visitante = {"Artes": [253, 258, 270, 425, 612], "Astronomia": [96, 97, 103, 111, 539], "Biologia": [8, 48, 50, 52, 438], "Esportes": [12, 79, 83, 84, 523], "Filosofia": [227, 230, 231, 235, 237], "Geografia": [157, 158, 163, 174, 169], "História": [30, 35, 38, 129, 275], "Mídia": [188, 209, 637, 641, 650], "Música": [313, 327, 479, 488, 491], "Química": [301, 303, 577, 582, 594], "Tecnologia": [152, 342, 351, 358, 470], "Variedades": [90, 144, 376, 659, 662]}"""

ids_perguntas_discursivas_visitante = {"Artes": [253, 258, 270, 425, 612], "Astronomia": [96, 97, 103, 111, 539], "Biologia": [8, 48, 50, 52, 438], "Esportes": [12, 79, 83, 84, 523], "Filosofia": [227, 230, 231, 235, 237], "Geografia": [157, 158, 163, 174, 169], "História": [30, 35, 38, 129, 275], "Mídia": [209, 635, 637, 641, 650], "Música": [313, 327, 479, 488, 491], "Química": [301, 303, 577, 582, 594], "Tecnologia": [152, 342, 351, 358, 470], "Variedades": [90, 144, 376, 659, 662]}

app.secret_key = os.getenv("SECRET_KEY")
invite_token = os.getenv("TOKEN_CONVITE")
email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
dominios_permitidos = {
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
    "protonmail.com", "icloud.com", "live.com"
}
dominios_descartaveis = {
    "mailinator.com", "10minutemail.com", "guerrillamail.com", "tempmail.com"
}
CAPTCHA_BASE_DIR = "static/captcha_imgs"
FUSO_SERVIDOR = timezone(timedelta(hours=-3))
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
            "r.id_resposta IS NOT NULL AS respondida",
            "p.dificuldade",
            "p.versao"
        ],
        'select_cols_visitante': [
            'p.id_pergunta',
            'p.subtemas',
            'p.enunciado',
            'p.respostas_corretas',   
            'p.dica',
            'p.nota',
            "COALESCE(f.estrelas, NULL) AS estrelas",
            "p.dificuldade",
            "p.versao"
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
            "r.id_resposta IS NOT NULL AS respondida",
            "p.dificuldade",
            "p.versao"
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
            "p.dificuldade",
            "p.versao"
        ],
        'tipo_str': 'Objetiva'
    }
}
EMAILS_PROIBIDOS = ['admin@gmail.com']
SITE_EM_MANUTENCAO = False
privileged_ids = (4, 6, 16)  # ids com permissão para ver perguntas inativas
id_visitante_admin = "aa01f790-74db-44c1-95fa-7b4d2cde075b"

scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")

# Código copia e cola gerado pelo Nubank
codigo_pix = os.getenv("QR_CODE")
img = qrcode.make(codigo_pix)
img.save("static/qrcode.png")

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):

        # 🚧 BLOQUEIO GLOBAL DE MANUTENÇÃO
        if SITE_EM_MANUTENCAO:
            return jsonify({"message": "Site em manutenção"}), 503

        # 👤 Modo visitante
        if session.get("visitante"):
            return f(user_id=None, *args, **kwargs)

        token = None

        # 1️⃣ Tenta extrair do header Authorization
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        # 2️⃣ Se não tiver no header, tenta pegar do cookie
        if not token:
            token = request.cookies.get("token_sessao")
        if not token:
            return redirect("/login")

        # 3️⃣ Verifica token no banco
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("""
                SELECT id_usuario, ativo
                FROM sessoes 
                WHERE token = %s AND ativo=TRUE AND expira_em > NOW()
            """, (token,))
            row = cur.fetchone()
        except Exception:
            return jsonify({"message": "Erro ao validar sessão"}), 500
        finally:
            if cur: cur.close()
            if conn: conn.close()

        if not row:
            return jsonify({"message": "Sessão expirada"}), 401

        # Passa o user_id para a rota
        return f(user_id=row[0], *args, **kwargs)

    return decorated

@app.route("/api/regras_pontuacao")
def api_regras_pontuacao():
    try:
        regras_pontuacao = carregar_regras_pontuacao()
        return jsonify(success=True, regras_pontuacao=regras_pontuacao)
    except Exception:
        return jsonify(
            success=False,
            message="Erro ao carregar regras de pontuação"
        ), 500

def carregar_regras_pontuacao():
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT * FROM regras_pontuacao ORDER BY id_ranking")

        linhas = cur.fetchall()
        colunas = [desc[0] for desc in cur.description]

        return [dict(zip(colunas, linha)) for linha in linhas]

    except Exception:
        app.logger.error("Erro ao buscar regras de pontuações\n" + traceback.format_exc())
        raise
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/entrar_visitante")
def entrar_visitante():
    session.clear()
    session["visitante"] = True
    return redirect("/home")

@app.route("/enviar_feedback", methods=["POST"])
@token_required
def enviar_feedback(user_id):
    data = request.get_json()
    id_pergunta = data.get("id_pergunta")
    tipo_pergunta = data.get("tipo_pergunta").capitalize()
    estrelas = data.get("estrelas")
    versao_pergunta = data.get("versao_pergunta")
    id_usuario = session.get("id_usuario")
    modo_visitante = session.get("visitante")
    id_visitante = session.get("id_visitante")

    if modo_visitante:
        if not all([id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_visitante]):
            return jsonify({"erro": "Dados incompletos como visitante"}), 400
    else:
        if not all([id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_usuario]):
            return jsonify({"erro": "Dados incompletos como usuário cadastrado"}), 400
        
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        if modo_visitante:
            cur.execute("""
                INSERT INTO feedbacks (id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_visitante, modo_visitante)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id_pergunta, tipo_pergunta, id_visitante)
                DO UPDATE SET estrelas = EXCLUDED.estrelas, versao_pergunta = EXCLUDED.versao_pergunta, modo_visitante = EXCLUDED.modo_visitante, ultima_atualizacao = date_trunc('second', date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'));
            """, (id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_visitante, modo_visitante))
        else:
            cur.execute("""
                INSERT INTO feedbacks (id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_usuario, modo_visitante)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (id_pergunta, tipo_pergunta, id_usuario)
                DO UPDATE SET estrelas = EXCLUDED.estrelas, versao_pergunta = EXCLUDED.versao_pergunta, modo_visitante = EXCLUDED.modo_visitante,  ultima_atualizacao = date_trunc('second', date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'));
            """, (id_pergunta, tipo_pergunta, estrelas, versao_pergunta, id_usuario, modo_visitante))
        conn.commit()
        cur.close()
        return jsonify({"sucesso": True})
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"erro": str(e)}), 500

@app.route("/api/feedbacks/comentarios", methods=["POST"])
@token_required
def enviar_feedback_comentario(user_id):
    data = request.get_json()

    if not data:
        return jsonify({"erro": "Payload inválido"}), 400

    modo_visitante = data.get("modo_visitante")
    comentario = (data.get("comentario") or "").strip()
    tema = data.get("tema")
    feedback_id = data.get("feedback_id")
    pontuacao_saldo = data.get("pontuacao_saldo")

    if modo_visitante is None:
        return jsonify({"erro": "modo_visitante é obrigatório"}), 400

    if not comentario:
        return jsonify({"erro": "Comentário vazio"}), 400

    if not tema:
        return jsonify({"erro": "Tema é obrigatório"}), 400

    id_usuario = session.get("id_usuario") if not modo_visitante else None
    id_visitante = session.get("id_visitante") if modo_visitante else None

    try:
        with get_db_connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:

                # =====================================
                # UPDATE (feedback já existe)
                # =====================================
                if feedback_id:
                    cur.execute(
                        """
                        SELECT id_feedback
                        FROM feedbacks_comentarios
                        WHERE id_feedback = %s
                          AND (
                            (%s = false AND id_usuario = %s)
                            OR
                            (%s = true AND id_visitante = %s)
                          )
                        """,
                        (
                            feedback_id,
                            modo_visitante, id_usuario,
                            modo_visitante, id_visitante
                        )
                    )

                    feedback = cur.fetchone()
                    if not feedback:
                        return jsonify({"erro": "Feedback não encontrado ou acesso negado"}), 403

                    cur.execute(
                        """
                        UPDATE feedbacks_comentarios
                        SET comentario = %s,
                            pontuacao_saldo = %s
                        WHERE id_feedback = %s
                        RETURNING id_feedback;
                        """,
                        (comentario, pontuacao_saldo, feedback_id)
                    )

                    conn.commit()

                    return jsonify({
                        "sucesso": True,
                        "id_feedback": feedback_id,
                        "editado": True
                    }), 200

                # =====================================
                # INSERT (novo feedback)
                # =====================================
                cur.execute(
                    """
                    INSERT INTO feedbacks_comentarios (
                        modo_visitante,
                        id_usuario,
                        id_visitante,
                        tema,
                        pontuacao_saldo,
                        comentario
                    )
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id_feedback;
                    """,
                    (
                        modo_visitante,
                        id_usuario,
                        id_visitante,
                        tema,
                        pontuacao_saldo,
                        comentario
                    )
                )

                novo_id = cur.fetchone()["id_feedback"]
                conn.commit()

                return jsonify({
                    "sucesso": True,
                    "id_feedback": novo_id,
                    "editado": False
                }), 201

    except Exception as e:
        print("Erro ao salvar feedback:", e)
        return jsonify({
            "erro": "Erro interno",
            "detalhe": str(e)
        }), 500

def identificar_dispositivo():
    ua = (request.headers.get("User-Agent") or "").lower()

    if not ua:
        return "Indefinido"

    # Mobile
    if any(x in ua for x in ["mobile", "android", "iphone", "ipod"]):
        return "Mobile"

    # Tablet
    if any(x in ua for x in ["ipad", "tablet"]):
        return "Tablet"

    # Desktop (apenas se houver indícios claros)
    if any(x in ua for x in ["windows", "macintosh", "linux"]):
        return "Desktop"

    return "Indefinido"

@app.route("/log/pagina", methods=["POST"])
def pagina_visitada():
    data = request.get_json()
    pagina = data.get("pagina")

    registrar_pagina_visitada(pagina=pagina)

    if not pagina:
        return {"error": "Página não informada"}, 400

    return {"sucess": True}, 200

def registrar_pagina_visitada(pagina):
    conn = cur = None
    id_usuario = session.get('id_usuario')
    id_visitante = session.get('id_visitante')

    if id_usuario in privileged_ids or id_visitante == id_visitante_admin:
        print("Retornarei")
        return

    try:
        dispositivo = identificar_dispositivo()

        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO acessos_paginas (pagina, id_usuario, dispositivo, id_visitante) 
            VALUES (%s, %s, %s, %s)
        """, (pagina, id_usuario, dispositivo, id_visitante))
        conn.commit()

    except Exception as e:
        if conn: conn.rollback()
        app.logger.error(f"Erro ao registrar página: {e}")

    finally:
        if cur: cur.close()
        if conn: conn.close()
        
def iniciar_agendamento():
    # Analisa 4 vezes por dia se o incremento no número de dicas e perguntas dos usuários foi feita
    scheduler.add_job(
    atualizar_perguntas_dicas, 'cron', hour=2, minute=0, id='atualizacao_02h', replace_existing=True
    )
    scheduler.add_job(
    atualizar_perguntas_dicas, 'cron', hour=8, minute=0, id='atualizacao_08h', replace_existing=True
    )
    scheduler.add_job(
    atualizar_perguntas_dicas, 'cron', hour=14, minute=0, id='atualizacao_14h', replace_existing=True
    )
    scheduler.add_job(
    atualizar_perguntas_dicas, 'cron', hour=20, minute=0, id='atualizacao_20h', replace_existing=True
    )
    scheduler.start()

iniciar_agendamento()

@app.route("/", methods=["GET"])
def index():
    destino = session.pop("destino_login", None)

    if destino == "registro":
        registrar_pagina_visitada("Home -> Registro")
    else:
        registrar_pagina_visitada("Login")

    return render_template("login.html", abrir_registro=(destino == "registro"))

@app.route("/intencao-login", methods=["POST"])
def intencao_login():
    data = request.get_json(silent=True) or {}
    if data.get("destino") == "registro":
        session["destino_login"] = "registro"
    return jsonify(ok=True)

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static', 'img'),
                               'Favicon.png', mimetype='image/png')

def checar_dados_registro(nome, email, senha):
    if not nome or not email or not senha:
        return False, "Preencha todos os campos"

    if not re.match(email_regex, email):
        return False, "E-mail inválido"

    dominio = email.split("@")[-1].lower()

    if dominio in dominios_descartaveis:
        return False, "Domínio de e-mail temporário não é permitido"

    if dominio not in dominios_permitidos:
        return False, "O provedor de e-mail fornecido não é confiável"

    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT id_usuario FROM usuarios_registrados WHERE email = %s", (email,))
    if cur.fetchone():
        cur.close()
        conn.close()
        return False, "E-mail já registrado"
    cur.close()
    conn.close()

    return True, "Validação OK"

@app.route("/register_validate", methods=["POST"])
def validar_registro():
    data = request.get_json()
    ok, msg = checar_dados_registro(data.get("nome"), data.get("email"), data.get("senha"))
    if not ok:
        return jsonify(success=False, message=msg)

    return jsonify(success=True, message="Validação OK")
        
def carregar_e_transformar(caminho_img):
    """Carrega a imagem do CAPTCHA com alguns ajustes para evitar identificação automática"""
    img = Image.open(caminho_img).convert("RGB")
    # Ajuste de brilho/contraste
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(random.uniform(0.85, 1.15))
    # Pequeno desfoque
    img = img.filter(ImageFilter.GaussianBlur(random.uniform(0, 1)))
    # Opcional: redimensiona para um tamanho consistente (ex: 200x200) mantendo a proporção
    img.thumbnail((240, 240), Image.LANCZOS)
    # Salvar em memória
    buffer = BytesIO()
    img.save(buffer, format="JPEG", quality=85)
    buffer.seek(0)
    return buffer

@app.route("/captcha_novo")
def captcha_novo():
    # Lista de categorias (pastas) dentro de CAPTCHA_BASE_DIR
    categorias = [d for d in os.listdir(CAPTCHA_BASE_DIR) if os.path.isdir(os.path.join(CAPTCHA_BASE_DIR, d))]
    if not categorias:
        return jsonify({"error": "Sem categorias de CAPTCHA configuradas"}), 500
    
    categoria_correta = random.choice(categorias)

    # 3 imagens corretas
    todas_da_cat = os.listdir(os.path.join(CAPTCHA_BASE_DIR, categoria_correta))
    if len(todas_da_cat) < 3:
        return jsonify({"error": "Categoria sem imagens suficientes"}), 500
    corretas = random.sample(todas_da_cat, 3)
    corretas_paths = [f"{categoria_correta}/{fname}" for fname in corretas]


    # 6 imagens incorretas
    outras_categorias = [c for c in categorias if c != categoria_correta]
    incorretas = []
    while len(incorretas) < 6:
        cat = random.choice(outras_categorias)
        arquivos = os.listdir(os.path.join(CAPTCHA_BASE_DIR, cat))
        if not arquivos:
            continue
        img = random.choice(arquivos)
        caminho = f"{cat}/{img}"
        if caminho not in incorretas:
            incorretas.append(caminho)

    todas = corretas_paths + incorretas
    random.shuffle(todas)

    # Criar token para este CAPTCHA
    token = secrets.token_hex(16)

    # Guardar na sessão quais índices são corretos
    session[f"captcha_{token}"] = {
        "categoria": categoria_correta,
        "corretos": [todas.index(path) for path in corretas_paths],
        "expira": time.time() + 180
    }

    # Gera URLs codificando segmentos
    imagens_urls = []
    for p in todas:
        cat, fname = p.split("/", 1)
        imagens_urls.append(f"/captcha_imagem/{urllib.parse.quote(cat)}/{urllib.parse.quote(fname)}")
    return jsonify({
        "token": token,
        "categoria": categoria_correta,
        "imagens": imagens_urls
    })

@app.route("/captcha_imagem/<categoria>/<filename>")
def captcha_imagem(categoria, filename):
    # Decodifica já feita pelo Flask — junta os segmentos
    subpath = os.path.join(categoria, filename)
    safe_subpath = os.path.normpath(subpath).lstrip(os.sep)
    full_path = os.path.join(CAPTCHA_BASE_DIR, safe_subpath)

    base_real = os.path.realpath(CAPTCHA_BASE_DIR)
    target_real = os.path.realpath(full_path)
    if not target_real.startswith(base_real):
        return "Caminho inválido", 400
    if not os.path.isfile(target_real):
        return "Imagem não encontrada", 404

    buffer = carregar_e_transformar(target_real)
    # evita cache no cliente (opcional)
    resp = send_file(buffer, mimetype="image/jpeg")
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp

def formatar_hora_servidor(timestamp):
    """Retorna data/hora formatada no fuso do servidor."""
    if not timestamp:
        return None
    dt = datetime.fromtimestamp(timestamp, FUSO_SERVIDOR)
    offset = FUSO_SERVIDOR.utcoffset(None)
    return dt.strftime("%H:%M")

@app.route('/verificar_bloqueio')
def verificar_bloqueio():
    registrar_pagina_visitada("Registro")
    info = session.get('bloqueio_captcha', {'tentativas_registro': 0, 'bloqueado_ate': 0})
    agora = time.time()

    if info.get('bloqueado_ate', 0) > agora:
        return jsonify(
            bloqueado=True,
            tentativas_registro=info['tentativas_registro'],
            bloqueado_ate=info['bloqueado_ate'],
            bloqueado_ate_str=formatar_hora_servidor(info['bloqueado_ate'])
        )
    else:
        session.pop('bloqueio_captcha', None)
        return jsonify(bloqueado=False)

@app.route('/registrar_falha_captcha', methods=['POST'])
def registra_falha_sessao():
    agora = time.time()
    info = session.get('bloqueio_captcha', {'tentativas_registro': 0, 'bloqueado_ate': 0})
    info['tentativas_registro'] += 1

    print(f"Tentativas: {info['tentativas_registro']}")
    if info['tentativas_registro'] >= 6:
        info['bloqueado_ate'] = agora + 15 * 60  # bloqueio 15 minutos

    session['bloqueio_captcha'] = info

    return jsonify(
        success=True,
        tentativas_registro=info['tentativas_registro'],
        bloqueado_ate=info['bloqueado_ate'],
        bloqueado_ate_str=formatar_hora_servidor(info['bloqueado_ate'])
    )

@app.route('/confirmar_email')
def confirmar_email():
    token = request.args.get('token')

    if not token:
        return render_template('mensagem.html', titulo="Erro", mensagem="Token de confirmação ausente.")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Busca usuário com o token fornecido e ainda válido
        cur.execute("""
            SELECT id_usuario, expiracao_token_confirmacao 
            FROM usuarios_registrados 
            WHERE token_confirmacao = %s
        """, (token,))
        usuario = cur.fetchone()

        if not usuario:
            return render_template('mensagem.html', titulo="Erro", mensagem="Token inválido.")

        id_usuario, expiracao = usuario

        if not expiracao or expiracao < datetime.utcnow():
            return render_template('mensagem.html', titulo="Token expirado", mensagem="O token de confirmação expirou.")

        # Atualiza o status do e-mail como confirmado
        cur.execute("""
            UPDATE usuarios_registrados
            SET email_confirmado = TRUE,
                token_confirmacao = NULL,
                expiracao_token_confirmacao = NULL
            WHERE id_usuario = %s
        """, (id_usuario,))
        conn.commit()

        return render_template('mensagem.html', titulo="Sucesso", mensagem="E-mail confirmado com sucesso!")
    
    except Exception:
        if conn:
            conn.rollback()
        return render_template('mensagem.html', titulo="Erro", mensagem="Erro ao confirmar o e-mail. Tente novamente mais tarde.")
    
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/api/debug/frontend", methods=["POST"])
def debug_frontend():
    data = request.get_json()

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO debug_frontend (
            mensagem, pagina, id_visitante, user_agent
        )
        VALUES (%s,%s,%s,%s)
    """, (
        data.get("mensagem"),
        data.get("pagina"),
        data.get("id_visitante"),
        data.get("user_agent")
    ))

    conn.commit()
    cur.close()
    conn.close()

    return "", 204

def gerar_token_confirmacao(tamanho=32):
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(tamanho))

@app.route("/home")
def home():
    id_usuario = session.get("id_usuario")
    id_visitante = session.get("id_visitante")
    visitante = session.get("visitante", False)

    if id_usuario in privileged_ids or id_visitante == id_visitante_admin:
        usuario_autorizado = True
    else:
        usuario_autorizado = False

    return render_template(
        "home.html",
        usuario_autorizado=usuario_autorizado,
        visitante=visitante
    )

@app.route("/resultado")
def resultado():
    usuario_logado = "id_usuario" in session
    return render_template(
        "resultado.html",
        usuario_logado=usuario_logado
    )

@app.route("/doações")
@token_required
def doacoes(user_id):
    chave_pix = os.getenv("CHAVE_PIX")
    registrar_pagina_visitada("Doações")
    return render_template("doacoes.html", chave_pix=chave_pix)

@app.route("/pesquisa")
@token_required
def pesquisa(user_id):
    registrar_pagina_visitada("Pesquisa")
    return render_template("pesquisa.html")

@app.route("/api/carregar-favoritos", methods=["GET"])
def get_favoritos_usuario():
    tema = request.args.get("tema-atual")
    tipo_pergunta = request.args.get("tipo-pergunta")
    id_usuario = session["id_usuario"]

    if not id_usuario or not tema or not tipo_pergunta:
        return jsonify({"error": "Parâmetros inválidos"}), 400

    conn = cur = None
    try:        
        conn = get_db_connection()
        cur = conn.cursor()

        query = """
            SELECT id_pergunta
            FROM favoritos_usuarios
            WHERE id_usuario = %s AND tema = %s AND tipo_pergunta = %s
        """
        cur.execute(query, (id_usuario, tema, tipo_pergunta))
        favoritos = [row[0] for row in cur.fetchall()]
    except Exception as e:
        print("Erro ao carregar favoritos")
        app.logger.exception("Erro ao carregar favoritos do usuário com id %s", id_usuario)
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return jsonify({"favoritos": favoritos})

@app.route("/recuperação-de-senha", methods=["POST"])
def esqueci_senha():
    data = request.get_json()
    email = data.get("email", "").strip()

    # mensagem padrão
    mensagem_padrao = "Se o e-mail estiver cadastrado, enviaremos instruções."

    if not email:
        return jsonify(success=False, message="Informe um e-mail válido.")

    # Busca email do usuário no banco
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT id_usuario, nome FROM usuarios_registrados WHERE email = %s", (email,))
        usuario = cur.fetchone()
    
        if usuario:
            token = secrets.token_urlsafe(32)
            expira = datetime.utcnow() + timedelta(hours=1)

            cur.execute("""
                UPDATE usuarios_registrados
                SET token_recuperacao = %s, expiracao_token_recuperacao = %s
                WHERE id_usuario = %s
            """, (token, expira, usuario[0]))
            conn.commit()
            
            # construir link de recuperação
            link_recuperacao = url_for('reset_senha', token=token, _external=True)

            # montar mensagem
            conteudo_email = f"""
            Olá {usuario[1]},

            Recebemos uma solicitação para redefinir sua senha.
            Clique no link abaixo para criar uma nova senha:

            {link_recuperacao}

            Se você não solicitou a recuperação de senha, ignore esta mensagem.
            """

            # enviar email
            try:
                enviar_email_recuperacao(email, "Recuperação de Senha - Desafio das Perguntas", conteudo_email)
            except Exception as e:
                print("Erro ao enviar email:", e)
                return jsonify(success=False, message=mensagem_padrao)
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception(f"Erro na recuperação de senha")
    finally:
        if cur: cur.close()
        if conn: conn.close()

    # Retorna mensagem padrão sempre, mesmo que o e-mail não exista
    return jsonify(success=True, message=mensagem_padrao)

def enviar_email_confirmacao(email_destinatario, nome_destinatario, link_confirmacao):
    remetente = email_remetente
    senha = senha_app
    porta = int(porta_email)

    assunto = "Confirmação de cadastro - Desafio das Perguntas"
    corpo = f"""
    Olá, {nome_destinatario}!

    Clique no link abaixo para confirmar seu cadastro em desafiodasperguntas.com.br

    {link_confirmacao}

    O link expira em 24 horas.

    """

    msg = MIMEMultipart()
    msg['From'] = remetente
    msg['To'] = email_destinatario
    msg['Subject'] = assunto
    msg.attach(MIMEText(corpo, 'plain'))

    try:
        with smtplib.SMTP("smtp.gmail.com", porta) as servidor:
            servidor.starttls()
            servidor.login(remetente, senha)
            servidor.send_message(msg)
        return True
    except Exception:
        app.logger.exception("Erro ao enviar email de confirmação de conta")
        return False

def enviar_email_recuperacao(destinatario, assunto, conteudo):

    remetente = email_remetente
    senha = senha_app

    msg = MIMEMultipart()
    msg['From'] = remetente
    msg['To'] = destinatario
    msg['Subject'] = assunto

    msg.attach(MIMEText(conteudo, 'plain'))

    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(remetente, senha)
        server.send_message(msg)

@app.route("/pergunta/<int:id_pergunta>/<tipo_pergunta>/gabarito", methods=["GET"])
@token_required
def get_gabarito(id_pergunta, tipo_pergunta, user_id):
    """Função para só pegar o gabarito e nota da pergunta após resposta enviada pelo usuário no modo desafio (evita expor o gabarito no localStorage)"""
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Consulta para objetivas
        if tipo_pergunta == 'objetiva':
            cur.execute("""
                SELECT resposta_correta, nota
                FROM perguntas_objetivas
                WHERE id_pergunta = %s
            """, (id_pergunta,))
            row = cur.fetchone()

            if not row:
                return {"erro": "Pergunta não encontrada"}, 404
            resposta_correta, nota = row

            return {
                "resposta_correta": resposta_correta,
                "nota": nota
            }
        # Consulta para discursivas
        else:
            cur.execute("""
                SELECT respostas_corretas, nota
                FROM perguntas_discursivas
                WHERE id_pergunta = %s
            """, (id_pergunta,))
            row = cur.fetchone()

            if not row:
                return {"erro": "Pergunta não encontrada"}, 404
            rc, nota = row

            # Função abaixo repetida em listar_perguntas
            try:
                respostas_corretas = [r.strip() if isinstance(r, str) else r for r in rc]
            except Exception:
                respostas_corretas = list(rc)

            return {
                "respostas_corretas": respostas_corretas,
                "nota": nota
            }
    except Exception:
        app.logger.exception("Erro ao buscar gabarito")
        return {"erro": "Erro interno"}, 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route('/api/perguntas', methods=['GET'])
@token_required
def listar_perguntas(user_id):
    """
    Retorna perguntas agrupadas por dificuldade conforme tipo (discursiva/objetiva) e modo (desafio/revisao).
    Retorna também as pontuações atuais do usuário em cada tema.
    """
    # Parâmetros de query
    tema = request.args.get('tema')
    modo = (request.args.get('modo') or '').lower()
    tipo_pergunta = (request.args.get('tipo-de-pergunta') or '').lower()
    id_usuario = session.get('id_usuario')
    id_visitante = session.get('id_visitante')
    modo_visitante = session.get("visitante")

    # Configurações locais
    limit = 150 if modo == 'desafio' else 1000

    # Validações
    if not tema or modo not in ('desafio', 'revisao') or tipo_pergunta not in ('objetiva', 'discursiva'):
        print("Parâmetros inválidos ou ausentes")
        return jsonify({'erro': 'Parâmetros inválidos ou ausentes'}), 400
    if not id_usuario and not modo_visitante:
        print("Usuário não autenticado")
        return jsonify({'erro': 'Usuário não autenticado'}), 401
    if not id_visitante and modo_visitante:
        print("Visitante não autenticado")
        return jsonify({'erro': 'Visitante não autenticado'}), 401
    
    cfg = QUESTION_CONFIG.get(tipo_pergunta)
    if not cfg:
        print("Tipo de pergunta inválido")
        return jsonify({'erro': 'Tipo de pergunta inválido'}), 400
    
    # Conexão com servidor
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
    except Exception:
        app.logger.exception("1.Erro ao tentar conectar para buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro ao tentar conectar para buscar novas perguntas'}), 500

    # Busca das perguntas
    try:
        if modo_visitante:
            is_privileged = False
        else:
            is_privileged = int(id_usuario) in privileged_ids

        select_clause = ",\n".join(cfg['select_cols'])
        select_cols_visitante = ",\n".join(cfg['select_cols_visitante'])
        tipo_str = cfg['tipo_str']   # Usado para filtrar feedbacks/respostas
        table = cfg['table']         # Nome da tabela — vindo do cfg interno (seguro)

        where_status = "p.status != 'Deletada'" if is_privileged else "p.status = 'Ativa'"

        """
        where_status = "p.status = 'Em teste'" if is_privileged else "p.status = 'Ativa'"
        """
        if modo_visitante:
            sql = f"""
                SELECT {select_cols_visitante}
                FROM {table} p
                LEFT JOIN feedbacks f
                    ON p.id_pergunta = f.id_pergunta AND f.id_visitante = %s AND f.tipo_pergunta = %s
                WHERE p.tema = %s AND {where_status}
                LIMIT %s
            """
            params = (id_visitante, tipo_str, tema, limit)
        else:
            sql = f"""
                SELECT {select_clause}
                FROM {table} p
                LEFT JOIN respostas_usuarios r
                    ON p.id_pergunta = r.id_pergunta AND r.id_usuario = %s AND r.tipo_pergunta = %s
                LEFT JOIN feedbacks f
                    ON p.id_pergunta = f.id_pergunta AND f.id_usuario = %s AND f.tipo_pergunta = %s
                WHERE p.tema = %s AND {where_status}
                LIMIT %s
            """
            params = (id_usuario, tipo_str, id_usuario, tipo_str, tema, limit)

        cur.execute(sql, params)
        linhas = cur.fetchall()

        perguntas_por_dificuldade = {'Fácil': [], 'Médio': [], 'Difícil': []}

        for row in linhas:
            if modo_visitante:
                respondida = False
                if tipo_pergunta == "discursiva":
                    if row["id_pergunta"] not in ids_perguntas_discursivas_visitante[tema]:
                        continue
                else:
                    if row["id_pergunta"] not in ids_perguntas_objetivas_visitante[tema]:
                        continue
            else:
                respondida = bool(row.get('respondida'))
            dificuldade = row.get('dificuldade') or 'Médio'  # Se por algum motivo for nulo, evita KeyError
            
            sb = row.get('subtemas') or []
            try:
                subtemas = [s.strip() if isinstance(s, str) else s for s in sb]
            except Exception:
                print(f"Erro ao tentar listar subtemas")
                app.logger.exception("Erro ao tentar listar subtemas do usuário com id %s para a pergunta com id %s", id_usuario, row['id_pergunta'])
                subtemas = list(sb)

            if tipo_pergunta == 'discursiva':
                rc = row.get('respostas_corretas') or []
                try:
                    respostas_corretas = [r.strip() if isinstance(r, str) else r for r in rc]
                except Exception:
                    respostas_corretas = list(rc)

                item = {
                    'id_pergunta': row['id_pergunta'],
                    'enunciado': row['enunciado'],
                    'dica': row.get('dica'),
                    'dificuldade': dificuldade,
                    'versao_pergunta': row.get('versao'),
                    'estrelas': row.get('estrelas'),
                }

                # Campos extras só no modo revisão
                if modo == 'revisao':
                    item.update({
                        'subtemas': subtemas,
                        'respostas_corretas': respostas_corretas,
                        'nota': row.get('nota'),
                    })

            else:  # Objetiva
                item = {
                    'id_pergunta': row['id_pergunta'],
                    'enunciado': row['enunciado'],
                    'alternativa_a': row.get('alternativa_a'),
                    'alternativa_b': row.get('alternativa_b'),
                    'alternativa_c': row.get('alternativa_c'),
                    'alternativa_d': row.get('alternativa_d'),
                    'dificuldade': dificuldade,
                    'versao_pergunta': row.get('versao'),
                    'estrelas': row.get('estrelas'),
                }

                # No modo revisão pode mandar resposta correta e nota
                if modo == 'revisao':
                    item.update({
                        'resposta_correta': row.get('resposta_correta'),
                        'nota': row.get('nota'),
                        'subtemas': subtemas,
                    })
            # Filtra por modo
            if modo_visitante:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
            elif modo == 'desafio' and not respondida:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
            elif modo == 'revisao' and respondida:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
    except Exception:
        app.logger.exception("2.Erro ao tentar conectar para buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro interno ao consultar perguntas'}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

    if not modo_visitante:
        pontuacoes_usuario = buscar_pontuacoes_usuario(id_usuario)
    else:
        pontuacoes_usuario = {}

    return jsonify({
        'perguntas': perguntas_por_dificuldade,
        'pontuacoes_usuario': pontuacoes_usuario
    })

@app.route("/login", methods=["GET","POST"])
def login():
    conn = cur = None
    try:
        if request.method == "POST":
            if not request.is_json:
                return jsonify(success=False, message="Content-Type deve ser application/json"), 415

            data = request.get_json()
            email = data.get("email")
            senha = data.get("senha")

            if not email or not senha:
                return jsonify(success=False, message="Email e senha são obrigatórios.")
            
            if not re.match(email_regex, email):
                return jsonify(success=False, message="Formato de e-mail inválido"), 400

            conn = get_db_connection()
            cur = conn.cursor()

            # Verifica usuário
            cur.execute("""
                SELECT id_usuario, senha_hash, nome, dicas_restantes, perguntas_restantes
                FROM usuarios_registrados WHERE email = %s
            """, (email,))
            usuario = cur.fetchone()

            if not usuario:
                return jsonify(success=False, message="E-mail não registrado")

            id_usuario, senha_hash, nome_usuario, dicas_restantes, perguntas_restantes = usuario
            session["id_usuario"] = id_usuario
            session["email"] = email
            session["visitante"] = False

            if not check_password_hash(senha_hash, senha):
                return jsonify(success=False, message="Senha incorreta")

            # Atualiza o horário da última sessão do usuário
            cur.execute("""
              UPDATE usuarios_registrados
              SET ultima_sessao = date_trunc('second', NOW() AT TIME ZONE 'America/Sao_Paulo') WHERE id_usuario = %s""", (id_usuario,))

            # 🔒 Invalida sessões antigas
            cur.execute("UPDATE sessoes SET ativo = FALSE WHERE id_usuario = %s", (id_usuario,))

            # 🔑 Cria nova sessão/token
            token = secrets.token_urlsafe(64)
            expira_em = datetime.utcnow() + timedelta(hours=6)

            cur.execute("""
                INSERT INTO sessoes (id_usuario, token, expira_em, ativo)
                VALUES (%s, %s, %s, TRUE)
            """, (id_usuario, token, expira_em))

            # Continua sua lógica de ranking/pontuação
            cur.execute("SELECT tema FROM pontuacoes_usuarios WHERE id_usuario = %s", (id_usuario,))
            temas_ja_registrados = {row[0].strip().lower() for row in cur.fetchall()}
            temas_normalizados = {tema.strip().lower(): tema for tema in temas_disponiveis}
            temas_faltantes = [nome_original for chave, nome_original in temas_normalizados.items() if chave not in temas_ja_registrados]

            for tema in temas_faltantes:
                cur.execute("INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao) VALUES (%s, %s, %s)", (id_usuario, tema, 0))
            conn.commit()

        else:
            return render_template("login.html")

    except Exception:
        if conn: conn.rollback()
        app.logger.error("Erro no login:\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro interno no servidor"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

    # 🔑 Retorna JSON e define cookie HttpOnly
    resp = make_response(jsonify(
        success=True,
        message="Login realizado com sucesso",
        token=token,
        dicas_restantes=dicas_restantes,
        perguntas_restantes=perguntas_restantes,
        nome_usuario=nome_usuario,
    ), 200)

    # Cookie HttpOnly, expirando junto com o token
    resp.set_cookie(
        "token_sessao",
        token,
        httponly=True,
        secure=False,       # mudar para True se usar HTTPS
        samesite="Lax",
        max_age=6*3600      # 6 horas em segundos
    )

    return resp

@app.route("/log/visitante", methods=["POST"])
def log_visitante():
    """return jsonify({"status": "ok"}), 200"""
    dados = request.get_json()
    evento = dados.get("evento")
    tema = dados.get("tema")
    tipo_pergunta = dados.get("tipo_pergunta")
    id_pergunta = dados.get("id_pergunta")
    resposta_enviada = dados.get("resposta_enviada")
    acertou = dados.get("acertou")
    tempo_gasto = dados.get("tempo_gasto")
    id_visitante = session["id_visitante"]
    usou_dica = dados.get("usou_dica")
    modo_tela = dados.get("modo_tela_usuario")
    pontos_ganhos = dados.get("pontos_ganhos")
    pontos_usuario = dados.get("pontos_usuario")

    if evento not in (
        "Pergunta respondida"
    ):
        return jsonify({"erro": "tipo_registro inválido"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO acesso_modo_visitante (
            evento,
            tema,
            tipo_pergunta,
            id_pergunta,
            resposta_enviada,
            acertou,
            tempo_gasto,
            id_visitante,
            usou_dica,
            pontos_ganhos,
            pontos_usuario,
            modo_tela
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        evento,
        tema,
        tipo_pergunta,
        id_pergunta,
        resposta_enviada,
        acertou,
        tempo_gasto,
        id_visitante,
        usou_dica,
        pontos_ganhos,
        pontos_usuario,
        modo_tela
    ))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"status": "ok"}), 200

@app.route("/reenviar-email-confirmacao", methods=["POST"])
def reenviar_email_confirmacao_route():
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Identifica o usuário
        id_usuario = session.get("id_usuario")
        cur.execute("""
            SELECT nome, email
            FROM usuarios_registrados
            WHERE id_usuario = %s
        """, (id_usuario,))
        usuario = cur.fetchone()

        if not usuario:
            return jsonify(success=False, message="Usuário não encontrado"), 404

        nome_usuario, email = usuario

        # 🔑 Gera novo token
        token = secrets.token_urlsafe(32)
        expiracao = datetime.now(pytz.timezone("America/Sao_Paulo")) + timedelta(hours=24)

        # 🔄 Atualiza token e expiração
        cur.execute("""
            UPDATE usuarios_registrados
            SET token_confirmacao = %s,
                expiracao_token_confirmacao = date_trunc('second', %s)
            WHERE id_usuario = %s
        """, (token, expiracao, id_usuario))

        conn.commit()

        link_confirmacao = f"{base_url}/confirmar_email?token={token}"
        enviado = enviar_email_confirmacao(email, nome_usuario, link_confirmacao)

        if not enviado:
            return jsonify(success=False, message="Falha ao enviar o e-mail")

        return jsonify(success=True)

    except Exception:
        if conn: conn.rollback()
        app.logger.error("Erro ao reenviar confirmação:\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro interno no servidor"), 500

    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/reset_senha", methods=["GET", "POST"])
def reset_senha():
    token = request.args.get("token") if request.method == "GET" else request.form.get("token")
    if not token:
        return render_template("mensagem.html", titulo="Erro", mensagem="Token ausente.")

    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Busca usuário com token válido
        cur.execute("""
            SELECT id_usuario, expiracao_token_recuperacao
            FROM usuarios_registrados
            WHERE token_recuperacao = %s
        """, (token,))
        usuario = cur.fetchone()

        if not usuario:
            return render_template("mensagem.html", titulo="Erro", mensagem="Token inválido.")

        id_usuario, expira = usuario

        if not expira or expira < datetime.utcnow():
            return render_template("mensagem.html", titulo="Token expirado", mensagem="O token de recuperação expirou.")
        
        if request.method == "POST":
            # Recebe novas senhas
            nova_senha = request.form.get("senha", "").strip()
            confirmar_senha = request.form.get("confirmar_senha", "").strip()

            if not nova_senha or not confirmar_senha:
                return render_template("reset_senha.html", token=token, erro="Preencha ambos os campos.")
            if nova_senha != confirmar_senha:
                return render_template("reset_senha.html", token=token, erro="As senhas não coincidem.")

            # Hash da nova senha
            senha_hash = generate_password_hash(nova_senha)

            # Atualiza senha e remove token
            cur.execute("""
                UPDATE usuarios_registrados
                SET senha_hash = %s,
                    token_recuperacao = NULL,
                    expiracao_token_recuperacao = NULL
                WHERE id_usuario = %s
            """, (senha_hash, id_usuario))
            conn.commit()

            return render_template("mensagem.html", titulo="Sucesso", mensagem="Senha redefinida com sucesso! Agora você pode fazer login.")

        # GET: exibe formulário
        return render_template("reset_senha.html", token=token)

    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception(f"Erro reset_senha:")
        return render_template("mensagem.html", titulo="Erro", mensagem="Erro ao redefinir a senha. Tente novamente.")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/politica-de-privacidade")
def politica_privacidade():
    session['from_login'] = False
    registrar_pagina_visitada("Política de Privacidade")
    return render_template("privacy_policy.html")

@app.route("/termos-de-uso")
def termos_uso():
    session['from_login'] = False
    registrar_pagina_visitada("Termos de Uso")
    return render_template("termos_de_uso.html")

@app.route("/api/favoritos", methods=["POST"])
@token_required
def salvar_favoritos(user_id):
    data = request.get_json(force=True)

    tema = data.get("tema_atual")
    tipo_pergunta = data.get("tipo_pergunta")
    adicionar = set(map(int, data.get("adicionar", [])))
    remover   = set(map(int, data.get("remover", [])))

    if not tema or not tipo_pergunta:
        return jsonify({"success": False, "msg": "Parâmetros inválidos."}), 400

    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Remover apenas os IDs explicitamente enviados
        if remover:
            cur.execute("""
                DELETE FROM favoritos_usuarios
                WHERE id_usuario = %s
                  AND tipo_pergunta = %s
                  AND tema = %s
                  AND id_pergunta = ANY(%s)
            """, (user_id, tipo_pergunta, tema, list(remover)))

        # Inserir os IDs explicitamente enviados
        for id_pergunta in adicionar:
            cur.execute("""
                INSERT INTO favoritos_usuarios (id_usuario, id_pergunta, tipo_pergunta, tema)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (id_usuario, id_pergunta, tipo_pergunta) DO NOTHING
            """, (user_id, id_pergunta, tipo_pergunta, tema))

        conn.commit()
        return jsonify({"success": True, "msg": "Favoritos atualizados com sucesso."}), 200

    except Exception as e:
        if conn: conn.rollback()
        app.logger.exception("Erro ao salvar favoritos do usuário %s", user_id)
        return jsonify({"success": False, "msg": "Erro ao salvar favoritos."}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/sobre-o-app")
def sobre_app():
    session['from_login'] = False
    registrar_pagina_visitada("Sobre o App")
    return render_template("sobre_o_app.html")

@app.route("/pesquisa-avançada")
def pesquisa_avancada():
    return render_template("pesquisa_avancada.html")

@app.route("/pesquisar_perguntas", methods=["POST"])
def pesquisar_perguntas():
    data = request.get_json()
    tema = data.get("tema")
    palavras = data.get("palavras", [])

    conn = get_db_connection()
    cur = conn.cursor()

    resultados = []

    # -------- OBJETIVAS --------
    query_obj = """
    SELECT id_pergunta, tema, subtemas, enunciado,
        alternativa_a, alternativa_b, alternativa_c, alternativa_d,
        resposta_correta, dificuldade, status
    FROM perguntas_objetivas
    WHERE (tema = %s OR tema = 'Variedades')
    AND EXISTS (
        SELECT 1
        FROM unnest(%s::text[]) p
        WHERE
            unaccent(LOWER(enunciado)) LIKE unaccent('%%' || p || '%%')
            OR unaccent(LOWER(
                CASE resposta_correta
                    WHEN 'A' THEN alternativa_a
                    WHEN 'B' THEN alternativa_b
                    WHEN 'C' THEN alternativa_c
                    WHEN 'D' THEN alternativa_d
                END
            )) LIKE unaccent('%%' || p || '%%')
    )
    """

    cur.execute(query_obj, (tema, palavras))

    for row in cur.fetchall():

        # Mapeia letra -> texto
        alternativas = {
            "A": row[4],
            "B": row[5],
            "C": row[6],
            "D": row[7]
        }
        texto_correto = alternativas.get(row[8], "")

        resultados.append({
            "id_pergunta": row[0],
            "tipo": "Objetiva",
            "tema": row[1],
            "subtemas": row[2],
            "enunciado": row[3],
            "resposta": texto_correto,   # <<< AGORA ENVIA O TEXTO
            "dificuldade": row[9],
            "status": row[10]
        })

    # ================================
    #   2. PERGUNTAS DISCURSIVAS
    # ================================
    query_disc = """
    SELECT id_pergunta, tema, subtemas, enunciado, respostas_corretas, dificuldade, status
    FROM perguntas_discursivas
    WHERE (tema = %s OR tema = 'Variedades')
    AND EXISTS (
        SELECT 1
        FROM unnest(%s::text[]) p
        WHERE
            unaccent(LOWER(enunciado)) LIKE unaccent('%%' || p || '%%')
            OR unaccent(LOWER(respostas_corretas::text)) LIKE unaccent('%%' || p || '%%')
    )
    """

    cur.execute(query_disc, (tema, palavras))
    
    for row in cur.fetchall():
        id_p, tema, subtemas, enunciado, respostas, dif, status = row

        resultados.append({
            "id_pergunta": id_p,
            "tipo": "Discursiva",
            "tema": tema,
            "subtemas": subtemas,
            "enunciado": enunciado,
            "resposta": respostas,  # array do banco
            "dificuldade": dif,
            "status": status
        })

    cur.close()
    conn.close()

    return jsonify(resultados)

@app.route('/politica-de-privacidade-from-login')
def politica_privacidade_from_login():
    session['from_login'] = True
    registrar_pagina_visitada("Política de Privacidade (login)")
    return render_template('privacy_policy.html')

@app.route('/termos-de-uso-from-login')
def termos_uso_from_login():
    session['from_login'] = True
    registrar_pagina_visitada("Termos de Uso (login)")
    return render_template('termos_de_uso.html')

@app.route('/sobre-o-app-from-login')
def sobre_app_from_login():
    session['from_login'] = True
    registrar_pagina_visitada("Sobre o App (login)")
    return render_template('sobre_o_app.html')

@app.route("/quiz")
@token_required
def quiz(user_id):
    tema = request.args.get("tema", "Geral")
    nivel = request.args.get("nivel", "Médio")
    return render_template("quiz.html", tema=tema, nivel=nivel)

@app.route("/usar_dica", methods=["GET","POST"])
@token_required
def usar_dica(user_id):
    if "id_usuario" not in session:
        return jsonify(success=False, message="Usuário não autenticado."), 401

    id_usuario = session["id_usuario"]

    conn = get_db_connection()
    cur = conn.cursor()

    # Verifica se ainda tem dicas
    cur.execute("SELECT dicas_restantes FROM usuarios_registrados WHERE id_usuario = %s", (id_usuario,))
    row = cur.fetchone()

    if not row or row[0] <= 0:
        cur.close()
        conn.close()
        return jsonify(success=False, message="Você não possui mais dicas."), 400

    novas_dicas = row[0] - 1
    cur.execute(
        "UPDATE usuarios_registrados SET dicas_restantes = %s WHERE id_usuario = %s",
        (novas_dicas, id_usuario)
    )

    conn.commit()
    cur.close()
    conn.close()

    return jsonify(success=True, dicas_restantes=novas_dicas)

def buscar_pontuacoes_usuario(id_usuario):
    """Busca pontuações do usuário em cada tema de perguntas"""
    pontuacoes_usuario = {}
    conn = cur = None

    # Conexão com o servidor
    try:
        conn = get_db_connection()
        cur = conn.cursor()
    except Exception as e:
        app.logger.exception("Erro ao tentar conectar para buscar pontuações do usuário com id %s: %s", id_usuario, e)
        return pontuacoes_usuario
    
    # Busca das pontuações do usuário
    try:
        cur.execute(
            "SELECT tema, pontuacao FROM pontuacoes_usuarios WHERE id_usuario = %s",
            (id_usuario,)
        )
        pontuacoes_usuario = {tema: pontuacao for tema, pontuacao in cur.fetchall()}
    except Exception as e:
        app.logger.exception("Erro ao tentar obter pontuações do usuário %s", id_usuario)
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return pontuacoes_usuario

@app.route("/register", methods=["POST"])
def registrar():
    data = request.get_json()
    nome = data.get("nome")
    email = data.get("email")
    senha = data.get("senha")
    captcha_token = data.get("captcha_token")
    captcha_selecoes = list(map(int, data.get("captcha_selecoes", [])))

    if email in EMAILS_PROIBIDOS:
        return jsonify(success=False, message="E-mail inválido")

    # Validação do CAPTCHA
    if not captcha_token:
        return jsonify(success=False, message="CAPTCHA token ausente"), 400

    dados_captcha = session.get(f"captcha_{captcha_token}")
    if not dados_captcha or time.time() > dados_captcha.get("expira", 0):
        return jsonify(success=False, message="CAPTCHA expirado ou inválido")

    if sorted(captcha_selecoes) != sorted(dados_captcha.get("corretos", [])):
        return jsonify(success=False, message="Seleções do CAPTCHA incorretas")

    # Invalida o CAPTCHA para evitar reutilização
    session.pop(f"captcha_{captcha_token}", None)

    # Gerar hash da senha e token de confirmação
    senha_hash = generate_password_hash(senha)
    token = gerar_token_confirmacao()

    # Agora atual (truncado para segundos)
    agora_sp = datetime.now(tz_sp).replace(microsecond=0)

    # Exemplo: expiração em 24 horas (21 horas porque fuso de São Paulo é -3)
    expiracao = agora_sp + timedelta(hours=21)
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Insere o novo usuário na tabela de usuários registrados
        cur.execute("""
            INSERT INTO usuarios_registrados (
                nome, email, senha_hash, email_confirmado,
                token_confirmacao, expiracao_token_confirmacao
            )
            VALUES (%s, %s, %s, FALSE, %s, %s)
            RETURNING id_usuario
        """, (nome, email, senha_hash, token, expiracao))

        id_usuario = cur.fetchone()[0]

        # Migra dados do modo visitante para a nova conta caso o usuário tenha marcado esta opção
        id_visitante = data.get("id_visitante")
        usar_dados_visitante = data.get("usar_dados_visitante", False)
        if id_visitante and usar_dados_visitante:
            cur.execute("""
                SELECT DISTINCT ON (id_pergunta)
                    id_pergunta, tipo_pergunta, tema, resposta_enviada, versao_pergunta, acertou, usou_dica, tempo_gasto, pontos_ganhos, pontos_usuario, criado_em
                FROM acesso_modo_visitante
                WHERE id_visitante = %s
                ORDER BY id_pergunta, criado_em ASC
            """, (id_visitante,))
            
            respostas = cur.fetchall()

            for id_pergunta, tipo_pergunta, tema, resposta_enviada, versao_pergunta, acertou, usou_dica, tempo_gasto, pontos_ganhos, pontos_usuario, criado_em in respostas:
                tipo_pergunta = tipo_pergunta.capitalize()
                cur.execute("""
                    INSERT INTO respostas_usuarios (
                        id_usuario, id_pergunta, tipo_pergunta, tema, resposta_usuario, versao_pergunta, acertou, usou_dica, tempo_gasto, pontos_ganhos, pontos_usuario, data_resposta, dados_migrados
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id_usuario, id_pergunta, tipo_pergunta) DO NOTHING
                """, (id_usuario, id_pergunta, tipo_pergunta, tema, resposta_enviada, versao_pergunta, acertou, usou_dica, tempo_gasto, pontos_ganhos, pontos_usuario, criado_em, True))

            # Limpeza das respostas do usuario no modo visitante
            cur.execute("""
                DELETE FROM acesso_modo_visitante WHERE id_visitante = %s
            """, (id_visitante,))

            # Transferência de avaliações do usuário
            cur.execute("""
                UPDATE feedbacks
                SET id_usuario = %s,
                id_visitante = NULL
                WHERE id_visitante = %s
            """, (id_usuario, id_visitante))

        conn.commit()
    except Exception:
        conn.rollback()
        app.logger.error("Erro ao tentar registrar nova conta\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro interno no registro"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()
    
    link_confirmacao = f"{base_url}/confirmar_email?token={token}"
    """enviar_email_confirmacao(email, nome, link_confirmacao)"""
    """
    return jsonify(success=True, message="Registro realizado! Verifique seu e-mail para confirmar")
    """
    return jsonify(success=True, message="Registro realizado!")

@app.route("/registrar_resposta", methods=["POST"])
@token_required
def registrar_resposta(user_id):
    dados = request.get_json()
    dados["tipo_pergunta"] = dados["tipo_pergunta"].capitalize()
    id_usuario = session.get("id_usuario")
    if not id_usuario:
        return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"})
    conn = cur = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Registra a resposta do usuário
            cur.execute("""
                INSERT INTO respostas_usuarios (
                    id_usuario, id_pergunta, tipo_pergunta, versao_pergunta, resposta_usuario,
                    acertou, usou_dica, pontos_ganhos, tempo_gasto, pontos_usuario, tema, dados_migrados
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_usuario,
                dados["id_pergunta"],
                dados["tipo_pergunta"],
                dados["versao_pergunta"],
                dados["resposta_usuario"],
                dados["acertou"],
                dados.get("usou_dica", False),
                dados["pontos_ganhos"],
                dados["tempo_gasto"],
                dados["pontos_usuario"],
                dados["tema"],
                False
            ))
            # Atualiza a pontuação do usuário
            cur.execute("""
                INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao)
                VALUES (%s, %s, %s)
                ON CONFLICT (id_usuario, tema)
                DO UPDATE SET pontuacao = pontuacoes_usuarios.pontuacao + EXCLUDED.pontuacao
                RETURNING pontuacao
            """, (id_usuario, dados["tema"], dados["pontos_ganhos"]))
            nova_pontuacao = cur.fetchone()[0]

            # Atualiza a quantidade de perguntas restantes do usuário
            if dados["tipo_pergunta"] == "Objetiva":
                cur.execute("""
                    UPDATE usuarios_registrados
                    SET
                        perguntas_restantes = GREATEST(perguntas_restantes - 1, 0)
                    WHERE id_usuario = %s
                    RETURNING perguntas_restantes, dicas_restantes
                """, (id_usuario,))
            else:
                cur.execute("""
                    UPDATE usuarios_registrados
                    SET
                        perguntas_restantes = GREATEST(perguntas_restantes - 1, 0),

                        dicas_restantes = CASE
                            WHEN discursivas_respondidas + 1 >= 10
                                THEN LEAST(dicas_restantes + 1, 20)
                            ELSE dicas_restantes
                        END,

                        discursivas_respondidas = CASE
                            WHEN discursivas_respondidas + 1 >= 10 THEN 0
                            ELSE discursivas_respondidas + 1
                        END

                    WHERE id_usuario = %s
                    RETURNING perguntas_restantes, dicas_restantes
                """, (id_usuario,))

            perguntas_restantes, dicas_restantes = cur.fetchone()
            conn.commit()

            return jsonify({
                "sucesso": True,
                "nova_pontuacao": nova_pontuacao,
                "perguntas_restantes": perguntas_restantes,
                "dicas_restantes": dicas_restantes
            })
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("Erro ao tentar registrar pergunta com id %s perguntas para o usuário com id %s", dados["id_pergunta"], id_usuario)
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/api/registrar_visitante", methods=["POST"])
def registrar_visitante():
    data = request.get_json()
    id_visitante = data.get("id_visitante")

    if id_visitante:
        session["id_visitante"] = id_visitante

    return jsonify({"ok": True})


if not database_url:
    if __name__ == '__main__':
        app.run(debug=True)
