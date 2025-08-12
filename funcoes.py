import tratamento_erros
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.scrollview import ScrollView
from kivy.uix.image import Image
from kivy.graphics import Color, Rectangle, RoundedRectangle
from kivy.clock import Clock
from kivy.utils import platform
from constantes import *
import constantes
import shutil
import json
from random import choice, randint, shuffle
import unicodedata
if platform == 'android':
    try:
        from android.storage import app_storage_path
        base_dir = app_storage_path()
    except:
        tratamento_erros.erros_identificados.append('Não foi possível importar app_storage_path')
        tratamento_erros.exibir_erro()
        base_dir = ''
else:
    base_dir = ''

def definir_posicao_widget(widget, layout=None, pos_hint=None, x=None, y=None, center=[0, 0]):
    if pos_hint is not None:
        widget.pos_hint = pos_hint
    else:
        widget.pos_hint_x = widget.pos_hint_y = None
        if x is not None:
            widget.x = x
        else:
            widget.center_x = center[0]
        if y is not None:
            widget.y = y
        else:
            widget.center_y = center[1]
    if layout:
        layout.add_widget(widget)

class CheckBox:
    def __init__(self, x, center_y, active=False, layout=None, lista_checks=None, lista_botoes=None, text='', radiobox=False, funcao=None, max_largura_texto=Window.width - 2 * x_btn_esquerdo, color=(1, 1, 1, 1), text_size=[Window.width, -100], font_size=tamanho_fonte_textos):
        self.max_largura_texto, self.layout, self.color = max_largura_texto, layout, color
        if text_size[1] == -100:
            self.text_size = [text_size[0], 8 * font_size]
        else:
            self.text_size = text_size
        self.font_size = font_size
        # Imagem do checkbox
        self.img = Image(size_hint=(None, None), size=tamanho_img_checkbox)
        self.img.pos_hint_x = self.img.pos_hint_y = None
        self.img.x, self.img.center_y = x, center_y
        self.active, self.radiobox = active, radiobox
        if not radiobox:
            self.img.source = check_normal if not self.active else check_down
        else:
            self.img.source = radio_normal if not self.active else radio_down
        # Botão do checkbox
        self.btn = Button(size_hint=(None, None), size=(1.5 * self.img.size[0], 1.5 * self.img.size[1]), center=self.img.center, background_color=(0, 0, 0, 0), background_normal='', background_down='')
        # Textos que ficam ao lado do checkbox
        self.text, self.tot_texts = text, []
        self.mudar_texto()
        if layout:
            redefinir_layout(layout, [], [self.btn, self.img])
        if lista_checks is not None:
            lista_checks.append(self)
        if lista_botoes is not None:
            lista_botoes.append(self)
        if funcao is not None:
            self.btn.bind(on_release=funcao)

    def alterar_estado(self, grupo_radios=(), tocar_som=True):
        """Altera o estado do check de ativo para inativo e vice-versa"""
        # Caso dos checkboxes
        if not self.radiobox:
            if tocar_som:
                som_checkbox.play()
            if self.img.source == check_normal:
                self.img.source, self.active = check_down, True
            else:
                self.img.source, self.active = check_normal, False
        # Caso dos radiobuttons
        else:
            # Ativa o radio
            if self.img.source == radio_normal:
                if tocar_som:
                    som_checkbox.play()
                self.img.source, self.active = radio_down, True
            # Desativa qualquer outro radio que já estava ativado
            for radio in grupo_radios:
                if radio != self:
                    radio.img.source, radio.active = radio_normal, False

    def adicionar_checkbox(self, layout):
        if not self.btn.parent:
            layout.add_widget(self.btn)
            layout.add_widget(self.img)
            for text in self.tot_texts:
                layout.add_widget(text)

    def remover_checkbox(self, layout):
        if self.btn.parent:
            layout.remove_widget(self.btn)
            layout.remove_widget(self.img)
            for text in self.tot_texts:
                layout.remove_widget(text)
    
    def mudar_texto(self):
        self.tot_texts = []
        lbl_texto = criar_label(layout=self.layout, font_size=self.font_size, text=self.text, size=[Window.width, 2 * self.font_size], x=self.btn.x + tamanho_img_checkbox[0] + dist_check_textos, center=[0, self.btn.center_y], color=self.color, halign='left')
        self.tot_texts.append(lbl_texto)
    
    def alterar_cores_texto(self, cor):
        for linha_texto in self.tot_texts:
            linha_texto.color = cor

class MyButton:
    def __init__(self, layout=None, lista_botoes=None, text='', font_size=tamanho_fonte_textos, size_hint=[None, None], size=[0, 0], pos_hint=None, x=None, y=None, center=[0, 0], valign='center', outline_width=None, funcao=None, definir_tamanho=True, direita=False, invisivel=True, img=None, id_btn='', color=(0, 0, 0, 1)):
        self.definir_tamanho, self.caminho_img = definir_tamanho, img
        if size_hint != [None, None] or size != [0, 0]:
            self.definir_tamanho = False
        if outline_width is None:
            outline_width = 1.4 * font_size ** (1 / 3)
        self.btn = Button(text=id_btn, font_size=font_size, size_hint=size_hint, size=size, color=cor_fg_botao, outline_color=cor_contorno_botao, background_color=constantes.cor_bg_botao, background_normal='', outline_width=outline_width, halign='center', valign=valign)
        if not id_btn:
            self.btn.text = text
        self.direita, self.invisivel, self.folga_texto_btn_img = direita, invisivel, 0.03 * self.btn.size[1]
        self.altura_bordas_btn = self.btn.font_size + 2 * self.folga_texto_btn_img
        self.altura_centro_btn = self.btn.size[1] - 2 * self.altura_bordas_btn
        if text and definir_tamanho:
            font_texto = ImageFont.truetype('fonts/Roboto-Regular.ttf', round(font_size))
            largura_txt = font_texto.getmask(f'{text}').getbbox()[2]
            self.btn.size = [largura_txt + folga_textos, altura_botao_menor]
            if direita:
                x = Window.width - x_btn_esquerdo - self.btn.size[0]
        definir_posicao_widget(self.btn, layout, pos_hint, x, y, center)
        # Adiciona o botão na lista de botões da tela
        if lista_botoes is not None:
            lista_botoes.append(self)
        # Texto do botão; deve-se lembrar que alterações feitas aqui só surtirão efeito se forem feitas também no método redesenhar_tela
        centro_texto = [self.btn.center[0], self.btn.center[1]] if img is None else [self.btn.center[0], self.btn.y + self.altura_bordas_btn / 2]
        if self.caminho_img is None:
            self.lbl = criar_label(layout=layout, text=text, color=color, font_size=font_size, size=size, center=centro_texto)
        else:
            self.lbl = criar_label(layout=layout, text=text, color=color, font_size=font_size, size=size, center=centro_texto)
        if funcao is not None:
            self.btn.bind(on_release=funcao)
        if invisivel:
            self.btn.background_color = self.btn.color = (0, 0, 0, 0)
        # A linha abaixo não deve ser mudada no Desafios de Geografia
        if img is not None:
            self.espessura_contorno = 2.5 * espessura_contorno
            # Imagem na parte central do botão
            if self.lbl.text:
                self.img = criar_imagem(img, layout, size=[self.btn.size[0], self.altura_centro_btn], center=[self.btn.center[0], self.btn.y + self.altura_bordas_btn + self.altura_centro_btn / 2], fit_mode = 'fill')
            else:
                self.img = criar_imagem(img, layout, size=[self.btn.size[0], self.btn.size[1]], center=[self.btn.center[0], self.btn.center[1] - self.espessura_contorno])
            # Estrelas que representam a média de avaliação das perguntas no tema
            media_avaliacao_tema = 0
            for n in range(5):
                espaco_disponivel = self.img.size[0] - 0.75 * tamanho_img_estrela[0] * 5
                estrela = criar_imagem(estrela_desmarcada, layout=layout, size=[0.8 * tamanho_img_estrela[0], 0.75 * tamanho_img_estrela[1]], x=self.img.x + 0.75 * tamanho_img_estrela[0] * n + espaco_disponivel / 6 * (n + 1), center=[0, self.btn.center_y + (self.altura_centro_btn + self.altura_bordas_btn) / 2])
                if n + 1 <= media_avaliacao_tema:
                    estrela.source = estrela_marcada
                elif n == media_avaliacao_tema - 0.5:
                    estrela.source = meia_estrela_marcada
                else:
                    estrela.source = estrela_desmarcada
        else:
            self.espessura_contorno = espessura_contorno
            self.img = None

