# monitor.py
import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class LivroMonitorHandler(FileSystemEventHandler):
    """Monitora a pasta de livros e atualiza automaticamente"""
    
    def __init__(self, app, db):
        self.app = app
        self.db = db
        self.processando = False
        self.ultima_execucao = None
        print("📚 Monitor de livros inicializado!")
    
    def on_created(self, event):
        """Quando um arquivo é criado"""
        if not event.is_directory and event.src_path.lower().endswith('.pdf'):
            print(f"📄 Novo PDF detectado: {os.path.basename(event.src_path)}")
            self.processar_livros()
    
    def on_modified(self, event):
        """Quando um arquivo é modificado"""
        if not event.is_directory and event.src_path.lower().endswith('.pdf'):
            print(f"🔄 PDF modificado: {os.path.basename(event.src_path)}")
            self.processar_livros()
    
    def on_moved(self, event):
        """Quando um arquivo é movido/renomeado"""
        if not event.is_directory and event.dest_path.lower().endswith('.pdf'):
            print(f"📂 PDF movido: {os.path.basename(event.dest_path)}")
            self.processar_livros()
    
    def on_deleted(self, event):
        """Quando um arquivo é deletado"""
        if not event.is_directory and event.src_path.lower().endswith('.pdf'):
            print(f"🗑️ PDF removido: {os.path.basename(event.src_path)}")
            self.processar_livros()
    
    def processar_livros(self):
        """Processa todos os livros da pasta"""
        if self.processando:
            print("⏳ Já processando...")
            return
        
        self.processando = True
        try:
            with self.app.app_context():
                from scanner import carregar_livros_automaticamente
                
                print("\n" + "=" * 50)
                print("🔄 SCANNER AUTOMÁTICO")
                print("=" * 50)
                
                resultado = carregar_livros_automaticamente(self.app, self.db)
                
                if resultado:
                    print(f"✅ {resultado['total']} livros processados")
                    print(f"   📥 {resultado['adicionados']} adicionados")
                    print(f"   🔄 {resultado['atualizados']} atualizados")
                else:
                    print("⚠️ Nenhum livro encontrado")
                
                self.ultima_execucao = time.time()
                print("=" * 50 + "\n")
                
        except Exception as e:
            print(f"❌ Erro ao processar: {e}")
        finally:
            self.processando = False

observer = None
event_handler = None

def iniciar_monitor(app, db, pasta_livros='livros'):
    """Inicia o monitoramento da pasta"""
    global observer, event_handler
    
    if not os.path.exists(pasta_livros):
        os.makedirs(pasta_livros)
        print(f"📁 Pasta criada: {pasta_livros}")
    
    event_handler = LivroMonitorHandler(app, db)
    observer = Observer()
    observer.schedule(event_handler, pasta_livros, recursive=False)
    observer.start()
    
    print(f"👁️ Monitorando: {pasta_livros}/")
    print("   (Adicione/remova PDFs e atualiza automaticamente)")
    
    # Processar livros existentes
    print("\n📚 Verificando livros existentes...")
    event_handler.processar_livros()
    
    return observer, event_handler

def parar_monitor():
    """Para o monitoramento"""
    global observer
    if observer:
        observer.stop()
        observer.join()
        print("🛑 Monitor parado")

def forcar_atualizacao(app, db):
    """Força uma atualização manual"""
    global event_handler
    if event_handler:
        event_handler.processar_livros()
        return True
    return False
