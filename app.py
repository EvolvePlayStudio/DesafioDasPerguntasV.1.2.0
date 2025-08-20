from flask import Flask, jsonify, render_template, request, session, redirect, flash, send_file, url_for
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

app = Flask(__name__, static_folder='static', template_folder='templates')
# Para fazer depuração na render
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)

temas_disponiveis = ["Astronomia", "Biologia", "Esportes", "Geografia", "História", "Mídia"]
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
        'tipo_str': 'Objetiva'
    }
}

scheduler = BackgroundScheduler(timezone="America/Sao_Paulo")

# Código copia e cola gerado pelo Nubank
codigo_pix = os.getenv("QR_CODE")
img = qrcode.make(codigo_pix)
img.save("static/qrcode.png")

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
        cur.execute("SELECT id_usuario, senha_hash, email_confirmado, nome, dicas_restantes, perguntas_restantes FROM usuarios_registrados WHERE email = %s", (email,))
        usuario = cur.fetchone()

        if not usuario:
            return jsonify(success=False, message="E-mail não registrado")

        id_usuario, senha_hash, email_confirmado, nome_usuario, dicas_restantes, perguntas_restantes = usuario

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
            nome_usuario=nome_usuario
        ), 200

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
    
    except Exception:
        if conn:
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
    except Exception:
        return False

@app.route("/home")
def home():
    return render_template("home.html")

@app.route("/doações")
def doacoes():
    chave_pix = os.getenv("CHAVE_PIX")
    return render_template("doacoes.html", chave_pix=chave_pix)

@app.route("/checkout/<metodo>/<int:plano_id>")
def checkout(metodo, plano_id):
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT plano, preco FROM regras_plano WHERE id = %s", (plano_id,))
        plano = cur.fetchone()
        if not plano:
            return "Plano não encontrado", 404
        
        plano_nome, preco = plano

        if metodo == "cartao":
            checkout_url = f"https://provedor.com/checkout?plano={plano_id}&metodo=cartao"
            checkout_url = f"https://www.mercadopago.com.br/developers/pt/guides/checkout"
        elif metodo == "pix":
            checkout_url = f"https://provedor.com/checkout?plano={plano_id}&metodo=pix"
            checkout_url = f"https://dev.pagseguro.uol.com.br/docs/checkout"
        elif metodo == "boleto":
            checkout_url = f"https://provedor.com/checkout?plano={plano_id}&metodo=boleto"
            checkout_url = f"https://docs.pagar.me/"
        else:
            return "Método de pagamento inválido", 400

        return redirect(checkout_url)

    except Exception:
        app.logger.exception("Erro ao iniciar checkout:")
        return "Erro interno", 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/premium")
def premium():
    return render_template("premium.html")

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
        if cur:
            cur.close()
        if conn:
            conn.close()

    # Retorna mensagem padrão sempre, mesmo que o e-mail não exista
    return jsonify(success=True, message=mensagem_padrao)

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
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.route("/politica-de-privacidade")
def politica_privacidade():
    return render_template("privacy_policy.html")

@app.route("/termos-de-uso")
def termos_uso():
    return render_template("termos_de_uso.html")

@app.route("/sobre-o-app")
def sobre_app():
    return render_template("sobre_o_app.html")

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
    tipo_pergunta = data.get("tipo_pergunta").capitalize()
    email_usuario = session.get("email")
    estrelas = data.get("estrelas")
    versao_pergunta = data.get("versao_pergunta")
    id_usuario = session.get("id_usuario")

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
        if conn:
            conn.rollback()
        return jsonify({"erro": str(e)}), 500

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
        if cur:
            cur.close()
        if conn:
            conn.close()

    return pontuacoes_usuario

