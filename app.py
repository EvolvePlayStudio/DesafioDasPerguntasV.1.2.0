from flask import Flask, jsonify, render_template, request, session, redirect, flash, send_file
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

app = Flask(__name__, static_folder='static', template_folder='templates')
# Para fazer depuração na render
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
temas_disponiveis = ["Biologia", "Esportes", "História"]
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

# Função para iniciar o scheduler
def iniciar_agendamento():
    scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")
    # Executa todo dia às 12:00
    scheduler.add_job(atualizar_perguntas_dicas, 'cron', hour=12, minute=0)
    scheduler.start()

iniciar_agendamento()

@app.route("/", methods=["GET"])
def index():
    return render_template("login.html")  # ou sua página inicial real

@app.route("/login", methods=["POST"])
def login():
    conn = cur = None
    try:
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

        # Verifica se o usuário existe
        cur.execute("SELECT id_usuario, senha_hash, email_confirmado, nome, plano, dicas_restantes, perguntas_restantes FROM usuarios_registrados WHERE email = %s", (email,))
        usuario = cur.fetchone()

        if not usuario:
            return jsonify(success=False, message="E-mail não registrado")

        id_usuario, senha_hash, email_confirmado, nome_usuario, plano, dicas_restantes, perguntas_restantes = usuario

        if not check_password_hash(senha_hash, senha):
            return jsonify(success=False, message="A senha está incorreta")

        if not email_confirmado:
            return jsonify(success=False, message="Você precisa confirmar seu e-mail antes de fazer login")

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

        # Pega as regras dos planos de assinatura
        cur.execute("SELECT * FROM regras_plano ORDER BY id")
        colunas = [desc[0] for desc in cur.description]  # nomes das colunas
        linhas_regras_plano = cur.fetchall()
        regras_plano = [dict(zip(colunas, linha)) for linha in linhas_regras_plano]

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
    except Exception:
        # Se a conexão existir, reverte transação
        if conn:
            conn.rollback()

        # Captura o stack trace completo
        tb = traceback.format_exc()

        # Registra no logger (que você já direcionou para stdout)
        app.logger.error("Erro no login:\n" + tb)

        # Retorna erro genérico para o cliente
        return jsonify(success=False, message="Erro interno no servidor, não foi possível fazer login"), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    return jsonify(
            success=True,
            message="Login realizado com sucesso",
            regras_pontuacao=regras_pontuacao,
            dicas_restantes=dicas_restantes,
            perguntas_restantes=perguntas_restantes,
            nome_usuario=nome_usuario,
            plano=plano, # Plano atual do usuário (Gratuito ou Premium)
            regras_plano=regras_plano
        ), 200

def checar_dados_registro(nome, email, senha, token_recebido):
    if not nome or not email or not senha:
        return False, "Preencha todos os campos"

    if not re.match(email_regex, email):
        return False, "E-mail inválido"

    dominio = email.split("@")[-1].lower()

    if dominio in dominios_descartaveis:
        return False, "Domínio de e-mail temporário não é permitido"

    if dominio not in dominios_permitidos:
        return False, "O provedor de e-mail fornecido não é confiável"

    # Validação do token de convite
    if token_recebido != invite_token:
        return False, "Token de convite inválido"

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
    ok, msg = checar_dados_registro(data.get("nome"), data.get("email"), data.get("senha"), data.get("invite_token"))
    if not ok:
        return jsonify(success=False, message=msg)

    return jsonify(success=True, message="Validação OK")

@app.route("/register", methods=["POST"])
def registrar():
    data = request.get_json()
    nome = data.get("nome")
    email = data.get("email")
    senha = data.get("senha")
    captcha_token = data.get("captcha_token")
    captcha_selecoes = list(map(int, data.get("captcha_selecoes", [])))

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
    expiracao = datetime.utcnow() + timedelta(hours=24)

    conn = get_db_connection()
    cur = conn.cursor()
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

    return jsonify(success=True, message="Registro realizado! Verifique seu e-mail para confirmar")

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
    hours = int(offset.total_seconds() // 3600)
    return dt.strftime("%H:%M")

@app.route('/verificar_bloqueio')
def verificar_bloqueio():
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
        return True
    except Exception as e:
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
            # Registra a resposta do usuário
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
            """
            nova_pontuacao_usuario = Math.max(0, (pontuacoes_usuario[tema_atual] || 0) + pontos_ganhos);"""
            # ATENÇÃO: AQUI É NECESSÁRIO TRATAR OS CASOS DE PONTOS ABAIXO DE 0 E ACIMA DO MÁXIMO PERMITIDO NO RANKING LENDA
            cur.execute("""
                INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao)
                VALUES (%s, %s, %s)
                ON CONFLICT (id_usuario, tema)
                DO UPDATE SET pontuacao = pontuacoes_usuarios.pontuacao + EXCLUDED.pontuacao
                RETURNING pontuacao
            """, (id_usuario, dados["tema"], dados["pontos_ganhos"]))
            nova_pontuacao = cur.fetchone()[0]

            # Atualiza a quantidade de perguntas restantes do usuário
            cur.execute("""
                SELECT perguntas_restantes FROM usuarios_registrados WHERE id_usuario = %s
                """, (id_usuario,))
            perguntas_restantes = cur.fetchone()[0]
            nova_perguntas_restantes = max(0, perguntas_restantes - 1)
            cur.execute("""
                UPDATE usuarios_registrados SET perguntas_restantes = %s WHERE id_usuario = %s
            """, (nova_perguntas_restantes, id_usuario))

            conn.commit()
            return jsonify({"sucesso": True, "nova_pontuacao": nova_pontuacao, "perguntas_restantes": nova_perguntas_restantes})

    except Exception as e:
        return jsonify({"sucesso": False, "mensagem": "Erro interno"})

if not database_url:
    if __name__ == '__main__':
        app.run(debug=True)
