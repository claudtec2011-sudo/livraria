import os
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
from datetime import datetime
import uuid

# Importar modelos e scanner
from models import db, Livro, Venda, Pagamento
from scanner import carregar_livros_automaticamente


# ==================== CONFIGURAÇÃO ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INSTANCE_PATH = os.path.join(BASE_DIR, 'instance')
UPLOAD_PATH = os.path.join(BASE_DIR, 'uploads')
PASTA_LIVROS_ORIGEM = os.path.join(BASE_DIR, 'livros')

# Criar pastas
for pasta in [INSTANCE_PATH, UPLOAD_PATH, 
              os.path.join(UPLOAD_PATH, 'livros'),
              os.path.join(UPLOAD_PATH, 'comprovantes'),
              PASTA_LIVROS_ORIGEM]:
    if not os.path.exists(pasta):
        os.makedirs(pasta)
        print(f"📁 Pasta criada: {pasta}")

# ==================== APP ====================
app = Flask(__name__, static_folder='static', template_folder='templates')

app.config['SECRET_KEY'] = 'livraria_secret_2026'
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(INSTANCE_PATH, "livraria.db")}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = UPLOAD_PATH
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024

CORS(app)
db.init_app(app)

# ==================== FUNÇÕES ====================
def gerar_id():
    return str(uuid.uuid4())[:8]

def salvar_arquivo(file, pasta):
    if file and file.filename:
        filename = secure_filename(file.filename)
        nome_unico = f"{gerar_id()}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{filename}"
        caminho = os.path.join(app.config['UPLOAD_FOLDER'], pasta, nome_unico)
        file.save(caminho)
        return nome_unico
    return None

# ==================== ROTAS PRINCIPAIS ====================
@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/static/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

@app.route('/uploads/<path:path>')
def upload_files(path):
    return send_from_directory('uploads', path)

# ==================== API LIVROS ====================
@app.route('/api/livros', methods=['GET'])
def listar_livros():
    livros = Livro.query.order_by(Livro.data_cadastro.desc()).all()
    return jsonify([livro.to_dict() for livro in livros])

@app.route('/api/livros/<id>', methods=['GET'])
def buscar_livro(id):
    livro = Livro.query.get(id)
    if not livro:
        return jsonify({'error': 'Livro não encontrado'}), 404
    return jsonify(livro.to_dict())

@app.route('/api/livros', methods=['POST'])
def adicionar_livro():
    data = request.json
    
    if not data.get('titulo') or not data.get('autor'):
        return jsonify({'error': 'Título e autor são obrigatórios'}), 400
    
    eh_gratuito = data.get('eh_gratuito', False) or data.get('preco', 0) == 0
    
    livro = Livro(
        id=gerar_id(),
        titulo=data['titulo'],
        autor=data['autor'],
        preco=float(data.get('preco', 0)),
        quantidade=int(data.get('quantidade', 999 if eh_gratuito else 10)),
        categoria=data.get('categoria', 'Geral'),
        arquivo_pdf=data.get('arquivo_pdf'),
        eh_gratuito=eh_gratuito
    )
    
    db.session.add(livro)
    db.session.commit()
    return jsonify(livro.to_dict()), 201

# ==================== ROTA PUT CORRIGIDA ====================
@app.route('/api/livros/<id>', methods=['PUT'])
def atualizar_livro(id):
    try:
        print(f"📥 Recebendo requisição PUT para ID: {id}")
        
        livro = Livro.query.get(id)
        if not livro:
            print(f"❌ Livro {id} não encontrado")
            return jsonify({'error': 'Livro não encontrado'}), 404
        
        data = request.json
        print(f"📦 Dados recebidos:", data)
        
        # Atualizar campos
        if 'titulo' in data and data['titulo']:
            livro.titulo = data['titulo']
        if 'autor' in data and data['autor']:
            livro.autor = data['autor']
        if 'preco' in data:
            livro.preco = float(data['preco'])
        if 'quantidade' in data:
            livro.quantidade = int(data['quantidade'])
        if 'categoria' in data and data['categoria']:
            livro.categoria = data['categoria']
        if 'eh_gratuito' in data:
            livro.eh_gratuito = bool(data['eh_gratuito'])
        if 'arquivo_pdf' in data:
            livro.arquivo_pdf = data['arquivo_pdf']
        
        db.session.commit()
        print(f"✅ Livro {id} atualizado com sucesso!")
        
        # Buscar o livro atualizado
        livro_atualizado = Livro.query.get(id)
        return jsonify(livro_atualizado.to_dict()), 200
        
    except Exception as e:
        print(f"❌ Erro ao atualizar livro {id}:", str(e))
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/livros/<id>', methods=['DELETE'])
def remover_livro(id):
    livro = Livro.query.get(id)
    if not livro:
        return jsonify({'error': 'Livro não encontrado'}), 404
    
    db.session.delete(livro)
    db.session.commit()
    return jsonify({'success': True})

