from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from utils import email_remetente, senha_app, porta_email, base_url
import smtplib
import logging

logger = logging.getLogger(__name__)

def enviar_email_confirmacao(email_destinatario, nome_destinatario, link_confirmacao):
    remetente = email_remetente
    senha = senha_app
    porta = int(porta_email)

    assunto = "Confirmação de Cadastro - Desafio das Perguntas"
    corpo = f"""
    Olá, {nome_destinatario}!

    Clique no link abaixo para confirmar seu cadastro no Desafio das Perguntas:

    {link_confirmacao}

    O link expira em 24 horas.

    URL do site:

    desafiodasperguntas.com.br

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
        logger.exception("Erro ao enviar email de confirmação de conta")
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

def enviar_email_feedback_pergunta(id_feedback, id_pergunta, tema, tipo_pergunta, enunciado, comentario, estrelas, dificuldade, modo_visitante):
    assunto = "[Feedback] Comentário em pergunta"
    
    link_lido = (
        f"{base_url}/admin/marcar_feedback_lido"
        f"?tipo=pergunta&id={id_feedback}"
    )

    corpo = f"""
        Novo feedback em pergunta:

        ID da pergunta: {id_pergunta}
        Tema: {tema} ({tipo_pergunta})
        Enunciado: {enunciado}
        Dificuldade: {dificuldade}
        Estrelas: {estrelas if estrelas is not None else '—'}
        Modo visitante: {'Sim' if modo_visitante else 'Não'}

        Comentário:
        {comentario}

        Marcar como lido:
        {link_lido}
    """

    enviado = enviar_email_admin(assunto, corpo)
    if not enviado:
        logger.warning("Falha ao enviar email de feedback para pergunta (não crítico)")

def enviar_email_feedback_site(id_feedback, tema, tipo_pergunta, comentario, pontuacao_saldo, modo_visitante
):
    assunto = "[Feedback] Comentário sobre o site"

    link_lido = (
        f"{base_url}/admin/marcar_feedback_lido"
        f"?tipo=site&id={id_feedback}"
    )

    corpo = f"""
        Novo feedback geral do site:

        Tema: {tema} ({tipo_pergunta})
        Pontos ganhos no quiz: {pontuacao_saldo}
        Modo visitante: {'Sim' if modo_visitante else 'Não'}

        Comentário:
        {comentario}

        Marcar como lido:
        {link_lido}
    """

    enviado = enviar_email_admin(assunto, corpo)
    if not enviado:
        logger.warning("Falha ao enviar email de feedback para o site (não crítico)")

def enviar_email_admin(assunto, corpo):
    try:
        msg = MIMEMultipart()
        msg["From"] = email_remetente
        msg["To"] = email_remetente
        msg["Subject"] = assunto
        msg.attach(MIMEText(corpo, 'plain'))

        with smtplib.SMTP("smtp.gmail.com", int(porta_email)) as servidor:
            servidor.starttls()
            servidor.login(email_remetente, senha_app)
            servidor.send_message(msg)

        return True

    except Exception:
        logger.exception("Erro ao enviar email de feedback para admin")
        return False