def criar_label(layout=None, text='', font_size=tamanho_fonte_textos, size_hint=[None, None], size=[2 * Window.width, 0.5 * Window.height], pos_hint=None, x=None, y=None, center=[0, 0], color=cor_fg_botao, outline_color=cor_contorno_botao, outline_width=None, halign='center', valign='center'):
    # Texto branco com contorno
    if outline_width is None:
        outline_width = 1.4 * font_size ** (1 / 3)
    # Texto preto
    if color == (0, 0, 0, 1):
        outline_width = 0.29 * font_size ** (1 / 3)
    label = Label(text=text, font_size=font_size, size_hint=size_hint, size=size, color=color, outline_color=outline_color, outline_width=outline_width, bold=True, markup=True, valign=valign)
    if halign == 'left':
        label.text_size = label.size
    elif halign == 'center':
        label.halign = 'center'
    definir_posicao_widget(label, layout, pos_hint, x, y, center)
    return label

def redefinir_layout(layout, remocoes, adicoes, tela=None):
    """Faz uma série de remoções e adições de widgets na tela de layout passada"""
    # Remove os widgets
    for widget in remocoes:
        if type(widget) == MyButton:
            if widget.btn.parent:
                layout.remove_widget(widget.btn)
            if widget.lbl.parent:
                layout.remove_widget(widget.lbl)
            if widget.img is not None:
                if widget.img.parent:
                    layout.remove_widget(widget.img)
        elif widget.parent:
            layout.remove_widget(widget)
    # Adiciona os widgets
    for widget in adicoes:
        if type(widget) == MyButton:
            if not widget.btn.parent:
                layout.add_widget(widget.btn)
            if not widget.lbl.parent:
                layout.add_widget(widget.lbl)
            if widget.img is not None:
                if not widget.img.parent:
                    layout.add_widget(widget.img)
        elif not widget.parent:
            layout.add_widget(widget)
    if tela is not None:
        redesenhar_tela(tela)

def redesenhar_tela(tela):
    cor01 = Color(*constantes.cor_fundo_tela)
    for (objeto, tipo_canvas, widget) in tela.objetos_canvas:
        if tipo_canvas == 0:
            try:
                widget.canvas.before.remove(objeto)
            except:
                pass
        else:
            try:
                widget.canvas.remove(objeto)
            except:
                pass
    tela.objetos_canvas = []
    tela.canvas.before.add(cor01)
    tela.objetos_canvas.append((cor01, 0, tela))
    cor02 = Color(0, 0, 0, 1)
    for class_btn in tela.botoes:
        btn = class_btn.btn
        # Atualiza o tamanho e x do botão para o caso de seu texto ter sido modificado
        if type(class_btn) == MyButton:
            lbl, pos_round_rec = class_btn.lbl, [None, None]
            if class_btn.definir_tamanho:
                font_texto = ImageFont.truetype('fonts/Roboto-Regular.ttf', round(lbl.font_size))
                try:
                    btn.size[0] = font_texto.getmask(f'{lbl.text}').getbbox()[2] + folga_textos
                except Exception as e:
                    print('Erro ao tentar definir o tamanho do botão', e)
            if class_btn.direita:
                btn.x = Window.width - x_btn_esquerdo - btn.size[0]
            # A seguinte parte serve para reposicionar label quando o texto de um determinado botão muda
            if class_btn.caminho_img is None:
                lbl.center = [btn.center[0], btn.center[1]]
            else:
                lbl.center = [btn.center[0], class_btn.btn.y + class_btn.altura_bordas_btn / 2]
        # Caso seja um checkbox ou o botão não esteja na tela, não irá desenhar a imagem do botão
        if type(class_btn) == CheckBox or not btn.parent:
            continue
        else:
            # Identifica a posição em que devem ficar os retângulos
            pos_round_rec = [None, None] # Esta é a posição do retângulo menor do botão (o maior é o que cria o contorno)
            if btn.center[0] != 0:
                pos_round_rec[0] = btn.center[0] - btn.size[0] / 2
            else:
                pos_round_rec[0] = btn.x
            if btn.center[1] != 0:
                pos_round_rec[1] = btn.center[1] - btn.size[1] / 2
            else:
                pos_round_rec[1] = btn.y
            # Retângulo externo (maior)
            cor_ret_externo = Color(*cor_fundo_btn_menu) if class_btn.lbl.text in tot_temas else Color(0, 0, 0, 1)
            btn.canvas.before.add(cor_ret_externo)
            tela.objetos_canvas.append((cor_ret_externo, 0, btn))
            if class_btn.caminho_img is None:
                ret_redondo_01 = RoundedRectangle(size=[class_btn.btn.size[0] + 2 * class_btn.espessura_contorno, class_btn.btn.size[1] + 2 * class_btn.espessura_contorno], pos=(pos_round_rec[0] - class_btn.espessura_contorno, pos_round_rec[1] - class_btn.espessura_contorno), radius=[2.8 * class_btn.espessura_contorno])
            else:
                ret_redondo_01 = RoundedRectangle(size=[class_btn.btn.size[0], class_btn.btn.size[1]], pos=(pos_round_rec[0], pos_round_rec[1]), radius=[class_btn.espessura_contorno])
            btn.canvas.before.add(ret_redondo_01)
            tela.objetos_canvas.append((ret_redondo_01, 0, btn))
            # Retângulo interno (menor)
            if class_btn.caminho_img is None:
                cor_bg = Color(*constantes.cor_bg_botao)
                btn.canvas.before.add(cor_bg)
                tela.objetos_canvas.append((cor_bg, 0, btn))
                ret_redondo_02 = RoundedRectangle(size=class_btn.btn.size, pos=pos_round_rec, radius=[2 * class_btn.espessura_contorno])
                btn.canvas.before.add(ret_redondo_02)
                tela.objetos_canvas.append((ret_redondo_02, 0, btn))
    tela.canvas.add(cor02)
    tela.objetos_canvas.append((cor02, 1, tela))

