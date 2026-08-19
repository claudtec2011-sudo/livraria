# scanner.py
import os
import re
from datetime import datetime
import shutil

class ScannerLivros:
    """Classe para escanear automaticamente a pasta de livros"""
    
    def __init__(self, pasta_livros='livros', pasta_destino='uploads/livros'):
        self.pasta_livros = pasta_livros
        self.pasta_destino = pasta_destino
        self.livros_encontrados = []
        
        # Criar pastas se não existirem
        os.makedirs(pasta_livros, exist_ok=True)
        os.makedirs(pasta_destino, exist_ok=True)
    
    def extrair_info_arquivo(self, nome_arquivo):
        """
        Extrai título e preço do nome do arquivo
        - Com valor: 'Plano_45_Dias_Angola_Completo1200.pdf' → Preço: R$ 12.00
        - Sem valor: 'livro-gratuito.pdf' → Preço: R$ 0.00 (GRATUITO)
        """
        # Remover extensão
        nome_sem_extensao = os.path.splitext(nome_arquivo)[0]
        
        # Tentar diferentes padrões para encontrar preço
        padroes = [
            r'^(.+?)-(\d+)$',  # bem-viver-1500
            r'^(.+?)(\d+)$',   # Plano_45_Dias_Angola_Completo1200
            r'^([A-Za-z_\s]+?)(\d+)$'  # plano45dias1500
        ]
        
        preco_encontrado = False
        preco_centavos = 0
        titulo_raw = nome_sem_extensao
        
        for padrao in padroes:
            match = re.match(padrao, nome_sem_extensao)
            if match:
                titulo_raw = match.group(1)
                preco_centavos = int(match.group(2))
                preco_encontrado = True
                break
        
        # Limpar título
        titulo = titulo_raw.replace('_', ' ').replace('-', ' ').strip()
        # Capitalizar palavras
        palavras = titulo.split()
        titulo = ' '.join([p.capitalize() for p in palavras])
        
        # Se não encontrou preço, é gratuito
        if not preco_encontrado:
            preco = 0.0
            eh_gratuito = True
        else:
            preco = preco_centavos / 100
            eh_gratuito = False
        
        return {
            'titulo': titulo,
            'preco': preco,
            'nome_original': nome_arquivo,
            'preco_centavos': preco_centavos,
            'eh_gratuito': eh_gratuito
        }
    
    def extrair_autor_categoria(self, titulo):
        """Tenta extrair autor e categoria do título"""
        # Detectar autor
        autores = {
            'angola': 'Angola',
            'machado': 'Machado de Assis',
            'assis': 'Machado de Assis',
            'suntzu': 'Sun Tzu',
            'saint': 'Saint-Exupéry',
            'python': 'Python',
            'javascript': 'JavaScript',
            'java': 'Java',
            'php': 'PHP',
            'gratuito': 'Autor Desconhecido',
            'free': 'Autor Desconhecido'
        }
        
        autor = 'Autor Desconhecido'
        titulo_lower = titulo.lower()
        
        for chave, nome_autor in autores.items():
            if chave in titulo_lower:
                autor = nome_autor
                break
        
        # Detectar categoria
        categorias = {
            'Educação': ['plano', 'curso', 'aprendizado', 'educação', 'dias', 'angola'],
            'Técnico': ['programação', 'python', 'javascript', 'sql', 'java', 'c++', 'php', 'code'],
            'Ficção': ['romance', 'conto', 'novela', 'ficção', 'fantasia'],
            'Filosofia': ['filosofia', 'ética', 'lógica', 'pensamento'],
            'Ciência': ['ciência', 'física', 'química', 'biologia', 'matemática'],
            'História': ['história', 'histórico', 'antigo', 'passado'],
            'Literatura': ['literatura', 'poesia', 'verso', 'poema'],
            'Gratuito': ['gratuito', 'free', 'sample', 'demo', 'amostra']
        }
        
        categoria = 'Geral'
        for cat, palavras in categorias.items():
            for palavra in palavras:
                if palavra in titulo_lower:
                    categoria = cat
                    break
            if categoria != 'Geral':
                break
        
        return autor, categoria
    
    def escanear_pasta(self):
        """Escaneia a pasta de livros e retorna lista de informações"""
        self.livros_encontrados = []
        
        if not os.path.exists(self.pasta_livros):
            print(f"⚠️ Pasta '{self.pasta_livros}' não encontrada. Criando...")
            os.makedirs(self.pasta_livros)
            return []
        
        arquivos = os.listdir(self.pasta_livros)
        arquivos_pdf = [f for f in arquivos if f.lower().endswith('.pdf')]
        
        print(f"📚 Encontrados {len(arquivos_pdf)} arquivos PDF")
        
        for arquivo in arquivos_pdf:
            caminho_origem = os.path.join(self.pasta_livros, arquivo)
            
            # Extrair informações do nome do arquivo
            info = self.extrair_info_arquivo(arquivo)
            
            # Extrair autor e categoria
            autor, categoria = self.extrair_autor_categoria(info['titulo'])
            
            # Copiar arquivo para a pasta de uploads
            nome_destino = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{arquivo}"
            caminho_destino = os.path.join(self.pasta_destino, nome_destino)
            
            # Verificar se já existe e copiar
            if not os.path.exists(caminho_destino):
                shutil.copy2(caminho_origem, caminho_destino)
            else:
                # Se já existe, verificar se o arquivo de origem é mais novo
                if os.path.getmtime(caminho_origem) > os.path.getmtime(caminho_destino):
                    shutil.copy2(caminho_origem, caminho_destino)
            
            # Determinar se é gratuito
            eh_gratuito = info['eh_gratuito'] or info['preco'] == 0
            
            livro_info = {
                'id': str(abs(hash(arquivo)) % 100000),
                'titulo': info['titulo'],
                'autor': autor,
                'preco': info['preco'],
                'quantidade': 10 if not eh_gratuito else 999,  # Gratuitos têm "estoque infinito"
                'categoria': categoria,
                'arquivo_pdf': nome_destino,
                'nome_original': arquivo,
                'data_cadastro': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'eh_gratuito': eh_gratuito
            }
            
            self.livros_encontrados.append(livro_info)
            
            if eh_gratuito:
                print(f"  🎁 {info['titulo']} - GRATUITO!")
            else:
                print(f"  ✅ {info['titulo']} - R$ {info['preco']:.2f} ({categoria})")
        
        return self.livros_encontrados
    
    def salvar_no_banco(self, app, db):
        """Salva os livros escaneados no banco de dados"""
        from models import Livro
        
        with app.app_context():
            livros_adicionados = 0
            livros_atualizados = 0
            
            for info in self.livros_encontrados:
                # Verificar se o livro já existe pelo título
                livro_existente = Livro.query.filter_by(titulo=info['titulo']).first()
                
                if livro_existente:
                    # Verificar se mudou algo
                    mudou = False
                    
                    if livro_existente.preco != info['preco']:
                        livro_existente.preco = info['preco']
                        mudou = True
                    
                    if livro_existente.autor != info['autor']:
                        livro_existente.autor = info['autor']
                        mudou = True
                    
                    if livro_existente.categoria != info['categoria']:
                        livro_existente.categoria = info['categoria']
                        mudou = True
                    
                    if livro_existente.arquivo_pdf != info['arquivo_pdf']:
                        livro_existente.arquivo_pdf = info['arquivo_pdf']
                        mudou = True
                    
                    if livro_existente.eh_gratuito != info['eh_gratuito']:
                        livro_existente.eh_gratuito = info['eh_gratuito']
                        mudou = True
                    
                    if mudou:
                        livros_atualizados += 1
                        print(f"  🔄 Atualizado: {info['titulo']}")
                else:
                    # Criar novo livro
                    novo_livro = Livro(
                        id=info['id'],
                        titulo=info['titulo'],
                        autor=info['autor'],
                        preco=info['preco'],
                        quantidade=info['quantidade'],
                        categoria=info['categoria'],
                        arquivo_pdf=info['arquivo_pdf'],
                        eh_gratuito=info['eh_gratuito']
                    )
                    db.session.add(novo_livro)
                    livros_adicionados += 1
                    
                    if info['eh_gratuito']:
                        print(f"  🎁 Adicionado: {info['titulo']} - GRATUITO!")
                    else:
                        print(f"  ✅ Adicionado: {info['titulo']}")
            
            db.session.commit()
            
            print(f"\n📊 Resumo:")
            print(f"  ✅ {livros_adicionados} livros adicionados")
            print(f"  🔄 {livros_atualizados} livros atualizados")
            print(f"  📚 Total: {len(self.livros_encontrados)} livros processados")
            
            return {
                'adicionados': livros_adicionados,
                'atualizados': livros_atualizados,
                'total': len(self.livros_encontrados)
            }

def carregar_livros_automaticamente(app, db):
    """Função principal para carregar livros automaticamente"""
    scanner = ScannerLivros()
    livros = scanner.escanear_pasta()
    
    if livros:
        return scanner.salvar_no_banco(app, db)
    else:
        return None
