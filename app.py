from flask import Flask, jsonify, render_template, request, session, redirect, flash
from werkzeug.security import generate_password_hash, check_password_hash
import psycopg2
from utils import *
from datetime import datetime, timedelta
import secrets
import smtplib
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import os
import logging
from logging.handlers import RotatingFileHandler
import re

app = Flask(__name__, static_folder='static', template_folder='templates')
# Para fazer depuração na render
if not app.debug:
    handler = RotatingFileHandler('error.log', maxBytes=100000, backupCount=3)
    handler.setLevel(logging.ERROR)
    formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
    handler.setFormatter(formatter)
    app.logger.addHandler(handler)
temas_disponiveis = ["Biologia", "Esportes", "História"]
app.secret_key = os.getenv("SECRET_KEY")
invite_token = os.getenv("TOKEN_CONVITE")

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", 5432),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        sslmode=os.getenv("DB_SSLMODE", "require")
    )

@app.route("/", methods=["GET"])
def index():
    return render_template("login.html")  # ou sua página inicial real

@app.route("/login", methods=["POST"])
def login():
    conn = cur = None
    try:
        if not request.is_json:
            return jsonify(success=False, message="Content-Type deve ser application/json."), 415

        data = request.get_json()
        email = data.get("email")
        senha = data.get("senha")

        if not email or not senha:
            return jsonify(success=False, message="Email e senha são obrigatórios.")
        
        EMAIL_REGEX = r"[^@]+@[^@]+\.[^@]+"
        if not re.match(EMAIL_REGEX, email):
            return jsonify(success=False, message="Formato de e-mail inválido."), 400

        conn = get_db_connection()
        cur = conn.cursor()

        # Verifica se o usuário existe
        cur.execute("SELECT id_usuario, senha_hash, email_confirmado, dicas_restantes, perguntas_restantes FROM usuarios_registrados WHERE email = %s", (email,))
        usuario = cur.fetchone()

        if not usuario:
            return jsonify(success=False, message="E-mail não registrado.")

        id_usuario, senha_hash, email_confirmado, dicas_restantes, perguntas_restantes = usuario

        if not check_password_hash(senha_hash, senha):
            return jsonify(success=False, message="Senha incorreta.")

        if not email_confirmado:
            return jsonify(success=False, message="Você precisa confirmar seu e-mail antes de fazer login.")

        # Define sessão
        session["id_usuario"] = id_usuario
        session["email"] = email

        # Busca as pontuações atuais do usuário
        cur.execute(
            "SELECT tema FROM pontuacoes_usuarios WHERE id_usuario = %s",
            (id_usuario,)
        )
        temas_ja_registrados = {row[0].strip().lower() for row in cur.fetchall()}

        # Normaliza os temas disponíveis (garante consistência de capitalização e espaços)
        temas_normalizados = {tema.strip().lower(): tema for tema in temas_disponiveis}

        # Descobre quais rankings estão faltando
        temas_faltantes = [
            nome_original for chave, nome_original in temas_normalizados.items()
            if chave not in temas_ja_registrados
        ]

        for tema in temas_faltantes:
            cur.execute(
                "INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao) VALUES (%s, %s, %s)",
                (id_usuario, tema, 0)
            )

        # Pega as regras de pontuação para acertos, erros e uso de dicas da pergunta
        cur.execute("SELECT * FROM regras_pontuacao ORDER BY id_ranking")
        linhas = cur.fetchall()

        colunas = [desc[0] for desc in cur.description]
        conn.commit()
        # Transforma em lista de dicionários
        regras_pontuacao = []
        for linha in linhas:
            regra = dict(zip(colunas, linha))
            regras_pontuacao.append(regra)
    except Exception as e:
        if conn:
            conn.rollback()
            app.logger.error("Erro no login", exc_info=True)
            print("Erro no login", e)
        return jsonify(success=False, message="Erro interno no servidor."), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
    return jsonify(
            success=True,
            message="Login realizado com sucesso.",
            regras_pontuacao=regras_pontuacao,
            dicas_restantes=dicas_restantes,
            perguntas_restantes=perguntas_restantes
        ), 200
        

