from flask import Flask, jsonify, render_template, request, session, redirect, send_file, url_for, make_response, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash
from utils import *
import secrets
import string
from email_service import enviar_email_confirmacao, enviar_email_recuperacao, enviar_email_feedback_pergunta, enviar_email_feedback_site
from datetime import datetime, timedelta # timedelta também é importado no utils
import re
import logging
import sys
import traceback
import random, string, time
from PIL import Image, ImageEnhance, ImageFilter
from io import BytesIO
import urllib.parse
import qrcode
from functools import wraps
from psycopg2.extras import RealDictCursor
from db import *

app = Flask(__name__, static_folder='static', template_folder='templates')
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('[%(asctime)s] %(levelname)s in %(module)s: %(message)s')
handler.setFormatter(formatter)
app.logger.addHandler(handler)
app.secret_key = os.getenv("SECRET_KEY")
invite_token = os.getenv("TOKEN_CONVITE")

SITE_EM_MANUTENCAO = False
id_visitante_admin = "605720b7-c72f-4b18-9b73-c3615bfce897"

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
        conn = cur = None
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

@app.route("/alterar-email", methods=["POST"])
def alterar_email_route():
    conn = cur = None
    try:
        data = request.get_json()
        novo_email = data.get("email").strip().lower()

        if not novo_email:
            return jsonify(success=False, message="E-mail inválido"), 400

        if not email_dominio_valido(novo_email):
            return jsonify(success=False, message="Domínio de e-mail não permitido"), 400

        id_usuario = session.get("id_usuario")
        if not id_usuario:
            return jsonify(success=False, message="Não autenticado"), 401

        conn = get_db_connection()
        cur = conn.cursor()

        # Busca nome do usuário
        cur.execute("""
            SELECT nome
            FROM usuarios_registrados
            WHERE id_usuario = %s
        """, (id_usuario,))
        row = cur.fetchone()

        if not row:
            return jsonify(success=False, message="Usuário não encontrado"), 404

        nome_usuario = row[0]

        # Verifica se e-mail já está em uso
        cur.execute("""
            SELECT 1 FROM usuarios_registrados
            WHERE email = %s
              AND id_usuario <> %s
        """, (novo_email, id_usuario))

        if cur.fetchone():
            return jsonify(success=False, message="E-mail já está em uso"), 409

        # Gera novo token
        token = secrets.token_urlsafe(32)
        expiracao = datetime.now(tz_sp) + timedelta(hours=21)

        # Atualiza e-mail + estado de confirmação
        cur.execute("""
            UPDATE usuarios_registrados
            SET email = %s,
                email_confirmado = FALSE,
                token_confirmacao = %s,
                expiracao_token_confirmacao = date_trunc('second', %s)
            WHERE id_usuario = %s
        """, (novo_email, token, expiracao, id_usuario))

        conn.commit()

        link_confirmacao = f"{base_url}/confirmar_email?token={token}"
        enviado = enviar_email_confirmacao(
            novo_email, nome_usuario, link_confirmacao
        )

        if not enviado:
            return jsonify(success=False, message="Falha ao enviar e-mail")

        return jsonify(success=True)

    except Exception:
        if conn: conn.rollback()
        app.logger.error("Erro ao alterar e-mail:\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro ao tentar alterar e-mail"), 500

    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/api/pontuacoes")
@token_required
def api_pontuacoes(user_id):
    pontuacoes = buscar_pontuacoes_usuario(user_id)
    return jsonify(pontuacoes)

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

