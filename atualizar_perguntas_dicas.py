from app import get_db_connection
from psycopg2.extras import RealDictCursor

def atualizar_perguntas_dicas():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = """
                UPDATE usuarios_registrados u
                SET 
                    perguntas_restantes = LEAST(
                        u.perguntas_restantes + rp.incremento_perguntas, 
                        rp.limite_maximo_perguntas
                    ),
                    dicas_restantes = LEAST(
                        u.dicas_restantes + rp.incremento_dicas,
                        rp.limite_maximo_dicas
                    ),
                    ultima_atualizacao = date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                FROM regras_plano rp
                WHERE u.plano = rp.plano
                  AND (u.ultima_atualizacao IS NULL OR
                       u.ultima_atualizacao < date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                  );
            """
            cur.execute(query)
            conn.commit()
            print(f"Atualização concluída. {cur.rowcount} linhas modificadas.")
    except Exception as e:
        print("Erro ao atualizar perguntas e dicas:", e)
    finally:
        conn.close()

if __name__ == "__main__":
    atualizar_perguntas_dicas()