def criar_nova_pergunta(tela):
    redefinir_layout(tela.layout_inferior, [tela.btn_finalizar.btn, tela.btn_finalizar.lbl], [])
    """tela.lbl_feedback_enviado.text, tela.lbl_feedback_enviado.color = 'Feedback enviado', 'white'"""
    # Se as perguntas foram ordenadas por nível de dificuldade
    if constantes.preferencias_usuario["ordenar_perguntas_por_dificuldade"]:
        for nivel in tot_niveis:
            if constantes.perguntas_filtradas[nivel]:
                 tela.pergunta_escolhida = choice(constantes.perguntas_filtradas[nivel])
                 break
    else:
        tela.pergunta_escolhida = choice(constantes.perguntas_filtradas['Fácil'] + constantes.perguntas_filtradas['Médio'] + constantes.perguntas_filtradas['Difícil'])
    constantes.dificuldade_pergunta = tela.pergunta_escolhida[-1]
    print(f'Pergunta escolhida: (id={tela.pergunta_escolhida[0]}){tela.pergunta_escolhida[1]["ENUN"]}')
    # Ajusta a scroll e o tamanho da tela para os padrões para a nova pergunta que será feita
    tela.sv.scroll_y, tela.layout_superior.height = 1, Window.height - altura_layout_menor
    # Cria o texto da pergunta e as alternativas
    organizar_tela_quiz(tela)
    criar_alternativas(tela)
    tela.btn_confirmar.lbl.text = 'Alternativas'

def organizar_tela_quiz(tela):
    """Limpa os widgets da pergunta anterior da tela e cria o enunciado da próxima pergunta"""
    remover_widgets_tela_quiz(tela)
    estrela = posicionar_widgets_tela_quiz(tela)
    criar_enunciado(tela, estrela)

def criar_enunciado(tela, estrela):
    tela.lbls_tela_quiz['ENUN'], tamanho_letra_padrao, max_espaco_permitido, palavras, linhas_texto_01, linhas_texto_02, linhas_texto_03, linhas_texto_04 = [], opcoes_tamanho_letra[constantes.preferencias_usuario["tamanho_letra"]], Window.width - 2 * x_btn_esquerdo, tela.pergunta_escolhida[1]['ENUN'].split(), {'maior_espaco_sobrando': 0, 'linhas_texto': [], "ajuste_necessario": 0}, {'maior_espaco_sobrando': 0, 'linhas_texto': [], "ajuste_necessario": 0}, {'maior_espaco_sobrando': 0, 'linhas_texto': [], "ajuste_necessario": 0}, {'maior_espaco_sobrando': 0, 'linhas_texto': [], "ajuste_necessario": 0}
    tot_linhas_texto = [linhas_texto_01, linhas_texto_02, linhas_texto_03, linhas_texto_04]
    for g in range(4):
        texto_linha, novo_texto_linha, espaco_sobrando_na_linha, linhas_texto, ajuste_necessario = '', '', 0, tot_linhas_texto[g], tot_linhas_texto[g]['ajuste_necessario']
        for n, palavra in enumerate(palavras):
            adicao = '' if n == len(tela.pergunta_escolhida[1]['ENUN']) - 1 else ' '
            texto_linha += palavra + adicao
            lbl_teste = Label(text=texto_linha.strip(), font_size=tamanho_letra_padrao, size_hint=(None, None), center=Window.center, bold=True, outline_width=1.4 * tamanho_letra_padrao ** (1 / 3))
            if g in (0, 1):
                lbl_teste.text = lbl_teste.text.replace(' ', '\u200A\u200A')
            else:
                lbl_teste.text = lbl_teste.text.replace(' ', '\u200A\u200A\u200A')
            lbl_teste.texture_update()
            espaco_utilizado = lbl_teste.texture_size[0]
            espaco_adicional_necessario = espaco_utilizado - max_espaco_permitido
            # Se ainda há espaço suficiente para a palavra na linha atual
            if espaco_adicional_necessario <= max_ajuste_enunciado and g in (1, 3) or espaco_adicional_necessario <= 0 and g in (0, 2):
                espaco_sobrando_na_linha = abs(espaco_adicional_necessario)
                if espaco_adicional_necessario > ajuste_necessario:
                    tot_linhas_texto[g]['ajuste_necessario'] = max(espaco_adicional_necessario, 0)
                novo_texto_linha += palavra + adicao
            # Do contrário, pula para a próxima linha
            else:
                if espaco_sobrando_na_linha > linhas_texto['maior_espaco_sobrando']:
                   linhas_texto['maior_espaco_sobrando'] = espaco_sobrando_na_linha
                linhas_texto['linhas_texto'].append(novo_texto_linha.strip())
                texto_linha, novo_texto_linha, espaco_sobrando_na_linha = palavra + adicao, palavra + adicao, 0
            # Anexa a linha também no caso de ser a última palavra do texto
            if n == len(palavras) - 1:
                linhas_texto['linhas_texto'].append(novo_texto_linha.strip())
    melhor_espaco_sobrando = Window.width
    for n, dicionario in enumerate(tot_linhas_texto):
        if dicionario['maior_espaco_sobrando'] < melhor_espaco_sobrando:
            melhor_espaco_sobrando = dicionario['maior_espaco_sobrando']
            linhas_texto_escolhidas = dicionario['linhas_texto']
            ajuste_necessario = dicionario['ajuste_necessario']
            index_dict_escolhido = n
    for c, linha in enumerate(linhas_texto_escolhidas):
        lbl_enunciado = criar_label(layout=tela.layout_superior, font_size=tamanho_letra_padrao, size=tamanho_lbl_padrao, x=x_btn_esquerdo - ajuste_necessario / 2, center=[0, estrela.y - tamanho_letra_padrao / 2 - 0.15 * dist_vert_widgets - 1.5 * tamanho_letra_padrao * c], halign='left')
        tipo_espaco = "\u200A\u200A" if index_dict_escolhido in (0, 1) else "\u200A\u200A\u200A"
        tela.lbls_tela_quiz['ENUN'].append([lbl_enunciado, linha.replace(' ', tipo_espaco), 0])
    tela.desabilitar_toques_tela()
    Clock.schedule_interval(tela.animar_textos, constantes.tempos_animacoes[constantes.preferencias_usuario["velocidade_texto"]])