def buscar_pontuacoes_usuario(id_usuario):
    """
    Busca pontuações do usuário para todos os temas ativos.
    Caso o usuário ainda não tenha pontuação em um tema, retorna 0.
    """
    pontuacoes_usuario = {}

    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                t.nome AS tema,
                COALESCE(p.pontuacao, 0) AS pontuacao
            FROM temas t
            LEFT JOIN pontuacoes_usuarios p
                ON p.tema = t.nome
               AND p.id_usuario = %s
            WHERE t.ativo = true
            ORDER BY t.nome
        """, (id_usuario,))

        pontuacoes_usuario = {
            tema: pontuacao
            for tema, pontuacao in cur.fetchall()
        }

    except Exception:
        app.logger.exception("Erro ao tentar obter pontuações do usuário %s", id_usuario)
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return pontuacoes_usuario

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
    tema = data.get("tema").lower().capitalize()
    estrelas = data.get("estrelas")
    if estrelas not in (1, 2, 3, 4, 5):
        estrelas = None
    versao_pergunta = data.get("versao_pergunta")
    comentario = data.get("comentario")
    dificuldade = data.get("dificuldade").lower().capitalize()
    aprovacao_nota = data.get("aprovacao_nota")

    id_usuario = session.get("id_usuario")
    id_visitante = session.get("id_visitante")
    modo_visitante = session.get("visitante")

    if modo_visitante:
        if not all([data.get("id_pergunta"), data.get("versao_pergunta"), id_visitante]):
            return jsonify({"erro": "Dados incompletos como visitante"}), 400
    else:
        if not all([data.get("id_pergunta"), data.get("tema"), data.get("versao_pergunta"), id_usuario]):
            return jsonify({"erro": "Dados incompletos como usuário cadastrado"}), 400
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Feedbacks de estrelas
        id_feedback = None
        if data['atualizar_feedback_estrelas']:
            if modo_visitante:
                cur.execute("""
                    INSERT INTO feedbacks (id_pergunta, tema, estrelas, versao_pergunta, id_visitante, modo_visitante, comentario, dificuldade)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id_pergunta, versao_pergunta, id_visitante)
                    DO UPDATE SET estrelas = EXCLUDED.estrelas, versao_pergunta = EXCLUDED.versao_pergunta, modo_visitante = EXCLUDED.modo_visitante, comentario = EXCLUDED.comentario, ultima_atualizacao = date_trunc('second', date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'))
                    RETURNING id_feedback;
                """, (id_pergunta, tema, estrelas, versao_pergunta, id_visitante, modo_visitante, comentario, dificuldade))
            else:
                cur.execute("""
                    INSERT INTO feedbacks (id_pergunta, tema, estrelas, versao_pergunta, id_usuario, modo_visitante, comentario, dificuldade)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id_pergunta, versao_pergunta, id_usuario)
                    DO UPDATE SET estrelas = EXCLUDED.estrelas, versao_pergunta = EXCLUDED.versao_pergunta, modo_visitante = EXCLUDED.modo_visitante, comentario = EXCLUDED.comentario, ultima_atualizacao = date_trunc('second', date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo'))
                    RETURNING id_feedback;
                """, (id_pergunta, tema, estrelas, versao_pergunta, id_usuario, modo_visitante, comentario, dificuldade))
            id_feedback = cur.fetchone()[0]
        # Feedback para a nota da pergunta
        if data["atualizar_feedback_nota"]:
            if modo_visitante:
                cur.execute("""
                    INSERT INTO feedbacks_notas (id_pergunta, id_visitante, versao, positivo)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id_pergunta, id_visitante, versao)
                    DO UPDATE SET positivo = EXCLUDED.positivo,
                                    versao = EXCLUDED.versao,
                                    ultima_atualizacao = date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
                """, (id_pergunta, id_visitante, versao_pergunta, aprovacao_nota))
            else:
                cur.execute("""
                    INSERT INTO feedbacks_notas (id_pergunta, id_usuario,
                                                    versao, positivo)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id_pergunta, id_usuario, versao)
                    DO UPDATE SET positivo = EXCLUDED.positivo,
                                    versao = EXCLUDED.versao,
                                    ultima_atualizacao = date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
                """, (id_pergunta, id_usuario, versao_pergunta, aprovacao_nota))
        conn.commit()

        # Notifica por e-mail o feedback enviado caso tenha comentário
        if comentario:
            try:
                enviar_email_feedback_pergunta(
                    id_feedback=id_feedback,
                    id_pergunta=id_pergunta,
                    tema = tema,
                    enunciado=data.get("enunciado"),
                    comentario=comentario,
                    estrelas=estrelas,
                    dificuldade=dificuldade,
                    modo_visitante=modo_visitante
                )
            except Exception:
                app.logger.warning("Falha ao enviar email de feedback da pergunta", exc_info=True)

        return jsonify({"sucesso": True})
    except Exception as e:
        if conn: conn.rollback()
        app.logger.exception("Erro ao salvar feedback da pergunta")
        return jsonify({"erro": str(e)}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/api/feedbacks/comentarios", methods=["POST"])
@token_required
def enviar_feedback_comentario(user_id):
    data = request.get_json()

    if not data:
        return jsonify({"erro": "Payload inválido"}), 400

    modo_visitante = session["visitante"]
    comentario = (data.get("comentario") or "").strip()
    tema = data.get("tema")
    feedback_id = data.get("feedback_id")
    pontuacao_saldo = data.get("pontuacao_saldo")
    print(f"Tema é {tema}")

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
                # UPDATE (caso o usuário edite um feedback já existente)
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

                # Envia o feedback feito para o e-mail do admin
                try:
                    enviar_email_feedback_site(
                        id_feedback=feedback_id,
                        tema=tema,
                        comentario=comentario,
                        pontuacao_saldo=pontuacao_saldo,
                        modo_visitante=modo_visitante
                    )
                except Exception:
                    app.logger.warning("Falha ao enviar email de feedback do site",exc_info=True)

                return jsonify({
                    "sucesso": True,
                    "id_feedback": novo_id,
                    "editado": False
                }), 201

    except Exception as e:
        app.logger.exception("Erro ao salvar feedback")
        return jsonify({
            "erro": "Erro interno",
            "detalhe": str(e)
        }), 500

def email_dominio_valido(email: str) -> bool:
    if not email or "@" not in email:
        return False

    dominio = email.split("@")[-1].lower()

    if dominio in dominios_descartaveis:
        return False

    if dominio not in dominios_permitidos:
        return False

    return True

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

@app.route("/", methods=["GET"])
def index():
    return render_template("login.html")

@app.route("/pagina_destino", methods=["POST"])
def pagina_destino():
    data = request.get_json(silent=True) or {}
    session["pagina_destino"] = data.get("pagina_destino", None)
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
    return dt.strftime("%H:%M")

@app.route('/acesso/registro', methods=['POST'])
def registrar_acesso_aba_registro():
    pagina = session.get("pagina_destino", None) 
    registrar_pagina_visitada(pagina)
    return jsonify({ "ok": True })

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

    try:
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
    except Exception:
        if conn: conn.rollback()
        app.logger.exception("Não foi possível registrar o erro")
    finally:
        if cur: cur.close()
        if conn: conn.close()
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
    id_usuario = session["id_usuario"]

    if not id_usuario or not tema:
        return jsonify({"error": "Parâmetros inválidos"}), 400

    conn = cur = None
    try:        
        conn = get_db_connection()
        cur = conn.cursor()

        query = """
            SELECT id_pergunta
            FROM favoritos_usuarios
            WHERE id_usuario = %s AND tema = %s
        """
        cur.execute(query, (id_usuario, tema))
        favoritos = [row[0] for row in cur.fetchall()]
    except Exception:
        app.logger.exception("Erro ao carregar favoritos do usuário com id %s", id_usuario)
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return jsonify({"favoritos": favoritos})

@app.route("/recuperação-de-senha", methods=["POST"])
def esqueci_senha():
    data = request.get_json()
    email = data.get("email", "").strip()

    # Mensagem padrão
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
            
            # Construir link de recuperação
            link_recuperacao = url_for('reset_senha', token=token, _external=True)

            # Montar mensagem
            conteudo_email = f"""
            Olá {usuario[1]},

            Recebemos uma solicitação para redefinir sua senha.
            Clique no link abaixo para criar uma nova senha:

            {link_recuperacao}

            Se você não solicitou a recuperação de senha, ignore esta mensagem.
            """

            # Enviar email
            try:
                enviar_email_recuperacao(email, "Recuperação de Senha - Desafio das Perguntas", conteudo_email)
            except Exception:
                app.logger.error("Erro ao enviar email")
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

@app.route("/pegar_email_confirmado", methods=["GET"])
def pegar_email_confirmado():
    return jsonify({
        'email_usuario': session["email"],
        'email_confirmado': session["email_confirmado"]
    })

@app.route("/pergunta/<int:id_pergunta>/gabarito", methods=["GET"])
@token_required
def get_gabarito(id_pergunta, user_id):
    """Função para só pegar o gabarito e nota da pergunta após resposta enviada pelo usuário no modo desafio (evita expor o gabarito no localStorage)"""
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

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
    id_usuario = session.get('id_usuario')
    id_visitante = session.get('id_visitante')
    modo_visitante = session.get("visitante")

    # Configurações locais
    limit = 150 if modo == 'desafio' else 1000

    # Validações
    if not tema or modo not in ('desafio', 'revisao'):
        app.logger.error("Parâmetros inválidos ou ausentes")
        return jsonify({'erro': 'Parâmetros inválidos ou ausentes'}), 400
    if not id_usuario and not modo_visitante:
        app.logger.error("Usuário não autenticado")
        return jsonify({'erro': 'Usuário não autenticado'}), 401
    if not id_visitante and modo_visitante:
        app.logger.error("Visitante não autenticado")
        return jsonify({'erro': 'Visitante não autenticado'}), 401
    
    # Conexão com servidor
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
    except Exception:
        app.logger.exception("1.Erro ao tentar conectar para buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro ao tentar conectar para buscar novas perguntas'}), 500

    # Busca das perguntas
    ids_prioritarios = []
    try:
        select_clause = ",\n".join(QUESTION_CONFIG['select_cols'])
        select_cols_visitante = ",\n".join(QUESTION_CONFIG['select_cols_visitante'])
    
        is_privileged = False if modo_visitante else int(id_usuario) in privileged_ids
        modo_teste = session.get("modo_teste", False)
        if modo_visitante:
            where_filter = "p.status IN ('Ativa', 'Em teste') AND p.disponivel_visitantes = TRUE"
        elif not modo_teste:
            where_filter = "p.status = 'Ativa'"
        else:
            where_filter = "p.status = 'Em teste'" if is_privileged else "p.status = 'Ativa'"

        if modo_visitante:
            sql = f"""
                SELECT {select_cols_visitante}
                FROM perguntas_objetivas p
                LEFT JOIN feedbacks f
                    ON f.id_pergunta = p.id_pergunta
                    AND f.id_visitante = %s
                    AND f.versao_pergunta = p.versao
                LEFT JOIN feedbacks_notas fn
                    ON fn.id_pergunta = p.id_pergunta 
                    AND fn.id_visitante = %s
                    AND (p.versao - floor(p.versao)) = (fn.versao - floor(fn.versao))
                WHERE p.tema = %s AND {where_filter}
                LIMIT %s
            """
            params = (id_visitante, id_visitante, tema, limit)
        else:
            sql = f"""
                SELECT {select_clause}
                FROM perguntas_objetivas p
                LEFT JOIN respostas_usuarios r
                    ON p.id_pergunta = r.id_pergunta AND r.id_usuario = %s
                LEFT JOIN feedbacks f
                    ON f.id_pergunta = p.id_pergunta
                    AND f.id_usuario = %s
                    AND f.versao_pergunta = p.versao
                LEFT JOIN feedbacks_notas fn
                    ON fn.id_pergunta = p.id_pergunta
                    AND fn.id_usuario = %s
                    AND (p.versao - floor(p.versao)) = (fn.versao - floor(fn.versao))
                WHERE p.tema = %s AND {where_filter}
                LIMIT %s
            """
            # Aqui são passados 8 paramêtros por causa da tabela respostas_usuarios, que não é analisada no modo visitante
            params = (id_usuario, id_usuario, id_usuario, tema, limit)
        cur.execute(sql, params)
        perguntas = cur.fetchall()
        perguntas_por_dificuldade = {'Fácil': [], 'Médio': [], 'Difícil': [], 'Extremo': []}
        for row in perguntas:
            respondida = False if modo_visitante else bool(row['respondida'])
            dificuldade = row['dificuldade'] or 'Médio'
            item = {
                'id_pergunta': row['id_pergunta'],
                'subtemas': row['subtemas'],
                'enunciado': row['enunciado'],
                'alternativa_a': row['alternativa_a'],
                'alternativa_b': row['alternativa_b'],
                'alternativa_c': row['alternativa_c'],
                'alternativa_d': row['alternativa_d'],
                'nota': row['nota'],
                'dificuldade': dificuldade,
                'versao_pergunta': row['versao'],
                'estrelas': row['estrelas'],
                'comentario': row['comentario'],
                'aprovacao_nota': row['aprovacao_nota']
            }
            if modo == 'revisao':
                item.update({'resposta_correta': row['resposta_correta']})
            # Filtra por modo
            if modo_visitante:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
            elif modo == 'desafio' and not respondida:
                if row['prioridade_usuarios'] is True:
                    ids_prioritarios.append(row['id_pergunta'])
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
            elif modo == 'revisao' and respondida:
                perguntas_por_dificuldade.setdefault(dificuldade, []).append(item)
    except Exception:
        app.logger.exception("2.Erro ao tentar conectar para buscar perguntas para o usuário com id %s", id_usuario)
        return jsonify({'erro': 'Erro interno ao consultar perguntas'}), 500
    
    finally:
        if cur: cur.close()
        if conn: conn.close()

    pontuacoes_usuario = buscar_pontuacoes_usuario(id_usuario) if not modo_visitante else {}

    return jsonify({
        'perguntas': perguntas_por_dificuldade,
        'pontuacoes_usuario': pontuacoes_usuario,
        'ids_prioritarios': ids_prioritarios
    })

@app.route("/api/subtemas")
def listar_subtemas():
    tema = request.args.get("tema")
    if not tema:
        return {"subtemas": []}
    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT nome FROM subtemas WHERE tema = %s ORDER BY nome ASC
        """, (tema,))

        rows = cur.fetchall()

        return {"subtemas": [r[0] for r in rows]}

    except Exception:
        app.logger.exception("Erro ao buscar subtemas")
        return {"subtemas": []}, 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/login", methods=["GET","POST"])