# ==================== API VENDAS ====================
@app.route('/api/vendas', methods=['GET'])
def listar_vendas():
    vendas = Venda.query.order_by(Venda.data_venda.desc()).all()
    return jsonify([venda.to_dict() for venda in vendas])

@app.route('/api/vendas', methods=['POST'])
def criar_venda():
    data = request.json
    
    livro = Livro.query.get(data['livro_id'])
    if not livro:
        return jsonify({'error': 'Livro não encontrado'}), 404
    
    eh_gratuito = livro.eh_gratuito or livro.preco == 0
    
    if not eh_gratuito and livro.quantidade < data['quantidade']:
        return jsonify({'error': 'Estoque insuficiente'}), 400
    
    total = 0 if eh_gratuito else livro.preco * data['quantidade']
    
    venda = Venda(
        id=gerar_id(),
        livro_id=livro.id,
        livro_titulo=livro.titulo,
        cliente=data['cliente'],
        quantidade=data['quantidade'],
        total=total,
        metodo=data.get('metodo', 'PIX'),
        status='aprovado' if eh_gratuito else 'pendente',
        eh_gratuito=eh_gratuito
    )
    
    if not eh_gratuito:
        livro.quantidade -= data['quantidade']
    
    db.session.add(venda)
    db.session.commit()
    return jsonify(venda.to_dict()), 201

@app.route('/api/vendas/<id>/status', methods=['PATCH'])
def atualizar_status_venda(id):
    venda = Venda.query.get(id)
    if not venda:
        return jsonify({'error': 'Venda não encontrada'}), 404
    
    data = request.json
    status = data.get('status')
    
    if status not in ['pendente', 'aprovado', 'rejeitado']:
        return jsonify({'error': 'Status inválido'}), 400
    
    venda.status = status
    if status == 'aprovado':
        venda.data_aprovacao = datetime.utcnow()
    
    db.session.commit()
    return jsonify(venda.to_dict())

@app.route('/api/vendas/estatisticas/resumo', methods=['GET'])
def estatisticas_vendas():
    total_vendas = Venda.query.count()
    total_faturado = db.session.query(db.func.sum(Venda.total)).filter(Venda.status == 'aprovado').scalar() or 0
    pendentes = Venda.query.filter_by(status='pendente').count()
    
    return jsonify({
        'total_vendas': total_vendas,
        'total_faturado': float(total_faturado),
        'pendentes': pendentes
    })

# ==================== API PAGAMENTOS ====================
@app.route('/api/pagamentos/pendentes', methods=['GET'])
def pagamentos_pendentes():
    pagamentos = Pagamento.query.filter_by(status='pendente').all()
    return jsonify([pag.to_dict() for pag in pagamentos])

@app.route('/api/pagamentos', methods=['POST'])
def criar_pagamento():
    data = request.json
    
    pagamento = Pagamento(
        id=gerar_id(),
        venda_id=data['venda_id'],
        cliente=data['cliente'],
        valor=float(data['valor']),
        metodo=data.get('metodo', 'PIX'),
        comprovante_path=data.get('comprovante_path')
    )
    
    db.session.add(pagamento)
    db.session.commit()
    return jsonify(pagamento.to_dict()), 201

@app.route('/api/pagamentos/<id>/aprovar', methods=['PATCH'])
def aprovar_pagamento(id):
    pagamento = Pagamento.query.get(id)
    if not pagamento:
        return jsonify({'error': 'Pagamento não encontrado'}), 404
    
    pagamento.status = 'aprovado'
    pagamento.data_aprovacao = datetime.utcnow()
    
    venda = Venda.query.get(pagamento.venda_id)
    if venda:
        venda.status = 'aprovado'
        venda.data_aprovacao = datetime.utcnow()
    
    db.session.commit()
    return jsonify(pagamento.to_dict())