def identificar_possibilidades_linha_texto(tela, tamanho_letra_padrao, max_espaco_permitido, palavras):
    """Identifica se há possibilidade de puxar uma palavra da linha seguinte do texto para a linha de cima, puxando o texto um pouco mais para a esquerda para compensar a palavra a mais"""

    ajuste_necessario, linhas_texto, texto_linha, novo_texto_linha, palavras = 0, [], '', ''
    """lbl_adicionado = False"""


    for n, palavra in enumerate(palavras):
        adicao = '' if n == len(tela.pergunta_escolhida[1]['ENUN']) - 1 else ' '
        texto_linha += palavra + adicao
        lbl_teste = Label(text=texto_linha, font_size=tamanho_letra_padrao, size_hint=(None, None), center=Window.center, bold=True, outline_width=1.4 * tamanho_letra_padrao ** (1 / 3))

        lbl_teste.texture_update()
        espaco_utilizado = lbl_teste.texture_size[0]
        """
        print(f'Texto atual: {texto_linha}')
        print(f'Espaço utilizado: {espaco_utilizado}')"""
        # Se ainda há espaço suficiente para a palavra na linha atual
        espaco_adicional_necessario = espaco_utilizado - max_espaco_permitido
        
        if espaco_adicional_necessario <= max_ajuste_enunciado:

            if espaco_utilizado > max_espaco_permitido:
                print(f'O texto atual é {texto_linha} e o espaço utilizado é maior do que o permitido por padrão, mas menor do que o máximo de fato')


            if espaco_adicional_necessario > ajuste_necessario:
                ajuste_necessario = max(espaco_adicional_necessario, 0)
            novo_texto_linha += palavra + adicao
        
        # Do contrário, pula para a próxima linha
        else:
            linhas_texto.append(novo_texto_linha)
            texto_linha, novo_texto_linha = palavra + adicao, palavra + adicao
        # Anexa a linha também no caso de ser a última palavra do texto
        if n == len(palavras) - 1:
            linhas_texto.append(novo_texto_linha)
    """return possibilidades_texto"""
    
def criar_alternativas(tela):
    """Cria as alternativas das perguntas"""
    # Identifica as alternativas da pergunta
    texto_alternativas = [tela.pergunta_escolhida[1]['A)'], tela.pergunta_escolhida[1]['B)'], tela.pergunta_escolhida[1]['C)'], tela.pergunta_escolhida[1]['D)']]
    # Analisa como deverá posicionar os textos das alternativas
    tamanho_letra_padrao, espaco_disponivel_texto = opcoes_tamanho_letra[constantes.preferencias_usuario["tamanho_letra"]], Window.width - 2.6 * x_btn_esquerdo - comprimento_letra
    max_espaco_sobrando = ajuste_necessario = 0
    for texto in texto_alternativas:
        linhas_texto, caracteristicas_linhas = organizar_palavras(texto, tamanho_letra_padrao, espaco_disponivel_texto)
        cont, index_linha = 0, None
        """print(f'Características das linhas: {caracteristicas_linhas}')"""
        for espaco_ultrapassado, espaco_sobrando in caracteristicas_linhas:
            if espaco_sobrando >= max_espaco_sobrando:
                max_espaco_sobrando = espaco_sobrando
                espaco_adicional_necessario = espaco_ultrapassado
                if espaco_adicional_necessario <= max_ajuste_alternativas:
                    index_linha = cont
                    break
            cont += 1
        if index_linha is not None:
            """
            print(f'Linha alvo é {linhas_texto[index_linha]}')
            print(f'Espaço que eu necessitaria a mais é {espaco_adicional_necessario}')"""
            ajuste_necessario = max(ajuste_necessario, espaco_adicional_necessario)
    x_lbl = 1.8 * x_btn_esquerdo + comprimento_letra - ajuste_necessario / 4
    tela.letra_alternativa_selecionada = 'A'
    for c, texto in enumerate(texto_alternativas):
        if c == 0:
            centro_y_letra = tela.lbls_tela_quiz['ENUN'][-1][0].center_y - (tela.lbls_tela_quiz['ENUN'][-1][0].font_size + tamanho_fonte_textos) / 2 - 0.4 * dist_vert_widgets
            cor_textos = azul[1]
        else:
            centro_y_letra = tela.lbls_tela_quiz[tot_letras[c - 1]][-1][0].center_y - tamanho_fonte_textos - 0.4 * dist_vert_widgets
            cor_textos = (1, 1, 1, 1)
        # Textos das alternativas
        linhas_texto, _ = organizar_palavras(texto, tamanho_letra_padrao, espaco_disponivel_texto + ajuste_necessario)
        tela.lbls_tela_quiz[tot_letras[c]] = []
        for n, linha in enumerate(linhas_texto):
            # Letra da alternativa
            if n == 0:
                letra_alternativa = criar_label(layout=tela.layout_superior, color=cor_textos, x=x_btn_esquerdo - ajuste_necessario / 4, center=[0, centro_y_letra], size=tamanho_lbl_padrao, halign='left')
                tela.lbls_tela_quiz[tot_letras[c]].append([letra_alternativa, f"{tot_letras[c]})", 0])
            # Textos das alternativas
            texto_alternativa = criar_label(layout=tela.layout_superior, font_size=tamanho_letra_padrao, color=cor_textos, x=x_lbl, center=[0, letra_alternativa.center[1] - 1.5 * tamanho_letra_padrao * n], size=tamanho_lbl_padrao, halign='left')
            tela.lbls_tela_quiz[tot_letras[c]].append([texto_alternativa, linha, 0])
    # Botões para selecionar as alternativas
    for chave in tela.lbls_tela_quiz:
        if chave == 'ENUN':
            continue
        lbl_alternativa = tela.lbls_tela_quiz[chave][1][0]
        btn_selecao_alternativa= MyButton(layout=tela.layout_superior, x=0, center=lbl_alternativa.center, invisivel=True, funcao=tela.mudar_alternativa_selecionada)
        y_max_alternativa = tela.lbls_tela_quiz[chave][1][0].y + tela.lbls_tela_quiz[chave][-1][0].size[1] / 2 + tamanho_letra_padrao + 0.18 * dist_vert_widgets
        y_min_alternativa = tela.lbls_tela_quiz[chave][-1][0].y + tela.lbls_tela_quiz[chave][-1][0].size[1] / 2 - 0.18 * dist_vert_widgets
        btn_selecao_alternativa.btn.size = [Window.width, y_max_alternativa - y_min_alternativa]
        btn_selecao_alternativa.btn.y = y_min_alternativa - tamanho_letra_padrao / 2 
        btn_selecao_alternativa.btn.center_x = 0.5 * Window.width
        tela.btns_alternativas[chave] = btn_selecao_alternativa.btn
    """
    # Remove e adiciona labels das alternativas para ficar por cima do botão (para testes)
    for chave in tela.lbls_tela_quiz:
        if chave == 'ENUN':
            continue
        for (label, _, _) in tela.lbls_tela_quiz[chave]:
            tela.layout_superior.remove_widget(label)
            tela.layout_superior.add_widget(label)"""

