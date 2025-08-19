from psycopg2.extras import RealDictCursor
from db import *

def atualizar_perguntas_dicas():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Valores fixos definidos
            incremento_perguntas = 20
            limite_maximo_perguntas = 100
            incremento_dicas = 4
            limite_maximo_dicas = 20

            query = f"""
                UPDATE usuarios_registrados
                SET 
                    perguntas_restantes = LEAST(
                        perguntas_restantes + {incremento_perguntas},
                        {limite_maximo_perguntas}
                    ),
                    dicas_restantes = LEAST(
                        dicas_restantes + {incremento_dicas},
                        {limite_maximo_dicas}
                    ),
                    ultima_atualizacao = date_trunc('second', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')
                WHERE ultima_atualizacao IS NULL
                   OR ultima_atualizacao < date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo');
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
    