@app.route('/api/perguntas', methods=['GET'])
def listar_perguntas():
    """
    Retorna perguntas agrupadas por dificuldade conforme tipo (discursiva/objetiva) e modo (desafio/revisao).
    Retorna também as pontuações atuais do usuário em cada tema.
    """
    # parâmetros de query
    tema = request.args.get('tema')
    modo = (request.args.get('modo') or '').lower()
    tipo_pergunta = (request.args.get('tipo-de-pergunta') or '').lower()
    id_usuario = session.get('id_usuario')

    # configurações locais
    limit = 90
    privileged_ids = (4, 6, 16)  # ids com permissão para ver perguntas inativas

    # validações
    if not tema or modo not in ('desafio', 'revisao') or tipo_pergunta not in ('objetiva', 'discursiva'):
        return jsonify({'erro': 'Parâmetros inválidos ou ausentes'}), 400
    if not id_usuario:
        return jsonify({'erro': 'Usuário não autenticado'}), 401
    
    cfg = QUESTION_CONFIG.get(tipo_pergunta)
    if not cfg:
        return jsonify({'erro': 'Tipo de pergunta inválido'}), 400
    
    # Conexão com servidor
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
    except Exception:
        app.logger.exception("Erro ao tentar conectar para buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro ao tentar conectar para buscar novas perguntas'}), 500
    
    # Busca das perguntas
    try:
        is_privileged = int(id_usuario) in privileged_ids

        select_clause = ",\n".join(cfg['select_cols'])
        tipo_str = cfg['tipo_str']   # usado para filtrar feedbacks/respostas
        table = cfg['table']         # nome da tabela — vindo do cfg interno (seguro)

        where_status = "p.status != 'Deletada'" if is_privileged else "p.status = 'Ativa'"

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
            dificuldade = row.get('dificuldade') or 'Médio'  # se por algum motivo for nulo, evita KeyError
            respondida = bool(row.get('respondida'))

            sb = row.get('subtemas') or []
            try:
                subtemas = [s.strip() if isinstance(s, str) else s for s in sb]
            except Exception:
                app.logger.exception("Erro ao tentar listar subtemas do usuário com id %s para a pergunta com id %s", id_usuario, row['id_pergunta'])
                subtemas = list(sb)

            if tipo_pergunta == 'discursiva':
                rc = row.get('respostas_corretas') or []
                # garante que cada resposta seja string "trimmed" quando aplicável
                try:
                    respostas_corretas = [r.strip() if isinstance(r, str) else r for r in rc]
                except Exception:
                    respostas_corretas = list(rc)

                item = {
                    'id_pergunta': row['id_pergunta'],
                    'enunciado': row['enunciado'],
                    'subtemas': subtemas,
                    'respostas_corretas': respostas_corretas,
                    'dica': row.get('dica'),
                    'nota': row.get('nota'),
                    'dificuldade': dificuldade,
                    'versao_pergunta': row.get('versao'),
                    'estrelas': row.get('estrelas'),
                }

            else:  # objetiva
                item = {
                    'id_pergunta': row['id_pergunta'],
                    'enunciado': row['enunciado'],
                    'subtemas': subtemas,
                    'alternativa_a': row.get('alternativa_a'),
                    'alternativa_b': row.get('alternativa_b'),
                    'alternativa_c': row.get('alternativa_c'),
                    'alternativa_d': row.get('alternativa_d'),
                    'resposta_correta': row.get('resposta_correta'),
                    'nota': row.get('nota'),
                    'dificuldade': dificuldade,
                    'versao_pergunta': row.get('versao'),
                    'estrelas': row.get('estrelas')
                }

            # filtra por modo
            if modo == 'desafio' and not respondida:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
            elif modo == 'revisao' and respondida:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
    except Exception:
        app.logger.exception("Erro ao buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro interno ao consultar perguntas'}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

    pontuacoes_usuario = buscar_pontuacoes_usuario(id_usuario)

    return jsonify({
        'perguntas': perguntas_por_dificuldade,
        'pontuacoes_usuario': pontuacoes_usuario
    })

@app.route("/registrar_resposta", methods=["POST"])
def registrar_resposta():
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

    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("Erro ao tentar registrar pergunta com id %s perguntas para o usuário com id %s", dados["id_pergunta"], id_usuario)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if not database_url:
    if __name__ == '__main__':
        app.run(debug=True)