def confirmar_resposta(tela):
    """Chama as alternativas ou confirma se a resposta enviada pelo usuário está correta ou avança para a próxima pergunta"""
    if tela.btn_confirmar in tela.botoes:
        # Se o usuário deseja chamar as alternativas
        if tela.btn_confirmar.lbl.text == 'Alternativas':
            som_botao_pressionado.play()
            tela.desabilitar_toques_tela()
            definir_espaco_necessario(tela)
            Clock.schedule_interval(tela.animar_textos, constantes.tempos_animacoes[constantes.preferencias_usuario["velocidade_texto"]])
        # Se o usuário deseja confirmar uma resposta
        elif tela.btn_confirmar.lbl.text == 'Confirmar':
            tela.caixa_texto_feedback.disabled = False
            redefinir_layout(tela.layout_inferior, [], [tela.btn_finalizar.btn, tela.btn_finalizar.lbl])
            tela.desabilitar_toques_tela()
            pergunta_acertada = analisar_resposta(tela)
            # Se estiver no modo desafio, registra o progresso no desafio
            programar_habilitacao_toques = registrar_progresso_desafio(pergunta_acertada, tela)
            registrar_resposta(tela)
            if programar_habilitacao_toques:
                tela.programar_habilitacao_toques()
        # Se o usuário deseja avançar para a próxima pergunta
        elif not tela.caixa_texto_feedback.focus:
            som_botao_pressionado.play()
            criar_nova_pergunta(tela)
        redesenhar_tela(tela)

def analisar_resposta(tela):
    letra_marcada, letra_correta = tela.letra_alternativa_selecionada, tela.pergunta_escolhida[1]['RESP_COR']
    # Caso a resposta esteja correta
    if letra_marcada == letra_correta:
        som_botao_pressionado.play()
        pergunta_acertada = True
    # Caso a resposta esteja errada
    else:
        som_erro.play()
        pergunta_acertada = False
        for (label, _, _) in tela.lbls_tela_quiz[tela.letra_alternativa_selecionada]:
            label.color = (1, 0, 0, 1)
    for (label, _, _) in tela.lbls_tela_quiz[letra_correta]:
        label.color = (0, 1, 0, 1)
    constantes.perguntas_filtradas[constantes.dificuldade_pergunta].remove(tela.pergunta_escolhida)
    tela.btn_confirmar.lbl.text = 'Próxima'
    constantes.q_perguntas_filtradas[tot_niveis.index(constantes.dificuldade_pergunta)] -= 1
    # Atualiza o número de perguntas restantes
    tela.lbl_perguntas_restantes.text = f'[color={constantes.verde[0]}]{constantes.q_perguntas_filtradas[0]}[/color]/[color={constantes.amarelo[0]}]{constantes.q_perguntas_filtradas[1]}[/color]/[color={constantes.vermelho[0]}]{constantes.q_perguntas_filtradas[2]}[/color]'
    comprimento_perguntas_restantes = font_textos.getmask(f'{constantes.q_perguntas_filtradas[0]}/III{constantes.q_perguntas_filtradas[1]}/II{constantes.q_perguntas_filtradas[2]}').getbbox()[2]
    tela.lbl_perguntas_restantes.x = Window.width - comprimento_perguntas_restantes - x_btn_esquerdo
    texto_dificuldade = constantes.dificuldade_pergunta.lower()
    # Esta variável pode ser armazenada nas constantes
    cor_pergunta_atual = constantes.cores[tot_niveis.index(constantes.dificuldade_pergunta)][0]
    tela.lbl_tema_dificuldade.text = f'[color={cor_pergunta_atual}]{constantes.tema_escolhido} ({texto_dificuldade})[/color]'
    # Remove o botão de confirmação caso as perguntas tenham acabado
    if constantes.q_perguntas_filtradas[0] + constantes.q_perguntas_filtradas[1] + constantes.q_perguntas_filtradas[2] == 0:
        redefinir_layout(tela.layout_inferior, [tela.btn_confirmar.lbl, tela.btn_confirmar.btn], [])
    # Coloca as estrelas para enviar feedback
    centro_y_estrelas = tela.lbls_tela_quiz['D'][-1][0].y + tela.lbls_tela_quiz['D'][-1][0].size[1] / 2 - tela.estrelas_feedback[0][1].size[1] - 0.4 * dist_vert_widgets
    constantes.q_estrelas_marcadas = tela.pergunta_escolhida[1]["AVA_USU"]
    marcar_estrelas(None, tela.pergunta_escolhida[1]["AVA_USU"] - 1)
    for g, (btn_estrela, img_estrela) in enumerate(tela.estrelas_feedback):
        btn_estrela.btn.center = img_estrela.center = [tamanho_img_estrela[0] / 2 + espaco_disponivel_hori_estrelas / 6 + (espaco_disponivel_hori_estrelas / 6 + tamanho_img_estrela[0]) * g, centro_y_estrelas]
        tela.layout_superior.add_widget(img_estrela)
    # Coloca e posiciona a caixa de texto para enviar feedback
    tela.layout_superior.add_widget(tela.caixa_texto_feedback)
    tela.caixa_texto_feedback.y = tela.estrelas_feedback[0][1].y - tela.caixa_texto_feedback.size[1] - 0.24 * dist_vert_widgets
    # Coloca feedback anterior do usuário caso tenha
    tela.caixa_texto_feedback.text = tela.pergunta_escolhida[1]["COMENTÁRIO"]
    # Coloca o botão para enviar feedback
    redefinir_layout(tela.layout_superior, [], [tela.btn_enviar_feedback.btn, tela.btn_enviar_feedback.lbl])
    tela.btn_enviar_feedback.btn.y = tela.caixa_texto_feedback.y - tela.btn_enviar_feedback.btn.size[1] - espessura_contorno - 0.24 * dist_vert_widgets
    # Expande a scroll da tela para caber os widgets de feedback
    y_ultimo_widget = tela.btn_enviar_feedback.btn.y - espessura_contorno - 0.24 * dist_vert_widgets
    if y_ultimo_widget < 0:
        tela.layout_superior.height += abs(y_ultimo_widget)
        for widget in tela.layout_superior.children:
            widget.y += abs(y_ultimo_widget)
    # Organiza o dicionário de ids de perguntas embaralhadas e o de id de perguntas erradas
    id_pergunta, nivel = tela.pergunta_escolhida[0], tela.pergunta_escolhida[2]
    if not pergunta_acertada and id_pergunta in constantes.ids_perguntas_embaralhados[constantes.tema_escolhido][nivel] and id_pergunta not in constantes.ids_perguntas_erradas[constantes.tema_escolhido][nivel]:
        constantes.ids_perguntas_embaralhados[constantes.tema_escolhido][nivel].remove(id_pergunta)
        constantes.ids_perguntas_erradas[constantes.tema_escolhido][nivel].append(id_pergunta)
    elif pergunta_acertada and id_pergunta in constantes.ids_perguntas_erradas[constantes.tema_escolhido][nivel] and id_pergunta not in constantes.ids_perguntas_embaralhados[constantes.tema_escolhido][nivel]:
        constantes.ids_perguntas_erradas[constantes.tema_escolhido][nivel].remove(id_pergunta)
        constantes.ids_perguntas_embaralhados[constantes.tema_escolhido][nivel].append(id_pergunta)
    return pergunta_acertada