def login():
    conn = cur = None
    try:
        if request.method == "POST":
            if not request.is_json:
                return jsonify(success=False, message="Content-Type deve ser application/json"), 415

            data = request.get_json()
            email = data.get("email").strip().lower()
            senha = data.get("senha")

            if not email or not senha:
                return jsonify(success=False, message="Email e senha são obrigatórios")
            
            if not re.match(email_regex, email):
                return jsonify(success=False, message="Formato de e-mail inválido"), 400

            conn = get_db_connection()
            cur = conn.cursor()

            # Verifica usuário
            cur.execute("""
                SELECT id_usuario, senha_hash, nome, email_confirmado, perguntas_restantes, ultima_sessao, bonus_energia, expiracao_bonus
                FROM usuarios_registrados WHERE email = %s
            """, (email,))
            usuario = cur.fetchone()

            if not usuario:
                return jsonify(success=False, message="E-mail não registrado")

            id_usuario, senha_hash, nome_usuario, email_confirmado, p_restantes, u_sessao, b_energia, exp_bonus = usuario
            session["id_usuario"] = id_usuario
            session["email"] = email
            session["email_confirmado"] = email_confirmado
            session["visitante"] = False

            if not check_password_hash(senha_hash, senha):
                return jsonify(success=False, message="Senha incorreta")

            # --- LÓGICA DE RECARGA DIÁRIA E BÔNUS (REVISADA) ---
            agora_sp = datetime.now(tz_sp).replace(tzinfo=None, microsecond=0)
            nova_energia = p_restantes

            # 1. Recarga Diária Normal (+20 se for um novo dia)
            if u_sessao and u_sessao.date() < agora_sp.date():
                nova_energia = min(nova_energia + 20, 80)

            # 2. Processamento do Bônus (soma ao total, respeitando o teto de 80)
            if b_energia > 0 and (exp_bonus is None or agora_sp < exp_bonus):
                nova_energia = min(nova_energia + b_energia, 80)

            # 3. Atualiza o banco com a nova energia e o novo horário de sessão
            cur.execute("""
            UPDATE usuarios_registrados
                SET ultima_sessao = date_trunc('second', NOW() AT TIME ZONE 'America/Sao_Paulo'),
                perguntas_restantes = %s,
                bonus_energia = 0,
                expiracao_bonus = NULL
            WHERE id_usuario = %s
            """, (nova_energia, id_usuario))
            
            # Atualiza para o retorno do JSON
            p_restantes = nova_energia

            # Pega as informações de opções do usuário
            cur.execute("""
                SELECT
                exibir_instrucoes_quiz,
                notificacoes_bonus_energia,
                notificacoes_alteracoes_pontos,
                notificacoes_atualizacoes_site,
                outras_notificacoes,
                temas_interesse
                FROM opcoes_usuarios
                WHERE id_usuario = %s
            """, (id_usuario,))

            opcoes = cur.fetchone()

            if opcoes:
                (   
                    exibir_instrucoes_quiz,
                    notificacoes_bonus_energia,
                    notificacoes_alteracoes_pontos,
                    notificacoes_atualizacoes_site,
                    outras_notificacoes,
                    temas_interesse
                ) = opcoes
            else:
                # fallback defensivo (não deveria ocorrer)
                exibir_instrucoes_quiz = True
                notificacoes_bonus_energia = True
                notificacoes_alteracoes_pontos = True
                notificacoes_atualizacoes_site = True
                outras_notificacoes = False
                temas_interesse = []

            # 🔒 Invalida sessões antigas
            cur.execute("UPDATE sessoes SET ativo = FALSE WHERE id_usuario = %s", (id_usuario,))

            # 🔑 Cria nova sessão/token
            token = secrets.token_urlsafe(64)
            expira_em = datetime.utcnow() + timedelta(hours=6)

            cur.execute("""
                INSERT INTO sessoes (id_usuario, token, expira_em, ativo)
                VALUES (%s, %s, %s, TRUE)
            """, (id_usuario, token, expira_em))

            # Lógica de ranking/pontuação
            cur.execute("SELECT tema FROM pontuacoes_usuarios WHERE id_usuario = %s", (id_usuario,))
            temas_ja_registrados = {row[0].strip().lower() for row in cur.fetchall()}
            temas_normalizados = {tema.strip().lower(): tema for tema in temas_disponiveis}
            temas_faltantes = [nome_original for chave, nome_original in temas_normalizados.items() if chave not in temas_ja_registrados]

            for tema in temas_faltantes:
                cur.execute("INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao) VALUES (%s, %s, %s)", (id_usuario, tema, 0))

            conn.commit()

            opcoes_usuario = {
                "exibir_instrucoes_quiz": exibir_instrucoes_quiz,
                "notificacoes_bonus_energia": notificacoes_bonus_energia,
                "notificacoes_alteracoes_pontos": notificacoes_alteracoes_pontos,
                "notificacoes_atualizacoes_site": notificacoes_atualizacoes_site,
                "outras_notificacoes": outras_notificacoes,
                "temas_interesse": temas_interesse or []
            }

            # 🔑 Retorna JSON e define cookie HttpOnly
            resp = make_response(jsonify(
                success=True,
                message="Login realizado com sucesso",
                token=token,
                id_usuario=id_usuario,
                email=email,
                nome_usuario=nome_usuario,
                perguntas_restantes=p_restantes,
                opcoes_usuario=opcoes_usuario
            ), 200)

            resp.set_cookie(
                "token_sessao",
                token,
                httponly=True,
                secure=False,   # True em produção com HTTPS
                samesite="Lax",
                max_age=6 * 3600
            )

            return resp
        else:
            return render_template("login.html")
    except Exception:
        if conn: conn.rollback()
        app.logger.error("Erro no login:\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro interno no servidor"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route('/api/obter_anuncios_home')
def obter_anuncios_home():
    conn = cur = None
    dicionario_anuncios = {}
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, nome, tema, descricao, link_asin, imagem_url, tipo_midia, provedor, disponivel_visitantes, disponivel_usuarios, oferta_expira_em
            FROM anuncios
            WHERE is_ativo = TRUE AND tema = 'Banner horizontal'
        """)

        anuncios = cur.fetchall()

        for a in anuncios:
            id_banco, nome, tema, desc, link_referencia, img, tipo_midia, provedor, disp_visitantes, disp_usuarios, oferta_expira_em = a
            
            # Garante a criação do provedor no dicionário
            if provedor not in dicionario_anuncios:
                dicionario_anuncios[provedor] = []
            
            # Montagem do Link
            if provedor == 'Amazon':
                link_final = f"{link_referencia}?tag={AMAZON_TRACKING_ID}"
            else:
                link_final = link_referencia

            dicionario_anuncios[provedor].append({
                'id': id_banco,
                'nome': nome,
                'tema': tema,
                'descricao': desc,
                'link': link_final,
                'imagem': img,
                'tipo_midia': tipo_midia,
                'provedor': provedor,
                'disponivel_visitantes': disp_visitantes,
                'disponivel_usuarios': disp_usuarios,
                'oferta_expira_em': oferta_expira_em
            })
    except Exception:
        app.logger.exception("Erro ao tentar obter anúncios")
    finally:
        if cur: cur.close()
        if conn: conn.close()
    return jsonify(dicionario_anuncios)

@app.route('/api/obter_todos_anuncios')
def obter_todos_anuncios():
    conn = cur = None
    # Estrutura final: {"História": {"amazon": [...], "mercadolivre": [...]}}
    dicionario_anuncios = {}
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id, tema, nome, descricao, link_asin, imagem_url, provedor, tipo_midia, disponivel_visitantes, disponivel_usuarios, frete_gratis, desconto, oferta_expira_em
            FROM anuncios
            WHERE is_ativo = TRUE
        """)

        anuncios = cur.fetchall()

        for a in anuncios:
            id_banco, tema, nome, desc, link_referencia, img, provedor, tipo_midia, disp_visitantes, disp_usuarios, frete_gratis, desconto, oferta_expira_em = a
            
            # Garante a criação do Tema e do Provedor no dicionário
            if tema not in dicionario_anuncios:
                dicionario_anuncios[tema] = {}
            
            if provedor not in dicionario_anuncios[tema]:
                dicionario_anuncios[tema][provedor] = []
            
            # Montagem do Link
            if provedor == 'Amazon':
                if tipo_midia == 'Melhores ofertas':
                    link_final = f"{link_referencia}?tag={AMAZON_TRACKING_ID}"
                else:
                    link_final = f"https://www.amazon.com.br/dp/{link_referencia}?tag={AMAZON_TRACKING_ID}"
            else:
                if tipo_midia == 'Melhores ofertas':
                    link_final = link_referencia
                else:
                    link_final = f"https://mercadolivre.com/sec/{link_referencia}"

            dicionario_anuncios[tema][provedor].append({
                'id': id_banco,
                'nome': nome,
                'descricao': desc,
                'link': link_final,
                'imagem': img,
                'tipo_midia': tipo_midia,
                'provedor': provedor,
                'disponivel_visitantes': disp_visitantes,
                'disponivel_usuarios': disp_usuarios,
                'frete_gratis': frete_gratis,
                'desconto': desconto,
                'oferta_expira_em': oferta_expira_em
            })

    except Exception:
        app.logger.exception("Erro ao tentar obter anúncios")
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return jsonify(dicionario_anuncios)

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
        agora_sp = datetime.now(tz_sp).replace(tzinfo=None, microsecond=0)
        expiracao = agora_sp + timedelta(hours=24)

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