@app.route('/api/pagamentos/<id>/rejeitar', methods=['PATCH'])
def rejeitar_pagamento(id):
    pagamento = Pagamento.query.get(id)
    if not pagamento:
        return jsonify({'error': 'Pagamento não encontrado'}), 404
    
    data = request.json
    pagamento.status = 'rejeitado'
    pagamento.motivo_rejeicao = data.get('motivo', 'Não informado')
    
    venda = Venda.query.get(pagamento.venda_id)
    if venda:
        venda.status = 'rejeitado'
    
    db.session.commit()
    return jsonify(pagamento.to_dict())

# ==================== API UPLOAD ====================
@app.route('/api/upload/pdf', methods=['POST'])
def upload_pdf():
    if 'pdf' not in request.files:
        return jsonify({'error': 'Nenhum arquivo'}), 400
    
    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'error': 'Arquivo vazio'}), 400
    
    filename = salvar_arquivo(file, 'livros')
    return jsonify({'success': True, 'filename': filename})

@app.route('/api/upload/comprovante', methods=['POST'])
def upload_comprovante():
    if 'comprovante' not in request.files:
        return jsonify({'error': 'Nenhum arquivo'}), 400
    
    file = request.files['comprovante']
    if file.filename == '':
        return jsonify({'error': 'Arquivo vazio'}), 400
    
    filename = salvar_arquivo(file, 'comprovantes')
    return jsonify({'success': True, 'filename': filename})

# ==================== API ADMIN ====================
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    if data.get('username') == 'admin' and data.get('password') == 'admin123':
        return jsonify({'success': True, 'username': 'admin'})
    return jsonify({'error': 'Credenciais inválidas'}), 401

@app.route('/api/status', methods=['GET'])
def status():
    return jsonify({'status': 'online', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/scanner/executar', methods=['POST'])
def executar_scanner():
    resultado = carregar_livros_automaticamente(app, db)
    if resultado:
        return jsonify({'success': True, 'dados': resultado})
    return jsonify({'success': False, 'message': 'Nenhum livro encontrado'})

# ==================== MIGRAÇÃO ====================
def migrate_database():
    """Adiciona colunas necessárias"""
    with app.app_context():
        try:
            # Verificar livros
            result = db.session.execute("PRAGMA table_info(livros)").fetchall()
            colunas = [col[1] for col in result]
            
            if 'eh_gratuito' not in colunas:
                print("🔄 Adicionando 'eh_gratuito' em livros...")
                db.session.execute("ALTER TABLE livros ADD COLUMN eh_gratuito BOOLEAN DEFAULT 0")
                db.session.commit()
                print("✅ Coluna adicionada!")
            
            # Verificar vendas
            result = db.session.execute("PRAGMA table_info(vendas)").fetchall()
            colunas = [col[1] for col in result]
            
            if 'eh_gratuito' not in colunas:
                print("🔄 Adicionando 'eh_gratuito' em vendas...")
                db.session.execute("ALTER TABLE vendas ADD COLUMN eh_gratuito BOOLEAN DEFAULT 0")
                db.session.commit()
                print("✅ Coluna adicionada em vendas!")
                
        except Exception as e:
            print(f"⚠️ Erro na migração: {e}")

# ==================== INICIALIZAR ====================
def init_app():
    with app.app_context():
        db.create_all()
        print("✅ Banco de dados inicializado!")
        
        migrate_database()
        
        total = Livro.query.count()
        if total == 0:
            print("📚 Executando scanner inicial...")
            carregar_livros_automaticamente(app, db)
        else:
            print(f"📚 {total} livros cadastrados")

# ==================== INICIAR ====================
if __name__ == '__main__':
    print("=" * 60)
    print("📚 LIVRARIA VIRTUAL - VERSÃO COMPLETA")
    print("=" * 60)
    
    init_app()
    
    print("\n" + "=" * 60)
    print("🚀 Servidor: http://localhost:5000")
    print("🔑 Admin: admin / admin123")
    print("📁 Pasta de livros: livros/")
    print("\n📌 REGRAS:")
    print("  🎁 Nome SEM número → GRATUITO (ex: livro-gratuito.pdf)")
    print("  💰 Nome COM número → PAGO (ex: livro-1500.pdf)")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000)