def marcar_estrelas(instance, index_estrela=None):
    tela = constantes.tela_quiz
    if not tela.lbl_feedback_enviado.parent:
        # Identifica o index da estrela marcada
        if index_estrela is None:
            for c, (class_btn, _) in enumerate(tela.estrelas_feedback):
                if class_btn.btn == instance:
                    index_estrela = c
                    break
        # Escolhe quais estrelas ficam douradas e quais ficam brancas
        for c, (class_btn, img) in enumerate(tela.estrelas_feedback):
            if c <= index_estrela:
                img.source = estrela_marcada
            else:
                img.source = estrela_desmarcada
        constantes.q_estrelas_marcadas = index_estrela + 1

def registrar_resposta(tela):
    """Atualiza a resposta do usuário no arquivo de perguntas e atualiza estatísticas de acertos"""
    resposta_enviada = tela.letra_alternativa_selecionada
    id_pergunta_atual = tela.pergunta_escolhida[0]
    dic_perguntas = constantes.dados_tema[constantes.dificuldade_pergunta]
    if constantes.modo_de_jogo in ('Prática', 'Desafio'):
        for id_pergunta in dic_perguntas:
            if id_pergunta == id_pergunta_atual:
                dic_perguntas[id_pergunta]['RESP_USU'] = dic_perguntas[id_pergunta]['ULT_RESP'] = resposta_enviada
                break
    elif constantes.modo_de_jogo == 'Revisão':
        for id_pergunta in dic_perguntas:
            if id_pergunta == id_pergunta_atual:
                dic_perguntas[id_pergunta]['ULT_RESP'] = resposta_enviada
                break
    escrever_arquivo_json(constantes.caminho_arquivo, constantes.dados_tema)

def registrar_progresso_desafio(pergunta_acertada, tela):
    """Faz todas as alterações necessárias no arquivo de perfil após o envio de uma resposta no modo desafio"""
    programar_habilitacao_toques = True
    if constantes.modo_de_jogo == 'Desafio':
        info_perfil = carregar_arquivo_json('Perfil/Perfil')
        # Atualiza a quantidade de respostas enviadas e o número de acertos (caso tenha acertado a pergunta)
        if constantes.dificuldade_pergunta == 'Fácil':
            info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_faceis_respondidas"] += 1
            if pergunta_acertada:
                info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_faceis_acertadas"] += 1
        elif constantes.dificuldade_pergunta == 'Médio':
            info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_medias_respondidas"] += 1
            if pergunta_acertada:
                info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_medias_acertadas"] += 1
        else:
            info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_dificeis_respondidas"] += 1
            if pergunta_acertada:
                info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_dificeis_acertadas"] += 1
        escrever_arquivo_json('Perfil/Perfil', info_perfil)
        # Quantidade de acertos atuais
        acertos_atuais = info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_faceis_acertadas"] + info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_medias_acertadas"] + info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_dificeis_acertadas"]
        # Quantidade de perguntas que faltam para completar o desafio
        q_perguntas_restantes = info_perfil["progresso_desafio"][constantes.tema_escolhido][constantes.ranking_atual]["perguntas_faceis"] + info_perfil["progresso_desafio"][constantes.tema_escolhido][constantes.ranking_atual]["perguntas_medias"] + info_perfil["progresso_desafio"][constantes.tema_escolhido][constantes.ranking_atual]["perguntas_dificeis"] - info_perfil["progresso_desafio"][constantes.tema_escolhido]['perguntas_faceis_respondidas'] - info_perfil["progresso_desafio"][constantes.tema_escolhido]['perguntas_medias_respondidas'] - info_perfil["progresso_desafio"][constantes.tema_escolhido]['perguntas_dificeis_respondidas']
        # Necessidade atual de acertos para atingir os objetivos
        acertos_para_manter_ranking = info_perfil["progresso_desafio"][constantes.tema_escolhido]["acertos_para_manter_ranking"]
        acertos_para_promover_ranking = info_perfil["progresso_desafio"][constantes.tema_escolhido]["acertos_para_promover_ranking"]
        if constantes.ranking_atual == 'Lenda':
            acertos_para_manter_ranking += 2
        necessidade_acertos_para_manter = acertos_para_manter_ranking - acertos_atuais
        necessidade_acertos_para_promover = acertos_para_promover_ranking - acertos_atuais
        # Analisa se a próxima meta foi alcançada
        redefinir_layout(tela.layout_modal, [*tela.lbls_modal], [])
        index_ranking_atual = constantes.rankings.index(constantes.ranking_atual)
        if pergunta_acertada:
            # Analisa se a meta de manter ranking foi alcançada
            if acertos_atuais == acertos_para_manter_ranking and constantes.ranking_atual != 'Iniciante':
                tela.modal.open()
                programar_habilitacao_toques = False
                criar_lbls_mudanca_ranking(tela, f'Ranking garantido: {constantes.ranking_atual}', 'Manutenção')
                if constantes.ranking_atual == 'Lenda' or q_perguntas_restantes < necessidade_acertos_para_promover:
                    atualizar_ranking(info_perfil, constantes.ranking_atual, tela, zerar_sequencia=False)
                info_perfil = carregar_arquivo_json('Perfil/Perfil')
                info_perfil["progresso_desafio"][constantes.tema_escolhido]["sequencia_manutencao_ranking"] += 1
                escrever_arquivo_json('Perfil/Perfil', info_perfil)
            # Analisa se a meta de promoção de ranking foi alcançada
            elif acertos_atuais == acertos_para_promover_ranking and constantes.ranking_atual != 'Lenda':
                tela.modal.open()
                programar_habilitacao_toques = False
                novo_ranking = constantes.rankings[index_ranking_atual + 1]
                criar_lbls_mudanca_ranking(tela, f'Novo ranking: {novo_ranking}', 'Promoção')
                atualizar_ranking(info_perfil, novo_ranking, tela)
        # Analisa se não tem como mais alcançar alguma meta
        else:
            # Caso não haja mais possibilidade de ser promovido
            if q_perguntas_restantes == necessidade_acertos_para_promover - 1 and constantes.ranking_atual != 'Lenda':
                tela.modal.open()
                programar_habilitacao_toques = False
                criar_lbls_mudanca_ranking(tela, 'Não é mais possível promover')
                if constantes.ranking_atual == 'Iniciante' or acertos_atuais >= acertos_para_manter_ranking:
                    atualizar_ranking(info_perfil, constantes.ranking_atual, tela, zerar_sequencia=False)
            # Caso não haja mais possibilidade de manter ranking (caso de rebaixamento de ranking)
            if q_perguntas_restantes == necessidade_acertos_para_manter - 1 and constantes.ranking_atual != 'Iniciante':
                tela.modal.open()
                programar_habilitacao_toques = False
                novo_ranking = constantes.rankings[index_ranking_atual - 1]
                criar_lbls_mudanca_ranking(tela, f'Novo ranking: {novo_ranking}', 'Rebaixamento')
                atualizar_ranking(info_perfil, novo_ranking, tela)
    return programar_habilitacao_toques

