# models.py
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Inicializar o SQLAlchemy (será configurado no app.py)
db = SQLAlchemy()

class Livro(db.Model):
    __tablename__ = 'livros'  # Nome da tabela no banco
    
    id = db.Column(db.String(10), primary_key=True)  # CHAVE PRIMÁRIA DEFINIDA
    titulo = db.Column(db.String(200), nullable=False)
    autor = db.Column(db.String(200), nullable=False)
    preco = db.Column(db.Float, nullable=False, default=0.0)
    quantidade = db.Column(db.Integer, nullable=False)
    categoria = db.Column(db.String(100), nullable=False)
    arquivo_pdf = db.Column(db.String(255))
    eh_gratuito = db.Column(db.Boolean, default=False)
    data_cadastro = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'titulo': self.titulo,
            'autor': self.autor,
            'preco': self.preco,
            'quantidade': self.quantidade,
            'categoria': self.categoria,
            'arquivo_pdf': self.arquivo_pdf,
            'eh_gratuito': self.eh_gratuito,
            'data_cadastro': self.data_cadastro.strftime('%Y-%m-%d %H:%M:%S') if self.data_cadastro else None
        }

class Venda(db.Model):
    __tablename__ = 'vendas'
    
    id = db.Column(db.String(10), primary_key=True)
    livro_id = db.Column(db.String(10), db.ForeignKey('livros.id'))
    livro_titulo = db.Column(db.String(200))
    cliente = db.Column(db.String(200), nullable=False)
    quantidade = db.Column(db.Integer, nullable=False)
    total = db.Column(db.Float, nullable=False)
    metodo = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pendente')
    eh_gratuito = db.Column(db.Boolean, default=False)
    data_venda = db.Column(db.DateTime, default=datetime.utcnow)
    data_aprovacao = db.Column(db.DateTime)
    
    def to_dict(self):
        return {
            'id': self.id,
            'livro_id': self.livro_id,
            'livro_titulo': self.livro_titulo,
            'cliente': self.cliente,
            'quantidade': self.quantidade,
            'total': self.total,
            'metodo': self.metodo,
            'status': self.status,
            'eh_gratuito': self.eh_gratuito,
            'data_venda': self.data_venda.strftime('%Y-%m-%d %H:%M:%S') if self.data_venda else None,
            'data_aprovacao': self.data_aprovacao.strftime('%Y-%m-%d %H:%M:%S') if self.data_aprovacao else None
        }

class Pagamento(db.Model):
    __tablename__ = 'pagamentos'
    
    id = db.Column(db.String(10), primary_key=True)
    venda_id = db.Column(db.String(10), db.ForeignKey('vendas.id'))
    cliente = db.Column(db.String(200), nullable=False)
    valor = db.Column(db.Float, nullable=False)
    metodo = db.Column(db.String(50))
    status = db.Column(db.String(20), default='pendente')
    comprovante_path = db.Column(db.String(255))
    data_pagamento = db.Column(db.DateTime, default=datetime.utcnow)
    data_aprovacao = db.Column(db.DateTime)
    motivo_rejeicao = db.Column(db.String(500))
    
    def to_dict(self):
        return {
            'id': self.id,
            'venda_id': self.venda_id,
            'cliente': self.cliente,
            'valor': self.valor,
            'metodo': self.metodo,
            'status': self.status,
            'comprovante_path': self.comprovante_path,
            'data_pagamento': self.data_pagamento.strftime('%Y-%m-%d %H:%M:%S') if self.data_pagamento else None,
            'data_aprovacao': self.data_aprovacao.strftime('%Y-%m-%d %H:%M:%S') if self.data_aprovacao else None
        }