@app.route('/opcoes', methods=['GET'])
def tela_opcoes():
    registrar_pagina_visitada("Opções")
    return render_template("opcoes.html")

@app.route("/perfil")
def tela_perfil():
    registrar_pagina_visitada("Perfil")
    return render_template("perfil.html")

@app.route("/politica-de-privacidade")
def politica_privacidade():
    session['from_login'] = False
    registrar_pagina_visitada("Home -> Política de Privacidade")
    return render_template("privacy_policy.html")

@app.route("/termos-de-uso")
def termos_uso():
    session['from_login'] = False
    registrar_pagina_visitada("Home -> Termos de Uso")
    return render_template("termos_de_uso.html")

@app.route("/api/favoritos", methods=["POST"])
@token_required
def salvar_favoritos(user_id):
    data = request.get_json(force=True)

    tema = data.get("tema_atual")
    adicionar = set(map(int, data.get("adicionar", [])))
    remover   = set(map(int, data.get("remover", [])))

    if not tema:
        return jsonify({"success": False, "msg": "Tema inválido"}), 400

    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Remover apenas os IDs explicitamente enviados
        if remover:
            cur.execute("""
                DELETE FROM favoritos_usuarios
                WHERE id_usuario = %s
                  AND tema = %s
                  AND id_pergunta = ANY(%s)
            """, (user_id, tema, list(remover)))

        # Inserir os IDs explicitamente enviados
        for id_pergunta in adicionar:
            cur.execute("""
                INSERT INTO favoritos_usuarios (id_usuario, id_pergunta, tema)
                VALUES (%s, %s, %s)
                ON CONFLICT (id_usuario, id_pergunta) DO NOTHING
            """, (user_id, id_pergunta, tema))

        conn.commit()
        return jsonify({"success": True, "msg": "Favoritos atualizados com sucesso."}), 200

    except Exception:
        if conn: conn.rollback()
        app.logger.exception("Erro ao salvar favoritos do usuário %s", user_id)
        return jsonify({"success": False, "msg": "Erro ao salvar favoritos"}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/sobre-o-app")
def sobre_app():
    session['from_login'] = False
    registrar_pagina_visitada("Home -> Sobre")
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

    condicao = """WHERE (%s = 'Variedades' OR tema = %s OR tema = 'Variedades')"""

    # -------- OBJETIVAS --------
    query_obj = f"""
    SELECT id_pergunta, tema, subtemas, enunciado,
        alternativa_a, alternativa_b, alternativa_c, alternativa_d,
        resposta_correta, dificuldade, status
    FROM perguntas_objetivas
    {condicao}
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

    cur.execute(query_obj, (tema, tema, palavras))

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
    query_disc = f"""
    SELECT id_pergunta, tema, subtemas, enunciado, respostas_corretas, dificuldade, status
    FROM perguntas_discursivas
    {condicao}
    AND EXISTS (
        SELECT 1
        FROM unnest(%s::text[]) p
        WHERE
            unaccent(LOWER(enunciado)) LIKE unaccent('%%' || p || '%%')
            OR unaccent(LOWER(respostas_corretas::text)) LIKE unaccent('%%' || p || '%%')
    )
    """

    cur.execute(query_disc, (tema, tema, palavras))
    
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
    registrar_pagina_visitada("Login -> Política de Privacidade")
    return render_template('privacy_policy.html')

@app.route("/resultado")
def resultado():
    usuario_logado = "id_usuario" in session
    return render_template(
        "resultado.html",
        usuario_logado=usuario_logado
    )

@app.route('/termos-de-uso-from-login')
def termos_uso_from_login():
    session['from_login'] = True
    registrar_pagina_visitada("Login -> Termos de Uso")
    return render_template('termos_de_uso.html')

@app.route('/sobre-o-app-from-login')
def sobre_app_from_login():
    session['from_login'] = True
    registrar_pagina_visitada("Login -> Sobre")
    return render_template('sobre_o_app.html')

@app.route("/quiz/<tema>")
@token_required
def quiz(user_id, tema):
    return render_template("quiz.html", AMAZON_TRACKING_ID=AMAZON_TRACKING_ID)

@app.route("/revisao/<tema>")
@token_required
def revisao(user_id, tema):
    return render_template("quiz.html", AMAZON_TRACKING_ID=AMAZON_TRACKING_ID)

@app.route("/register", methods=["POST"])
def registrar():
    print("Registrando usuário")
    data = request.get_json()
    notificacoes_bonus_energia = bool(data.get("notificacoes_bonus_energia", True))
    notificacoes_alteracoes_pontos = bool(data.get("notificacoes_alteracoes_pontos", True))
    notificacoes_atualizacoes_site = bool(data.get("notificacoes_atualizacoes_site", True))

    nome = data.get("nome")
    email_raw = data.get("email")
    senha = data.get("senha")
    captcha_token = data.get("captcha_token")
    captcha_selecoes = list(map(int, data.get("captcha_selecoes", [])))

    # Validação do e-mail
    if not email_raw or email_raw in EMAILS_PROIBIDOS:
        return jsonify(success=False, message="E-mail inválido"), 400
    email = email_raw.strip().lower()

    # Validação do CAPTCHA
    if not captcha_token:
        return jsonify(success=False, message="CAPTCHA token ausente"), 400

    dados_captcha = session.get(f"captcha_{captcha_token}")
    if not dados_captcha or time.time() > dados_captcha.get("expira", 0):
        return jsonify(success=False, message="CAPTCHA expirado ou inválido"), 400

    if sorted(captcha_selecoes) != sorted(dados_captcha.get("corretos", [])):
        print("Seleção de captcha incorreta")
        return jsonify(success=False, message="Seleções do CAPTCHA incorretas"), 400

    print("2. Cheguei aqui")

    # Invalida o CAPTCHA para evitar reutilização
    session.pop(f"captcha_{captcha_token}", None)

    # Gerar hash da senha e token de confirmação
    senha_hash = generate_password_hash(senha)
    token = gerar_token_confirmacao()

    # Agora atual (truncado para segundos)
    agora_sp = datetime.now(tz_sp).replace(tzinfo=None, microsecond=0)
    expiracao = agora_sp + timedelta(hours=24)
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

        # Registra as opções de usuários na base de dados
        cur.execute("""
            INSERT INTO opcoes_usuarios (
              id_usuario,
              notificacoes_bonus_energia,
              notificacoes_alteracoes_pontos,
              notificacoes_atualizacoes_site
            )
            VALUES (%s, %s, %s, %s)
        """, (id_usuario, notificacoes_bonus_energia, notificacoes_alteracoes_pontos, notificacoes_atualizacoes_site))

        # Cria os registros de pontuações do usuário em cada tema
        cur.execute("""
            INSERT INTO pontuacoes_usuarios (id_usuario, tema, pontuacao)
            SELECT %s, t.nome, 0
            FROM temas t
            WHERE t.ativo = true
            ON CONFLICT (id_usuario, tema) DO NOTHING
        """, (id_usuario,))

        # Migra dados do modo visitante para a nova conta caso o usuário tenha marcado esta opção
        id_visitante = data.get("id_visitante")
        usar_dados_visitante = data.get("usar_dados_visitante", False)
        if id_visitante:
            if usar_dados_visitante:
                cur.execute("""
                    SELECT
                        id_pergunta, tema, resposta_enviada, versao_pergunta, acertou, tempo_gasto, pontos_ganhos, pontos_usuario, auto_chute, dificuldade
                    FROM respostas_visitantes
                    WHERE id_visitante = %s AND criado_em >= NOW() - INTERVAL '1 month'
                    ORDER BY id_pergunta, criado_em ASC
                """, (id_visitante,))
                
                respostas = cur.fetchall()

                # Obs: A data da resposta registrada é a data em que ocorreu a migração dos dados
                for id_pergunta, tema, resposta_enviada, versao_pergunta, acertou, tempo_gasto, pontos_ganhos, pontos_usuario, auto_chute, dificuldade in respostas:
                    cur.execute("""
                        INSERT INTO respostas_usuarios (
                            id_usuario, id_pergunta, tema, resposta_usuario, versao_pergunta, acertou, tempo_gasto, pontos_ganhos, pontos_usuario, data_resposta, dados_migrados, auto_chute, dificuldade
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id_usuario, id_pergunta) DO NOTHING
                    """, (id_usuario, id_pergunta, tema, resposta_enviada, versao_pergunta, acertou, tempo_gasto, pontos_ganhos, pontos_usuario, agora_sp, True, auto_chute, dificuldade))

                app.logger.info(f"{len(respostas)} respostas migradas do visitante {id_visitante}")

                # Limpeza das respostas do usuario no modo visitante
                cur.execute("""
                    DELETE FROM respostas_visitantes WHERE id_visitante = %s AND criado_em >= NOW() - INTERVAL '1 month'
                """, (id_visitante,))

            # Atualiza os feedbacks para as perguntas que o usuário fez como visitante
            cur.execute("""
                UPDATE feedbacks
                SET id_usuario = %s
                WHERE id_visitante = %s
                AND id_usuario IS NULL
                RETURNING id_feedback
            """, (id_usuario, id_visitante))
            qtd = cur.rowcount
            app.logger.info(
                f"{qtd} feedbacks migrados do visitante {id_visitante} para usuario {id_usuario}"
            )

            # Atualiza os feedbacks gerais para o site que o usuário fez como visitante
            cur.execute("""
                UPDATE feedbacks_comentarios
                SET id_usuario = %s
                WHERE id_visitante = %s
                AND id_usuario IS NULL
            """, (id_usuario, id_visitante))

        conn.commit()
    except Exception:
        conn.rollback()
        app.logger.error("Erro ao tentar registrar nova conta\n" + traceback.format_exc())
        return jsonify(success=False, message="Erro interno no registro"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()
    
    # ATENÇÃO: ESTE LINK DE CONFIRMAÇÃO JÁ É DEFINIDO DENTRO DA FUNÇÃO ENVIAR_EMAIL_CONFIRMACAO
    link_confirmacao = f"{base_url}/confirmar_email?token={token}"
    enviar_email_confirmacao(email, nome, link_confirmacao)
    return jsonify(success=True, message="Registro realizado! Verifique seu e-mail para confirmar")

@app.route('/registrar_interacao_anuncio', methods=['POST'])
def registrar_interacao_anuncio():
    dados = request.get_json()
    if not dados:
        return jsonify({"erro": "Dados inválidos"}), 400

    conn = cur = None
    try:
        tipo_interacao = dados.get("tipo_interacao", None)
        id_usuario = None if dados["modo_visitante"] else dados["id_usuario"]
        id_visitante = None if not dados["modo_visitante"] else dados["id_visitante"]

        conn = get_db_connection()
        cur = conn.cursor()

        dispositivo = identificar_dispositivo()
        query = """
        INSERT INTO cliques_anuncios (id_usuario, id_visitante, id_anuncio, tema_quiz, provedor, tipo_midia, dispositivo, tipo_interacao)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"""
        valores = (
            id_usuario,
            id_visitante,
            dados["id_anuncio"],
            dados["tema_quiz"],
            dados["provedor"],
            dados["tipo_midia"],
            dispositivo,
            tipo_interacao
        )
        cur.execute(query, valores)
        conn.commit()

        return jsonify({"status": "sucesso", "mensagem": "Interação em anúncio registrada"}), 201
    except Exception:
        app.logger.exception("Erro ao tentar registrar interação em anúncio")
        return jsonify({"erro": "Erro ao tentar registrar interação em anúncio"}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/api/modo_teste", methods=["POST"])
def registrar_modo_teste():
    data = request.get_json() or {}
    session["modo_teste"] = bool(data.get("modo_teste", False))
    return jsonify({"ok": True})

def registrar_pagina_visitada(pagina):
    conn = cur = None
    id_usuario = session.get('id_usuario')
    id_visitante = session.get('id_visitante')

    if id_usuario in privileged_ids or id_visitante == id_visitante_admin:
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

@app.route("/registrar_resposta", methods=["POST"])
@token_required
def registrar_resposta_usuario(user_id):
    dados = request.get_json()
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
                    id_usuario, id_pergunta, versao_pergunta, resposta_usuario, acertou,pontos_ganhos, tempo_gasto, pontos_usuario, tema, dados_migrados, dificuldade, auto_chute
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                id_usuario,
                dados["id_pergunta"],
                dados["versao_pergunta"],
                dados["resposta_usuario"],
                dados["acertou"],
                dados["pontos_ganhos"],
                dados["tempo_gasto"],
                dados["pontos_usuario"],
                dados["tema"],
                False,
                dados["dificuldade"].lower().capitalize(),
                dados["auto_chute"]
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
                UPDATE usuarios_registrados
                SET
                    perguntas_restantes = GREATEST(perguntas_restantes - 1, 0)
                WHERE id_usuario = %s
                RETURNING perguntas_restantes
            """, (id_usuario,))

            perguntas_restantes = cur.fetchone()
            conn.commit()

            return jsonify({
                "sucesso": True,
                "nova_pontuacao": nova_pontuacao,
                "perguntas_restantes": perguntas_restantes,
            })
    except Exception:
        if conn: conn.rollback()
        app.logger.exception("Erro ao tentar registrar resposta da pergunta de usuário")
        return jsonify(success=False, message="Erro ao tentar registrar resposta da pergunta de usuário"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/registrar-resposta-visitante", methods=["POST"])
def registrar_resposta_visitante():
    dados = request.get_json()
    id_visitante = session["id_visitante"]

    conn = cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO respostas_visitantes (
                tema,
                id_pergunta,
                resposta_enviada,
                acertou,
                tempo_gasto,
                id_visitante,
                versao_pergunta,
                pontos_ganhos,
                pontos_usuario,
                modo_tela,
                dificuldade,
                auto_chute
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            dados.get("tema"),
            dados.get("id_pergunta"),
            dados.get("resposta_enviada"),
            dados.get("acertou"),
            dados.get("tempo_gasto"),
            id_visitante,
            dados.get("versao_pergunta"),
            dados.get("pontos_ganhos"),
            dados.get("pontos_usuario"),
            dados.get("modo_tela"),
            dados.get("dificuldade").lower().capitalize(),
            dados.get("auto_chute")
        ))
        conn.commit()
    except Exception:
        if conn: conn.rollback()
        app.logger.exception("Erro ao registrar resposta da pergunta de visitante")
        return jsonify(success=False, message="Erro ao tentar registrar resposta da pergunta de visitante"), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

    return jsonify({"status": "ok"}), 200