@app.route("/register", methods=["POST"])
def registrar():
    data = request.get_json()
    nome = data.get("nome")
    email = data.get("email")
    senha = data.get("senha")
    # A parte aabaixo será removida quando o app estiver em produção
    token_recebido = data.get("invite_token")
    if token_recebido != invite_token:
        flash("Token de convite inválido")
        return redirect("/register")
    
    if not nome or not email or not senha:
        return jsonify(success=False, message="Preencha todos os campos.")

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT id_usuario FROM usuarios_registrados WHERE email = %s", (email,))
    if cur.fetchone():
        return jsonify(success=False, message="E-mail já registrado.")

    senha_hash = generate_password_hash(senha)
    token = gerar_token_confirmacao()
    expiracao = datetime.utcnow() + timedelta(hours=24)

    cur.execute("""
        INSERT INTO usuarios_registrados (
            nome, email, senha_hash, email_confirmado,
            token_confirmacao, expiracao_token_confirmacao
        )
        VALUES (%s, %s, %s, FALSE, %s, %s)
    """, (nome, email, senha_hash, token, expiracao))
    conn.commit()
    cur.close()
    conn.close()

    link_confirmacao = f"{base_url}/confirmar_email?token={token}"
    enviar_email_confirmacao(email, nome, link_confirmacao)

    return jsonify(success=True, message="Registro realizado. Verifique seu e-mail para confirmar.")

@app.route('/confirmar_email')
def confirmar_email():
    token = request.args.get('token')

    if not token:
        return render_template('mensagem.html', titulo="Erro", mensagem="Token de confirmação ausente.")

    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Busca usuário com o token fornecido e ainda válido
        print(f"O token é: {token}")
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

        return render_template('mensagem.html', titulo="Sucesso", mensagem="E-mail confirmado com sucesso! Agora você pode fazer login.")
    
    except Exception as e:
        conn.rollback()
        return render_template('mensagem.html', titulo="Erro", mensagem="Erro ao confirmar o e-mail. Tente novamente mais tarde.")
    
    finally:
        cur.close()
        conn.close()

def gerar_token_confirmacao(tamanho=32):
    alfabeto = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alfabeto) for _ in range(tamanho))

def enviar_email_confirmacao(email_destinatario, nome_destinatario, link_confirmacao):
    remetente = email_remetente
    senha = senha_app
    porta = int(porta_email)

    assunto = "Confirmação de cadastro - Desafio das Perguntas"
    corpo = f"""
Olá, {nome_destinatario}!

Clique no link abaixo para confirmar seu cadastro:

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
        print(f"[INFO] E-mail enviado para {email_destinatario}")
        return True
    except Exception as e:
        print(f"[ERRO] Falha no envio de e-mail: {e}")
        return False

@app.route("/home")
def home():
    return render_template("home.html")

@app.route("/quiz")
def quiz():
    tema = request.args.get("tema", "Geral")
    nivel = request.args.get("nivel", "Médio")
    return render_template("quiz.html", tema=tema, nivel=nivel)

@app.route("/usar_dica", methods=["POST"])
def usar_dica():
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

@app.route("/enviar_feedback", methods=["POST"])
def enviar_feedback():
    data = request.get_json()

    id_pergunta = data.get("id_pergunta")
    tipo_pergunta = data.get("tipo_pergunta")
    email_usuario = data.get("email_usuario")
    estrelas = data.get("estrelas")
    versao_pergunta = data.get("versao_pergunta")
    id_usuario = data.get("id_usuario")

    if not all([id_pergunta, tipo_pergunta, email_usuario, estrelas, versao_pergunta, id_usuario]):
        return jsonify({"erro": "Dados incompletos"}), 400
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO feedbacks (id_pergunta, tipo_pergunta, email_usuario, estrelas, versao_pergunta, id_usuario)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id_pergunta, tipo_pergunta, id_usuario)
            DO UPDATE SET estrelas = EXCLUDED.estrelas, versao_pergunta = EXCLUDED.versao_pergunta, ultima_atualizacao = date_trunc('second', date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'));
        """, (id_pergunta, tipo_pergunta, email_usuario, estrelas, versao_pergunta, id_usuario))
        conn.commit()
        cur.close()
        return jsonify({"sucesso": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"erro": str(e)}), 500

def buscar_pontuacoes_usuario(id_usuario):
    """Busca pontuações do usuário em cada tema de perguntas"""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT tema, pontuacao FROM pontuacoes_usuarios WHERE id_usuario = %s",
        (id_usuario,)
    )
    pontuacoes_usuario = {tema: pontuacao for tema, pontuacao in cur.fetchall()}
    conn.close()
    return pontuacoes_usuario