def atualizar_ranking(info_perfil, novo_ranking, tela, zerar_sequencia=True):
    redefinir_layout(tela.layout_inferior, [tela.btn_confirmar.btn, tela.btn_confirmar.lbl], [])
    del info_perfil["progresso_desafio"][constantes.tema_escolhido][constantes.ranking_atual]
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["ranking_atual"] = novo_ranking
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_faceis_respondidas"] = 0
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_medias_respondidas"] = 0
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_dificeis_respondidas"] = 0
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_faceis_acertadas"] = 0
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_medias_acertadas"] = 0
    info_perfil["progresso_desafio"][constantes.tema_escolhido]["perguntas_dificeis_acertadas"] = 0
    if zerar_sequencia:
        info_perfil["progresso_desafio"][constantes.tema_escolhido]["sequencia_manutencao_ranking"] = 0
    escrever_arquivo_json('Perfil/Perfil', info_perfil)

def criar_lbls_mudanca_ranking(tela, texto, mudanca_ocorrida='Aviso'):
    if mudanca_ocorrida == 'Rebaixamento':
        cor = vermelho[1]
    elif mudanca_ocorrida == 'Manutenção':
        cor = amarelo[1]
    elif mudanca_ocorrida == 'Promoção':
        cor = verde[1]
    else:
        cor = (1, 1, 1, 1)
    lbl_modal = criar_label(layout=tela.layout_modal, text=texto, font_size=tamanho_fonte_textos, center=[Window.center[0], Window.center[1] + tela.layout_modal.size[1] / 2 - 0.28 * tela.layout_modal.size[1]], color=cor)
    tela.lbls_modal.append(lbl_modal)

def remover_widgets_tela_quiz(tela):
    # Remove o enunciado e as alternativas da pergunta anterior
    for chave in tela.lbls_tela_quiz:
        for [label, _, _] in tela.lbls_tela_quiz[chave]:
            redefinir_layout(tela.layout_superior, [label], [])
    # Remove os botões das alternativas
    for chave in tela.btns_alternativas:
        if tela.btns_alternativas[chave] is not None:
            redefinir_layout(tela.layout_superior, [tela.btns_alternativas[chave]], [])
    # Remove as estrelas de feedback
    if tela.estrelas_feedback[0][1].parent:
        for (_, img) in tela.estrelas_feedback:
            tela.layout_superior.remove_widget(img)
            img.source = estrela_desmarcada
    constantes.q_estrelas_marcadas = 0
    # Remove a caixa de texto de feedback e o botão de feedback
    redefinir_layout(tela.layout_superior, [tela.caixa_texto_feedback, tela.btn_enviar_feedback, tela.lbl_feedback_enviado], [])

def posicionar_widgets_tela_quiz(tela):
    """Posiciona corretamente os widgets da tela de quiz"""
    # Define a posição e o texto da label que indica tema e dificuldade da pergunta atual
    cor_pergunta_atual = constantes.cores[tot_niveis.index(constantes.dificuldade_pergunta)][0]
    texto_dificuldade = constantes.dificuldade_pergunta.lower()
    tela.lbl_tema_dificuldade.text = f'[color={cor_pergunta_atual}]{constantes.tema_escolhido} ({texto_dificuldade})[/color]'
    # Define a posição e o texto da label que indica a quantidade de perguntas restantes
    tela.lbl_perguntas_restantes.text = f'[color={constantes.verde[0]}]{constantes.q_perguntas_filtradas[0]}[/color]/[color={constantes.amarelo[0]}]{constantes.q_perguntas_filtradas[1]}[/color]/[color={constantes.vermelho[0]}]{constantes.q_perguntas_filtradas[2]}[/color]'
    comprimento_perguntas_restantes = font_textos.getmask(f'{constantes.q_perguntas_filtradas[0]}/III{constantes.q_perguntas_filtradas[1]}/II{constantes.q_perguntas_filtradas[2]}').getbbox()[2]
    tela.lbl_perguntas_restantes.x = Window.width - comprimento_perguntas_restantes - x_btn_esquerdo
    tela.lbl_tema_dificuldade.center_y = tela.lbl_perguntas_restantes.center_y = tela.layout_superior.height - tamanho_fonte_textos / 2 - 0.02 * Window.height
    # Analisa a média de avaliações para a pergunta arredondando para múltiplos de 0.5
    avaliacao_media_da_pergunta, media_avaliacao_arredondada = tela.pergunta_escolhida[1]['AVA_MED'], 0
    if avaliacao_media_da_pergunta > 0:
        parte_inteira = str(f"{avaliacao_media_da_pergunta:.2f}")[0]
        casas_decimais = str(f"{avaliacao_media_da_pergunta:.2f}")[2:]
        if int(casas_decimais) > 75:
            parte_inteira = int(parte_inteira) + 1
            casas_decimais = 0
        elif 25 <= int(casas_decimais) <= 75:
            parte_inteira = int(parte_inteira)
            casas_decimais = 5
        else:
            parte_inteira = int(parte_inteira)
            casas_decimais = 0
        media_avaliacao_arredondada = parte_inteira + casas_decimais / 10
    # Posiciona verticalmente as estrelas de avaliação média e define quais ficarão douradas
    for g, estrela in enumerate(tela.estrelas_avaliacao_media):
        estrela.center_y = tela.lbl_tema_dificuldade.center_y - (tela.lbl_tema_dificuldade.font_size + estrela.size[1] ) / 2 - 0.4 * dist_vert_widgets
        if g + 1 <= media_avaliacao_arredondada:
            estrela.source = estrela_marcada
        elif g == media_avaliacao_arredondada - 0.5:
            estrela.source = meia_estrela_marcada
        else:
            estrela.source = estrela_desmarcada
    return estrela