@app.route("/api/registrar_visitante", methods=["POST"])
def registrar_visitante():
    data = request.get_json()
    id_visitante = data.get("id_visitante")

    if id_visitante:
        session["id_visitante"] = id_visitante
    return jsonify({"ok": True})

@app.route("/api/salvar-opcoes", methods=["POST"])
@token_required
def salvar_opcoes(user_id):
    cur = conn = None
    try:
        data = request.get_json(silent=True) or {}
        exibir_instrucoes_quiz = bool(data.get("exibir_instrucoes_quiz", True))
        notificacoes_bonus_energia = bool(data.get("notificacoes_bonus_energia", True))
        notificacoes_alteracoes_pontos = bool(data.get("notificacoes_alteracoes_pontos", True))
        notificacoes_atualizacoes_site = bool(data.get("notificacoes_atualizacoes_site", True))
        outras_notificacoes = bool(data.get("outras_notificacoes", False))
        temas_interesse = data.get("temas_interesse", [])

        # Garantia defensiva
        if not isinstance(temas_interesse, list): temas_interesse = []

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE opcoes_usuarios
            SET
                exibir_instrucoes_quiz = %s,
                notificacoes_bonus_energia = %s,
                notificacoes_alteracoes_pontos = %s,
                notificacoes_atualizacoes_site = %s,
                outras_notificacoes = %s,
                temas_interesse = %s,
                ultima_atualizacao = date_trunc('seconds', NOW() AT TIME ZONE 'America/Sao_Paulo')
            WHERE id_usuario = %s
        """, (
            exibir_instrucoes_quiz,
            notificacoes_bonus_energia,
            notificacoes_alteracoes_pontos,
            notificacoes_atualizacoes_site,
            outras_notificacoes,
            temas_interesse,
            user_id
        ))

        conn.commit()
        return jsonify({"success": True})
    except Exception:
        if conn: conn.rollback()
        app.logger.exception("Erro ao tentar salvar opções do usuário")
        return jsonify({"success": False}), 500
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.route("/register_validate", methods=["POST"])
def validar_registro():
    data = request.get_json()
    ok, msg = checar_dados_registro(data.get("nome"), data.get("email"), data.get("senha"))
    if not ok:
        return jsonify(success=False, message=msg)

    return jsonify(success=True, message="Validação OK")

@app.route("/admin/marcar_feedback_lido", methods=["GET"])
def marcar_feedback_lido():
    tipo = request.args.get("tipo")
    id_feedback = request.args.get("id")

    if tipo not in ("pergunta", "site") or not id_feedback:
        return "Parâmetros inválidos", 400

    tabela = "feedbacks" if tipo == "pergunta" else "feedbacks_comentarios"

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {tabela}
                    SET lido = TRUE
                    WHERE id_feedback = %s
                """, (id_feedback,))
                conn.commit()

        return "Feedback marcado como lido ✔️"

    except Exception:
        app.logger.exception("Erro ao marcar feedback como lido")
        return "Erro interno", 500

# 1. Rode o agendamento em uma Thread para não bloquear o Flask
if __name__ == '__main__':
    app.run(debug=not database_url)