@app.route('/api/perguntas', methods=['GET'])
def listar_perguntas():
    tema = request.args.get('tema')
    modo = request.args.get('modo', '').lower()
    tipo_pergunta = request.args.get('tipo_pergunta', 'Discursiva').capitalize()
    id_usuario = session.get('id_usuario')

    # Validações básicas
    if not tema or modo not in ('desafio', 'revisao'):
        return jsonify({'erro': 'Parâmetros inválidos ou ausentes'}), 400

    if not id_usuario:
        return jsonify({'erro': 'Usuário não autenticado'}), 401

    if tipo_pergunta == 'Discursiva':
        perguntas_por_dificuldade = listar_perguntas_discursivas(id_usuario, tema, modo)
    elif tipo_pergunta == 'Objetiva':
        perguntas_por_dificuldade = listar_perguntas_objetivas(id_usuario, tema, modo)  # ainda a implementar
    else:
        return jsonify({'erro': f'Tipo de pergunta "{tipo_pergunta}" não suportado'}), 400

    # Pontuações do usuário em cada tema (dicionário com chave para tema e pontuação no valor)
    pontuacoes_usuario = buscar_pontuacoes_usuario(id_usuario)

    return jsonify({
        'perguntas': perguntas_por_dificuldade,
        'pontuacoes_usuario': pontuacoes_usuario
                    })

def listar_perguntas_discursivas(id_usuario, tema, modo):
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT p.id_pergunta, p.enunciado, p.dica, p.nota, p.respostas_corretas,
               COALESCE(f.estrelas, NULL) AS estrelas,
               r.id_resposta IS NOT NULL AS respondida, p.dificuldade, p.versao
        FROM perguntas_discursivas p
        LEFT JOIN respostas_usuarios r
            ON p.id_pergunta = r.id_pergunta AND r.id_usuario = %s AND r.tipo_pergunta = 'Discursiva'
        LEFT JOIN feedbacks f
            ON p.id_pergunta = f.id_pergunta AND f.id_usuario = %s AND f.tipo_pergunta = 'Discursiva'
        WHERE p.tema = %s
    """

    cursor.execute(query, (id_usuario, id_usuario, tema))
    
    perguntas_por_dificuldade = {
        'Fácil': [],
        'Médio': [],
        'Difícil': []
    }

    for row in cursor.fetchall():
        try:
            if row[4]:
                respostas_corretas = [resp.strip() for resp in row[4]]
            else:
                respostas_corretas = []
        except Exception:
            respostas_corretas = []
        
        pergunta = {
            'id_pergunta': row[0],
            'enunciado': row[1],
            'dica': row[2],
            'nota': row[3],
            'respostas_corretas': respostas_corretas,
            'estrelas': row[5],
            'dificuldade': row[7],
            'versao_pergunta': row[8]
        }

        respondida = row[6]

        if modo == 'desafio' and not respondida:
            perguntas_por_dificuldade.get(row[7], []).append(pergunta)
        elif modo == 'revisao' and respondida:
            perguntas_por_dificuldade.get(row[7], []).append(pergunta)

    conn.close()
    return perguntas_por_dificuldade

def listar_perguntas_objetivas(id_usuario, tema, modo):
    # Implementar depois com lógica específica para perguntas objetivas
    # Tabela perguntas_objetivas, respostas_objetivas, etc.
    pass

@app.route("/registrar_resposta", methods=["POST"])
def registrar_resposta():
    dados = request.get_json()
    id_usuario = session.get("id_usuario")
    if not id_usuario:
        return jsonify({"sucesso": False, "mensagem": "Usuário não autenticado"})
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO respostas_usuarios (
                    id_usuario, id_pergunta, tipo_pergunta, versao_pergunta, resposta_usuario,
                    acertou, usou_dica, pontos_ganhos, tempo_gasto
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_usuario,
                dados["id_pergunta"],
                dados["tipo_pergunta"],
                dados["versao_pergunta"],
                dados["resposta_usuario"],
                dados["acertou"],
                dados.get("usou_dica", False),
                dados["pontos_ganhos"],
                dados["tempo_gasto"]
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
            conn.commit()
            return jsonify({"sucesso": True, "nova_pontuacao": nova_pontuacao})

    except Exception as e:
        print("Erro ao registrar resposta:", e)
        return jsonify({"sucesso": False, "mensagem": "Erro interno"})

"""
if __name__ == '__main__':
    app.run(debug=True)"""