def organizar_palavras(texto, tamanho_fonte, max_espaco):
    """Organiza os textos compridos em linhas separadas"""
    palavra, texto_linha, novo_texto_linha, linhas_texto = '', '', '', []
    espaco_utilizado, palavras_na_linha, caracteristicas_linha, palavras = None, 0, [], texto.split()
    font_funcao = ImageFont.truetype('fonts/Roboto-Regular.ttf', round(tamanho_fonte))
    comprimento_do_espaco = font_funcao.getmask('l').getbbox()[2]
    for n, palavra in enumerate(palavras):
        palavras_na_linha += 1
        adicao = '' if n == len(texto) - 1 else ' '
        texto_linha += palavra + adicao
        # Analisa o espaço sobrando até o final da linha
        espaco_sobrando_na_linha = 0
        if espaco_utilizado is not None:
            espaco_sobrando_na_linha = max_espaco - espaco_utilizado
        espaco_utilizado_pelos_espacos = (palavras_na_linha - 1) * comprimento_do_espaco
        espaco_utilizado = font_funcao.getmask(texto_linha).getbbox()[2] + espaco_utilizado_pelos_espacos
        # Se ainda há espaço suficiente para a palavra na linha atual
        if espaco_utilizado <= max_espaco:
            novo_texto_linha += palavra + adicao
        # Do contrário, pula para a próxima linha
        else:
            caracteristicas_linha.append((espaco_utilizado - max_espaco, espaco_sobrando_na_linha))
            linhas_texto.append(novo_texto_linha)
            tamanho_fonte, texto_linha, novo_texto_linha = tamanho_fonte, palavra + adicao, palavra + adicao
            palavras_na_linha = 0
        # Anexa a linha também no caso de ser a última palavra do texto
        if n == len(palavras) - 1:
            linhas_texto.append(novo_texto_linha)
    return linhas_texto, caracteristicas_linha

def definir_espaco_necessario(tela):
    """Define o espaço vertical necessário na scroll que contém o questionário"""
    y_ultimo_widget = tela.lbls_tela_quiz['D'][-1][0].y
    if y_ultimo_widget < 0:
        tela.layout_superior.height += abs(y_ultimo_widget)
        for widget in tela.layout_superior.children:
            widget.y += abs(y_ultimo_widget)

def carregar_arquivo_json(caminho_arquivo_sem_extensao, identificacao_erro=''):
    if 'Perfil/' in caminho_arquivo_sem_extensao or 'Perguntas/' in caminho_arquivo_sem_extensao:
        caminho_base = os.path.join(base_dir, caminho_arquivo_sem_extensao)
    else:
        caminho_base = os.path.join('', caminho_arquivo_sem_extensao)
    try:
        with open(f'{caminho_base}.json', 'r', encoding='utf-8') as f:
            dados_tema = json.load(f)
            return dados_tema
    except FileNotFoundError as e:
        tratamento_erros.erros_identificados.append(f"({identificacao_erro}){str(e)}")
        tratamento_erros.exibir_erro()
        return None
    except json.decoder.JSONDecodeError as e:
        tratamento_erros.erros_identificados.append(f"({identificacao_erro}){str(e)}")
        tratamento_erros.exibir_erro()
        return None

def escrever_arquivo_json(caminho_arquivo_sem_extensao, novo_conteudo, identificacao_erro=''):
    caminho_arquivo_json = os.path.join(base_dir, f"{caminho_arquivo_sem_extensao}.json")
    caminho_arquivo_temporario = os.path.join(base_dir, f"{caminho_arquivo_sem_extensao}.tmp")
    caminho_arquivo_backup = os.path.join(base_dir, f"{caminho_arquivo_sem_extensao}.bak")
    try:
        # Cria um backup do arquivo original
        if os.path.exists(caminho_arquivo_json):
            shutil.copyfile(caminho_arquivo_json, caminho_arquivo_backup)
        # Escreve no arquivo temporário
        with open(caminho_arquivo_temporario, 'w', encoding='utf-8') as f_temp:
            json.dump(novo_conteudo, f_temp, ensure_ascii=False, indent=4)
        os.replace(caminho_arquivo_temporario, caminho_arquivo_json)
        # Se a operação foi bem sucedida, remove o arquivo de backup
        if os.path.exists(caminho_arquivo_backup):
            os.remove(caminho_arquivo_backup)
    except IOError as e:
        tratamento_erros.erros_identificados.append(f"({identificacao_erro}){str(e)}")
        tratamento_erros.exibir_erro()
        # Deleta o arquivo temporário
        if os.path.exists(caminho_arquivo_temporario):
            os.remove(caminho_arquivo_temporario)
        # Utiliza o arquivo de backup para restaurar o arquivo original
        if os.path.exists(caminho_arquivo_backup):
            os.replace(caminho_arquivo_backup, caminho_arquivo_json)
    except Exception as e:
        tratamento_erros.erros_identificados.append(f"({identificacao_erro}){str(e)}")
        tratamento_erros.exibir_erro()
        # Deleta o arquivo temporário
        if os.path.exists(caminho_arquivo_temporario):
            os.remove(caminho_arquivo_temporario)
        # Utiliza o arquivo de backup para restaurar o arquivo original
        if os.path.exists(caminho_arquivo_backup):
            os.replace(caminho_arquivo_backup, caminho_arquivo_json)

def remover_acentos(texto):
    nfkd_form = unicodedata.normalize('NFKD', texto)
    apenas_ascii = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return apenas_ascii.encode('utf-8', 'ignore').decode('utf-8')

def criar_imagem(nome_imagem, layout=None, size_hint=[None, None], size=[100, 100], pos_hint=None, x=None, y=None, center=[0, 0], fit_mode='contain'):
    img = Image(source=nome_imagem, size_hint=size_hint, size=size)
    img.fit_mode = fit_mode
    definir_posicao_widget(img, layout, pos_hint, x, y, center)
    return img

def criar_scrollview_tipo1():
    sv = ScrollView(do_scroll_x=False, do_scroll_y=True, scroll_distance=0, scroll_timeout=2000, effect_cls='ScrollEffect', bar_width=0.01 * Window.height, bar_color=constantes.cor_bg_botao, bar_inactive_color=constantes.cor_bg_botao, scroll_wheel_distance=35, smooth_scroll_end=40)
    return sv
