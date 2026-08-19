// ==================== CONFIGURAÇÃO ====================
const API_URL = window.location.origin + '/api';
let livros = [];
let usuarioAdmin = false;
let zoomLevel = 1;
let currentPdfUrl = '';
let livroEditando = null;
let clienteAtual = null;

// ==================== INICIALIZAÇÃO ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando Livraria Virtual...');
    verificarStatusServidor();
    carregarLivros();
    carregarCategorias();
    atualizarCarrinho();
    verificarAdmin();
    configurarUpload();
    verificarCliente();
});

// ==================== STATUS ====================
async function verificarStatusServidor() {
    try {
        const response = await fetch('/api/status');
        if (response.ok) {
            document.getElementById('status-server').textContent = 'Online';
        }
    } catch (error) {
        document.getElementById('status-server').textContent = 'Offline';
    }
}

// ==================== GERENCIAMENTO DE CLIENTE ====================
function verificarCliente() {
    const clienteSalvo = localStorage.getItem('clienteAtual');
    if (clienteSalvo) {
        clienteAtual = clienteSalvo;
        console.log('👤 Cliente atual:', clienteAtual);
    }
}

function definirCliente(nome) {
    if (nome && nome.trim()) {
        clienteAtual = nome.trim();
        localStorage.setItem('clienteAtual', clienteAtual);
        console.log('👤 Cliente definido:', clienteAtual);
        renderizarVendas();
        return true;
    }
    return false;
}

function logoutCliente() {
    clienteAtual = null;
    localStorage.removeItem('clienteAtual');
    renderizarVendas();
}

function loginCliente() {
    const input = document.getElementById('input-cliente-login');
    if (!input) return;
    
    const nome = input.value.trim();
    if (nome) {
        definirCliente(nome);
        renderizarVendas();
    } else {
        alert('❌ Por favor, digite seu nome!');
    }
}

// ==================== API - LIVROS ====================
async function carregarLivros() {
    try {
        const response = await fetch(`${API_URL}/livros`);
        if (!response.ok) throw new Error('Erro ao carregar livros');
        livros = await response.json();
        renderizarLivros(livros);
        renderizarTabelaAdmin();
        atualizarEstatisticas();
        return livros;
    } catch (error) {
        console.error('Erro:', error);
        document.getElementById('lista-livros').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Erro ao carregar livros</h3>
                <p>Verifique se o servidor está rodando</p>
            </div>
        `;
        return [];
    }
}

// ==================== REMOVER LIVRO ====================
async function removerLivro(livroId) {
    const livro = livros.find(l => l.id === livroId);
    if (!livro) {
        alert('❌ Livro não encontrado!');
        return;
    }
    
    if (!confirm(`⚠️ Tem certeza que deseja remover o livro "${livro.titulo}"?\n\nEsta ação não pode ser desfeita!`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/livros/${livroId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Erro ao remover livro');
        }
        
        await carregarLivros();
        await carregarCategorias();
        renderizarTabelaAdmin();
        alert(`✅ Livro "${livro.titulo}" removido com sucesso!`);
        
    } catch (error) {
        alert('❌ Erro ao remover livro: ' + error.message);
    }
}

// ==================== RENDERIZAR LIVROS ====================
function renderizarLivros(livrosData) {
    const container = document.getElementById('lista-livros');
    container.innerHTML = '';

    const busca = document.getElementById('busca-livro').value.toLowerCase();
    const categoria = document.getElementById('filtro-categoria').value;
    const autorFiltro = document.getElementById('filtro-autor')?.value?.toLowerCase() || '';
    const precoMin = parseFloat(document.getElementById('filtro-preco-min')?.value) || 0;
    const precoMax = parseFloat(document.getElementById('filtro-preco-max')?.value) || Infinity;
    const tipoFiltro = document.getElementById('filtro-tipo')?.value || 'todos';

    let livrosFiltrados = livrosData || [];

    if (busca) {
        livrosFiltrados = livrosFiltrados.filter(l => 
            l.titulo.toLowerCase().includes(busca) ||
            l.autor.toLowerCase().includes(busca)
        );
    }

    if (categoria) {
        livrosFiltrados = livrosFiltrados.filter(l => l.categoria === categoria);
    }

    if (autorFiltro) {
        livrosFiltrados = livrosFiltrados.filter(l => 
            l.autor.toLowerCase().includes(autorFiltro)
        );
    }

    livrosFiltrados = livrosFiltrados.filter(l => {
        const preco = l.eh_gratuito ? 0 : l.preco;
        return preco >= precoMin && preco <= precoMax;
    });

    if (tipoFiltro === 'gratuito') {
        livrosFiltrados = livrosFiltrados.filter(l => l.eh_gratuito || l.preco === 0);
    } else if (tipoFiltro === 'pago') {
        livrosFiltrados = livrosFiltrados.filter(l => !l.eh_gratuito && l.preco > 0);
    }

    livrosFiltrados.sort((a, b) => a.titulo.localeCompare(b.titulo));

    if (livrosFiltrados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <p>Nenhum livro encontrado com os filtros selecionados</p>
            </div>
        `;
        return;
    }

    livrosFiltrados.forEach(livro => {
        const card = document.createElement('div');
        card.className = 'card-livro';
        
        const temPDF = livro.arquivo_pdf ? true : false;
        const emEstoque = livro.quantidade > 0;
        const ehGratuito = livro.eh_gratuito || livro.preco === 0;
        
        let badgeHTML = '';
        if (temPDF && ehGratuito) {
            badgeHTML = '<span class="badge-free"><i class="fas fa-gift"></i> GRATUITO</span>';
        } else if (temPDF) {
            badgeHTML = '<span class="badge-pdf"><i class="fas fa-file-pdf"></i> PDF</span>';
        }
        
        let precoHTML = '';
        if (ehGratuito) {
            precoHTML = `
                <div class="preco-free">
                    <span class="gratuito-label"><i class="fas fa-gift"></i> GRATUITO</span>
                    <span class="preco-riscado">Kz 0,00</span>
                </div>
            `;
        } else {
            precoHTML = `<div class="preco">Kz ${parseFloat(livro.preco).toFixed(2)}</div>`;
        }
        
        let acoesHTML = '';
        
        if (temPDF) {
            acoesHTML += `<button class="btn-preview" onclick="abrirVisualizador('${livro.id}')">
                <i class="fas fa-eye"></i> Visualizar
            </button>`;
        }
        
        if (emEstoque && temPDF) {
            if (ehGratuito) {
                acoesHTML += `<button class="btn-gratuito" onclick="baixarGratuito('${livro.id}')">
                    <i class="fas fa-download"></i> Baixar Grátis
                </button>`;
            } else {
                acoesHTML += `<button class="btn-comprar" onclick="abrirCompra('${livro.id}')">
                    <i class="fas fa-shopping-cart"></i> Comprar
                </button>`;
            }
        }
        
        if (!emEstoque) {
            acoesHTML += `<button class="btn-disabled" disabled>
                <i class="fas fa-times"></i> Esgotado
            </button>`;
        }
        
        card.innerHTML = `
            ${badgeHTML}
            <h3>${livro.titulo}</h3>
            <div class="autor"><i class="fas fa-user"></i> ${livro.autor}</div>
            ${precoHTML}
            <div class="info">
                <span><i class="fas fa-box"></i> ${livro.quantidade} unidades</span>
                <span><i class="fas fa-tag"></i> ${livro.categoria}</span>
                ${ehGratuito ? '<span class="badge-free-small"><i class="fas fa-gift"></i> Grátis</span>' : ''}
            </div>
            <div class="acoes">
                ${acoesHTML}
            </div>
        `;
        
        container.appendChild(card);
    });
}

function buscarLivros() {
    renderizarLivros(livros);
}

function limparFiltros() {
    document.getElementById('busca-livro').value = '';
    document.getElementById('filtro-categoria').value = '';
    document.getElementById('filtro-autor').value = '';
    document.getElementById('filtro-tipo').value = 'todos';
    document.getElementById('filtro-preco-min').value = '';
    document.getElementById('filtro-preco-max').value = '';
    buscarLivros();
}

async function carregarCategorias() {
    try {
        const categorias = [...new Set(livros.map(l => l.categoria))];
        const select = document.getElementById('filtro-categoria');
        select.innerHTML = '<option value="">Todas as categorias</option>';
        categorias.forEach(cat => {
            if (cat) {
                select.innerHTML += `<option value="${cat}">${cat}</option>`;
            }
        });
    } catch (error) {
        console.error('Erro:', error);
    }
}

// ==================== RENDERIZAR TABELA ADMIN ====================
function renderizarTabelaAdmin() {
    const tbody = document.getElementById('tabela-livros-admin');
    if (!tbody) return;
    
    if (livros.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 20px; color: var(--gray-500);">
                    <i class="fas fa-book"></i> Nenhum livro cadastrado
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    livros.forEach(livro => {
        const tr = document.createElement('tr');
        tr.style.cssText = 'border-bottom: 1px solid var(--gray-200); transition: background 0.3s;';
        tr.onmouseover = function() { this.style.background = 'var(--gray-100)'; };
        tr.onmouseout = function() { this.style.background = 'transparent'; };
        
        const ehGratuito = livro.eh_gratuito || livro.preco === 0;
        
        tr.innerHTML = `
            <td style="padding: 10px; font-size: 12px; color: var(--gray-500);">${livro.id}</td>
            <td style="padding: 10px; font-weight: 600; color: var(--primary-dark);">${livro.titulo}</td>
            <td style="padding: 10px; color: var(--gray-700);">${livro.autor}</td>
            <td style="padding: 10px; font-weight: 600; color: ${ehGratuito ? 'var(--success)' : 'var(--secondary)'};">
                ${ehGratuito ? '🎁 GRATUITO' : `Kz ${parseFloat(livro.preco).toFixed(2)}`}
            </td>
            <td style="padding: 10px; text-align: center;">${livro.quantidade}</td>
            <td style="padding: 10px;"><span style="background: var(--gray-200); padding: 2px 10px; border-radius: 12px; font-size: 12px;">${livro.categoria}</span></td>
            <td style="padding: 10px; text-align: center;">
                <button onclick="abrirEditar('${livro.id}')" 
                        style="padding: 6px 12px; background: var(--info); color: white; border: none; border-radius: 6px; cursor: pointer; margin-right: 5px; transition: all 0.3s;"
                        onmouseover="this.style.transform='scale(1.05)'" 
                        onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="removerLivro('${livro.id}')" 
                        style="padding: 6px 12px; background: var(--danger); color: white; border: none; border-radius: 6px; cursor: pointer; transition: all 0.3s;"
                        onmouseover="this.style.transform='scale(1.05)'" 
                        onmouseout="this.style.transform='scale(1)'">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ==================== ADMIN ====================
function abrirAdmin() {
    console.log('🔑 Abrindo Admin...');
    
    if (usuarioAdmin) {
        console.log('✅ Admin já logado');
        mudarTab('admin');
        renderizarTabelaAdmin();
        return;
    }
    
    const senha = prompt('🔑 Digite a senha de administrador:');
    console.log('Senha digitada:', senha);
    
    if (senha === 'admin123') {
        usuarioAdmin = true;
        localStorage.setItem('adminLogado', 'true');
        
        const tabAdmin = document.getElementById('tab-admin-btn');
        if (tabAdmin) {
            tabAdmin.style.display = 'block';
        }
        
        const btnAdmin = document.getElementById('btn-admin');
        if (btnAdmin) {
            btnAdmin.classList.add('active');
            btnAdmin.style.background = '#27ae60';
        }
        
        mudarTab('admin');
        carregarLivros();
        renderizarTabelaAdmin();
        
        alert('✅ Bem-vindo ao painel administrativo!');
        console.log('✅ Admin logado com sucesso!');
    } else {
        alert('❌ Senha incorreta!');
        console.log('❌ Senha incorreta');
    }
}

function verificarAdmin() {
    console.log('🔍 Verificando admin...');
    if (localStorage.getItem('adminLogado') === 'true') {
        usuarioAdmin = true;
        console.log('✅ Admin logado (localStorage)');
        
        const tabAdmin = document.getElementById('tab-admin-btn');
        if (tabAdmin) {
            tabAdmin.style.display = 'block';
        }
        
        const btnAdmin = document.getElementById('btn-admin');
        if (btnAdmin) {
            btnAdmin.classList.add('active');
            btnAdmin.style.background = '#27ae60';
        }
    } else {
        console.log('ℹ️ Admin não logado');
    }
}

// ==================== EDIÇÃO ====================
function abrirEditar(livroId) {
    if (!usuarioAdmin) {
        alert('❌ Apenas administradores podem editar livros!');
        return;
    }
    
    const livro = livros.find(l => l.id === livroId);
    if (!livro) {
        alert('❌ Livro não encontrado!');
        return;
    }
    
    console.log('📝 Editando livro:', livro);
    
    livroEditando = livroId;
    
    document.getElementById('edit-livro-id').value = livro.id;
    document.getElementById('edit-livro-titulo').value = livro.titulo;
    document.getElementById('edit-livro-autor').value = livro.autor;
    document.getElementById('edit-livro-preco').value = livro.preco;
    document.getElementById('edit-livro-quantidade').value = livro.quantidade;
    document.getElementById('edit-livro-categoria').value = livro.categoria;
    document.getElementById('edit-livro-gratuito').checked = livro.eh_gratuito || livro.preco === 0;
    
    document.getElementById('modal-editar').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', function() {
    const formEditar = document.getElementById('form-editar');
    if (formEditar) {
        formEditar.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const id = document.getElementById('edit-livro-id').value;
            const titulo = document.getElementById('edit-livro-titulo').value;
            const autor = document.getElementById('edit-livro-autor').value;
            const preco = parseFloat(document.getElementById('edit-livro-preco').value) || 0;
            const quantidade = parseInt(document.getElementById('edit-livro-quantidade').value) || 10;
            const categoria = document.getElementById('edit-livro-categoria').value;
            const ehGratuito = document.getElementById('edit-livro-gratuito').checked;
            
            if (!titulo || !autor || !categoria) {
                alert('❌ Preencha todos os campos obrigatórios!');
                return;
            }
            
            try {
                const dados = {
                    titulo: titulo,
                    autor: autor,
                    preco: ehGratuito ? 0 : preco,
                    quantidade: quantidade,
                    categoria: categoria,
                    eh_gratuito: ehGratuito
                };
                
                const response = await fetch(`${API_URL}/livros/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(dados)
                });
                
                if (!response.ok) {
                    throw new Error('Erro ao atualizar livro: ' + response.status);
                }
                
                const resultado = await response.json();
                console.log('✅ Livro atualizado:', resultado);
                
                fecharModal('modal-editar');
                await carregarLivros();
                await carregarCategorias();
                renderizarTabelaAdmin();
                alert('✅ Livro atualizado com sucesso!');
                
            } catch (error) {
                console.error('❌ Erro detalhado:', error);
                alert('❌ Erro ao atualizar: ' + error.message);
            }
        });
    }
});

// ==================== VISUALIZADOR COMPLETO - CORRIGIDO ====================
async function abrirVisualizador(livroId) {
    try {
        const livro = livros.find(l => l.id === livroId);
        if (!livro || !livro.arquivo_pdf) {
            alert('❌ Livro ou PDF não encontrado!');
            return;
        }
        
        currentPdfUrl = `/uploads/livros/${livro.arquivo_pdf}`;
        zoomLevel = 1;
        
        const modal = document.getElementById('modal-preview');
        const container = document.getElementById('preview-content');
        const info = document.getElementById('pdf-nome');
        
        info.textContent = `${livro.titulo} - ${livro.autor}`;
        
        container.innerHTML = `
            <div id="pdf-scroll-container" style="
                width: 100%; 
                height: 70vh; 
                min-height: 500px; 
                max-height: 70vh; 
                overflow: auto; 
                background: #e8e8e8; 
                position: relative; 
                display: flex; 
                align-items: flex-start; 
                justify-content: center;
                padding: 20px;
            ">
                <div id="pdf-wrapper" style="
                    width: 100%;
                    height: auto;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    transition: transform 0.3s ease;
                ">
                    <embed 
                        src="${currentPdfUrl}#toolbar=0&navpanes=0&scrollbar=1" 
                        type="application/pdf" 
                        id="pdf-embed"
                        style="
                            width: 100%; 
                            height: auto; 
                            min-height: 600px;
                            max-width: 100%;
                            border: none; 
                            background: white;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        "
                    >
                </div>
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 10; pointer-events: none;"></div>
            </div>
        `;
        
        setTimeout(() => {
            const embed = document.getElementById('pdf-embed');
            if (embed) {
                embed.src = `${currentPdfUrl}#toolbar=0&navpanes=0&scrollbar=1`;
                embed.style.height = 'auto';
                embed.style.minHeight = '600px';
            }
        }, 100);
        
        setTimeout(() => {
            aplicarZoomComScroll();
        }, 300);
        
        document.getElementById('zoom-level').textContent = '100%';
        
        modal.style.display = 'block';
        
        document.addEventListener('keydown', bloquearDownloadImpressao);
        document.addEventListener('contextmenu', bloquearCliqueDireito);
        
        const embed = document.getElementById('pdf-embed');
        if (embed) {
            embed.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
            });
            embed.addEventListener('dragstart', function(e) {
                e.preventDefault();
                return false;
            });
        }
        
        window.addEventListener('resize', function() {
            ajustarAlturaVisualizador();
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar visualizador:', error);
        alert('❌ Erro ao carregar visualizador: ' + error.message);
    }
}

function ajustarAlturaVisualizador() {
    const container = document.getElementById('pdf-scroll-container');
    const embed = document.getElementById('pdf-embed');
    if (container && embed) {
        const altura = window.innerHeight * 0.7;
        container.style.height = altura + 'px';
        container.style.maxHeight = altura + 'px';
        embed.style.minHeight = (altura - 40) + 'px';
    }
}

// ==================== ZOOM ====================
function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.1, 3);
    aplicarZoomComScroll();
    document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.5);
    aplicarZoomComScroll();
    document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';
}

function zoomReset() {
    zoomLevel = 1;
    aplicarZoomComScroll();
    document.getElementById('zoom-level').textContent = '100%';
}

function aplicarZoomComScroll() {
    const embed = document.getElementById('pdf-embed');
    const wrapper = document.getElementById('pdf-wrapper');
    
    if (embed && wrapper) {
        const larguraBase = 100;
        const novaEscala = zoomLevel;
        
        wrapper.style.transform = `scale(${novaEscala})`;
        wrapper.style.transformOrigin = 'top center';
        wrapper.style.width = `${larguraBase / novaEscala}%`;
        
        const alturaBase = 600;
        embed.style.minHeight = `${alturaBase / novaEscala}px`;
        embed.style.height = 'auto';
        
        const container = document.getElementById('pdf-scroll-container');
        if (container) {
            const alturaMaxima = window.innerHeight * 0.7;
            container.style.height = alturaMaxima + 'px';
            container.style.maxHeight = alturaMaxima + 'px';
        }
    }
}

function bloquearDownloadImpressao(e) {
    if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        alert('⚠️ Download desativado neste visualizador.');
        return false;
    }
    if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        alert('⚠️ Impressão desativada neste visualizador.');
        return false;
    }
    if (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault();
        alert('⚠️ Ferramentas de desenvolvedor desativadas.');
        return false;
    }
    if (e.key === 'F12') {
        e.preventDefault();
        alert('⚠️ Ferramentas de desenvolvedor desativadas.');
        return false;
    }
    if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        return false;
    }
    if (e.ctrlKey && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        return false;
    }
}

function bloquearCliqueDireito(e) {
    e.preventDefault();
    return false;
}

// ==================== BAIXAR GRATUITO ====================
function baixarGratuito(livroId) {
    const livro = livros.find(l => l.id === livroId);
    if (!livro || !livro.arquivo_pdf) {
        alert('❌ Arquivo não encontrado!');
        return;
    }
    
    if (!livro.eh_gratuito && livro.preco > 0) {
        alert('❌ Este livro não é gratuito!');
        return;
    }
    
    const modal = document.getElementById('modal-download');
    document.getElementById('download-conteudo').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 4rem; color: var(--success);">
                <i class="fas fa-gift"></i>
            </div>
            <h2 style="margin: 20px 0; color: var(--secondary);">🎁 Download Gratuito!</h2>
            <p style="font-size: 18px; color: var(--gray-700);">Você está baixando um livro <strong>GRATUITO</strong>:</p>
            <h3 style="margin: 20px 0; color: var(--primary-dark);">"${livro.titulo}"</h3>
            <p style="color: var(--gray-600);">Autor: ${livro.autor}</p>
            <a href="/uploads/livros/${livro.arquivo_pdf}" download class="btn-success" style="display: inline-block; margin-top: 20px; padding: 15px 40px; text-decoration: none; background: linear-gradient(135deg, var(--secondary), var(--secondary-dark));">
                <i class="fas fa-download"></i> Baixar PDF Agora
            </a>
        </div>
    `;
    modal.style.display = 'block';
}

// ==================== COMPRA ====================
function abrirCompra(livroId) {
    const livro = livros.find(l => l.id === livroId);
    if (!livro) {
        alert('❌ Livro não encontrado!');
        return;
    }
    
    if (livro.eh_gratuito || livro.preco === 0) {
        baixarGratuito(livroId);
        return;
    }
    
    document.getElementById('modal-compra').style.display = 'block';
    document.getElementById('compra-quantidade').max = livro.quantidade;
    document.getElementById('compra-quantidade').value = 1;
    
    document.getElementById('detalhes-compra').innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
                <h3 style="color: var(--primary-dark);">${livro.titulo}</h3>
                <p style="color: var(--gray-600);"><i class="fas fa-user"></i> ${livro.autor}</p>
            </div>
            <div style="font-size: 24px; font-weight: 800; color: var(--secondary);">
                Kz ${parseFloat(livro.preco).toFixed(2)}
            </div>
        </div>
        <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 13px; color: var(--gray-600);">
            <span><i class="fas fa-box"></i> ${livro.quantidade} disponíveis</span>
            <span><i class="fas fa-tag"></i> ${livro.categoria}</span>
        </div>
    `;
    
    document.getElementById('form-compra').dataset.livroId = livroId;
    
    const fileInput = document.getElementById('compra-comprovante');
    if (fileInput) {
        fileInput.value = '';
    }
    document.getElementById('nome-arquivo').style.display = 'none';
}

// ==================== COPIAR EXPRESS ====================
function copiarPix() {
    const express = '946646242';
    navigator.clipboard.writeText(express).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copiado!';
        btn.style.background = '#28a745';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
        }, 2000);
    });
}

// ==================== CONFIGURAR UPLOAD ====================
function configurarUpload() {
    const fileInput = document.getElementById('compra-comprovante');
    const nomeArquivoDiv = document.getElementById('nome-arquivo');
    const arquivoNomeSpan = document.getElementById('arquivo-nome');
    
    if (!fileInput) return;
    
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    newFileInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            const nome = this.files[0].name;
            console.log('📎 Arquivo selecionado:', nome);
            
            if (arquivoNomeSpan && nomeArquivoDiv) {
                arquivoNomeSpan.textContent = nome;
                nomeArquivoDiv.style.display = 'block';
            }
        } else {
            if (nomeArquivoDiv) {
                nomeArquivoDiv.style.display = 'none';
            }
        }
    });
}

// ==================== FORMULÁRIO DE COMPRA ====================
document.getElementById('form-compra').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const livroId = this.dataset.livroId;
    const livro = livros.find(l => l.id === livroId);
    if (!livro) {
        alert('❌ Livro não encontrado!');
        return;
    }
    
    if (livro.eh_gratuito || livro.preco === 0) {
        baixarGratuito(livroId);
        fecharModal('modal-compra');
        return;
    }
    
    const cliente = document.getElementById('compra-cliente').value;
    const quantidade = parseInt(document.getElementById('compra-quantidade').value);
    const metodo = document.getElementById('compra-metodo').value;
    const fileInput = document.getElementById('compra-comprovante');
    const arquivo = fileInput ? fileInput.files[0] : null;
    
    if (!cliente || !cliente.trim()) {
        alert('❌ Por favor, informe o nome do cliente!');
        return;
    }
    
    definirCliente(cliente);
    
    if (!quantidade || quantidade < 1) {
        alert('❌ Por favor, informe uma quantidade válida!');
        return;
    }
    
    if (!arquivo) {
        alert('❌ Por favor, selecione um arquivo de comprovante!');
        return;
    }
    
    if (quantidade > livro.quantidade) {
        alert('❌ Quantidade indisponível em estoque!');
        return;
    }
    
    try {
        const formData = new FormData();
        formData.append('comprovante', arquivo);
        
        console.log('📤 Enviando arquivo:', arquivo.name);
        
        const uploadResponse = await fetch('/api/upload/comprovante', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            throw new Error('Erro no upload do comprovante');
        }
        
        const uploadResult = await uploadResponse.json();
        console.log('✅ Upload realizado:', uploadResult);
        
        const venda = {
            livro_id: livroId,
            cliente: cliente.trim(),
            quantidade,
            metodo
        };
        
        const vendaResponse = await fetch(`${API_URL}/vendas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(venda)
        });
        
        if (!vendaResponse.ok) {
            throw new Error('Erro ao criar venda');
        }
        
        const vendaResult = await vendaResponse.json();
        console.log('✅ Venda criada:', vendaResult);
        
        const pagamento = {
            venda_id: vendaResult.id,
            cliente: cliente.trim(),
            valor: vendaResult.total,
            metodo,
            comprovante_path: uploadResult.filename
        };
        
        const pagamentoResponse = await fetch(`${API_URL}/pagamentos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pagamento)
        });
        
        if (!pagamentoResponse.ok) {
            throw new Error('Erro ao criar pagamento');
        }
        
        await carregarLivros();
        fecharModal('modal-compra');
        
        this.reset();
        if (fileInput) {
            fileInput.value = '';
        }
        document.getElementById('nome-arquivo').style.display = 'none';
        
        alert(`✅ Compra realizada com sucesso!\n\nID da Venda: ${vendaResult.id}\nCliente: ${cliente}\nTotal: Kz ${vendaResult.total.toFixed(2)}\n\n⏳ Aguarde a aprovação do pagamento.`);
        
        atualizarCarrinho();
        renderizarVendas();
    } catch (error) {
        console.error('❌ Erro detalhado:', error);
        alert('❌ Erro ao processar compra: ' + error.message);
    }
});

// ==================== ANÁLISE DE COMPROVANTES ====================
async function renderizarAnaliseComprovantes() {
    console.log('📋 Renderizando análise de comprovantes...');
    const container = document.getElementById('analise-comprovantes');
    
    if (!container) {
        console.error('❌ Container "analise-comprovantes" não encontrado!');
        return;
    }
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Carregando comprovantes...</div>';
    
    try {
        const response = await fetch(`${API_URL}/pagamentos/pendentes`);
        
        if (!response.ok) {
            throw new Error('Erro ao buscar pagamentos: ' + response.status);
        }
        
        const pagamentos = await response.json();
        console.log('📊 Pagamentos pendentes encontrados:', pagamentos.length);
        
        if (pagamentos.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--gray-500);">
                    <i class="fas fa-check-circle" style="font-size: 3rem; color: var(--success); display: block; margin-bottom: 15px;"></i>
                    <h3 style="color: var(--gray-700);">Nenhum comprovante pendente</h3>
                    <p>Todos os pagamentos foram aprovados ou rejeitados.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = '<div class="comprovantes-grid" style="display: flex; flex-direction: column; gap: 16px;">';
        
        for (const pag of pagamentos) {
            try {
                const vendaResponse = await fetch(`${API_URL}/vendas/${pag.venda_id}`);
                let venda = null;
                
                if (vendaResponse.ok) {
                    venda = await vendaResponse.json();
                } else {
                    console.warn('⚠️ Venda não encontrada para o pagamento:', pag.venda_id);
                    venda = {
                        id: pag.venda_id,
                        livro_id: null,
                        livro_titulo: 'Livro não encontrado',
                        cliente: pag.cliente,
                        quantidade: 1,
                        total: pag.valor,
                        metodo: pag.metodo
                    };
                }
                
                let livro = null;
                if (venda && venda.livro_id) {
                    livro = livros.find(l => l.id === venda.livro_id);
                }
                
                const div = document.createElement('div');
                div.className = 'comprovante-card';
                div.style.cssText = `
                    background: var(--white);
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid var(--gray-200);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    transition: all 0.3s ease;
                `;
                
                const temComprovante = pag.comprovante_path && pag.comprovante_path !== 'null' && pag.comprovante_path !== '';
                
                div.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 12px;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                                <span class="status-badge status-pendente" style="background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                                    ⏳ Pendente
                                </span>
                                <span style="font-size: 12px; color: var(--gray-500);">#${pag.id}</span>
                            </div>
                            <h4 style="margin: 8px 0 4px 0; color: var(--primary-dark); font-size: 16px;">
                                ${livro ? livro.titulo : (venda ? venda.livro_titulo : 'Livro removido')}
                            </h4>
                            <p style="color: var(--gray-600); font-size: 14px; margin: 0;">
                                <i class="fas fa-user"></i> ${pag.cliente}
                            </p>
                            <p style="color: var(--gray-500); font-size: 12px; margin: 4px 0 0 0;">
                                <i class="fas fa-credit-card"></i> ${pag.metodo || 'N/A'}
                            </p>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 20px; font-weight: 700; color: var(--secondary);">
                                Kz ${parseFloat(pag.valor).toFixed(2)}
                            </div>
                            <div style="font-size: 12px; color: var(--gray-500);">
                                <i class="fas fa-calendar"></i> ${new Date(pag.data_pagamento).toLocaleString()}
                            </div>
                            ${temComprovante ? `
                                <div style="font-size: 11px; color: var(--success); margin-top: 2px;">
                                    <i class="fas fa-check-circle"></i> Comprovante anexado
                                </div>
                            ` : `
                                <div style="font-size: 11px; color: var(--danger); margin-top: 2px;">
                                    <i class="fas fa-exclamation-circle"></i> Sem comprovante
                                </div>
                            `}
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap; border-top: 1px solid var(--gray-200); padding-top: 16px;">
                        ${temComprovante ? `
                            <button onclick="visualizarComprovante('${pag.comprovante_path}')" 
                                    style="padding: 8px 16px; background: var(--info); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-eye"></i> Ver Comprovante
                            </button>
                        ` : `
                            <button disabled 
                                    style="padding: 8px 16px; background: #ccc; color: #666; border: none; border-radius: 8px; cursor: not-allowed; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-eye-slash"></i> Sem Comprovante
                            </button>
                        `}
                        <button onclick="aprovarPagamentoComprovante('${pag.id}', '${pag.venda_id}')" 
                                style="padding: 8px 20px; background: var(--success); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-check"></i> Aprovar
                        </button>
                        <button onclick="rejeitarPagamentoComprovante('${pag.id}', '${pag.venda_id}')" 
                                style="padding: 8px 20px; background: var(--danger); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                            <i class="fas fa-times"></i> Rejeitar
                        </button>
                    </div>
                `;
                container.appendChild(div);
            } catch (err) {
                console.error('Erro ao processar pagamento:', err);
            }
        }
        
        container.innerHTML += '</div>';
        
    } catch (error) {
        console.error('❌ Erro ao carregar comprovantes:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--danger);">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
                <h3>Erro ao carregar comprovantes</h3>
                <p>${error.message}</p>
                <button onclick="renderizarAnaliseComprovantes()" 
                        style="margin-top: 15px; padding: 10px 30px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-sync"></i> Tentar Novamente
                </button>
            </div>
        `;
    }
}

// ==================== VISUALIZAR COMPROVANTE ====================
function visualizarComprovante(caminho) {
    console.log('👁️ Visualizando comprovante:', caminho);
    const modal = document.getElementById('modal-comprovante');
    const container = document.getElementById('comprovante-conteudo');
    
    if (!modal || !container) {
        alert('❌ Erro ao abrir visualizador de comprovante!');
        return;
    }
    
    const nomeArquivo = caminho.split('/').pop();
    const extensao = nomeArquivo.split('.').pop().toLowerCase();
    
    container.innerHTML = `
        <div style="text-align: center; padding: 20px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p>Carregando comprovante...</p>
        </div>
    `;
    
    modal.style.display = 'block';
    
    setTimeout(() => {
        if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extensao)) {
            container.innerHTML = `
                <div style="max-height: 70vh; overflow: auto; text-align: center;">
                    <img src="/uploads/comprovantes/${nomeArquivo}" 
                         style="max-width: 100%; max-height: 60vh; border-radius: 8px; box-shadow: var(--shadow-md);" 
                         onerror="this.onerror=null; this.parentElement.innerHTML='<p style=\\'color: red;\\'>❌ Erro ao carregar imagem</p>';">
                </div>
                <div style="margin-top: 16px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/uploads/comprovantes/${nomeArquivo}" download class="btn-primary" style="text-decoration: none; padding: 10px 20px; background: var(--primary); color: white; border-radius: 8px;">
                        <i class="fas fa-download"></i> Baixar Comprovante
                    </a>
                    <a href="/uploads/comprovantes/${nomeArquivo}" target="_blank" class="btn-preview" style="text-decoration: none; padding: 10px 20px; background: var(--info); color: white; border-radius: 8px;">
                        <i class="fas fa-external-link-alt"></i> Abrir em Nova Aba
                    </a>
                </div>
            `;
        } else if (extensao === 'pdf') {
            container.innerHTML = `
                <embed src="/uploads/comprovantes/${nomeArquivo}#toolbar=0&navpanes=0" 
                       type="application/pdf" 
                       style="width: 100%; height: 500px; border: none; border-radius: 8px;">
                <div style="margin-top: 16px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
                    <a href="/uploads/comprovantes/${nomeArquivo}" download class="btn-primary" style="text-decoration: none; padding: 10px 20px; background: var(--primary); color: white; border-radius: 8px;">
                        <i class="fas fa-download"></i> Baixar Comprovante
                    </a>
                    <a href="/uploads/comprovantes/${nomeArquivo}" target="_blank" class="btn-preview" style="text-decoration: none; padding: 10px 20px; background: var(--info); color: white; border-radius: 8px;">
                        <i class="fas fa-external-link-alt"></i> Abrir em Nova Aba
                    </a>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-file" style="font-size: 4rem; color: var(--gray-500);"></i>
                    <p style="margin-top: 16px; color: var(--gray-600);">Arquivo: ${nomeArquivo}</p>
                    <p style="color: var(--gray-500); font-size: 14px;">Tipo de arquivo não suportado para visualização online.</p>
                    <a href="/uploads/comprovantes/${nomeArquivo}" download class="btn-primary" style="display: inline-block; margin-top: 16px; text-decoration: none; padding: 10px 30px; background: var(--primary); color: white; border-radius: 8px;">
                        <i class="fas fa-download"></i> Baixar Comprovante
                    </a>
                </div>
            `;
        }
    }, 500);
}

// ==================== APROVAR PAGAMENTO ====================
async function aprovarPagamentoComprovante(pagamentoId, vendaId) {
    if (!confirm('✅ Confirmar aprovação deste pagamento?\n\nO cliente terá acesso ao download do livro.')) return;
    
    try {
        console.log('📤 Aprovando pagamento:', pagamentoId);
        
        const response = await fetch(`${API_URL}/pagamentos/${pagamentoId}/aprovar`, {
            method: 'PATCH'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao aprovar pagamento');
        }
        
        const vendaResponse = await fetch(`${API_URL}/vendas/${vendaId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'aprovado' })
        });
        
        if (!vendaResponse.ok) {
            console.warn('⚠️ Erro ao atualizar status da venda:', vendaResponse.status);
        }
        
        alert('✅ Pagamento aprovado com sucesso!\n\n📚 O livro foi liberado para o cliente.');
        
        await renderizarAnaliseComprovantes();
        await renderizarVendas();
        await carregarEstatisticas();
        await atualizarCarrinho();
        
    } catch (error) {
        console.error('❌ Erro ao aprovar:', error);
        alert('❌ Erro ao aprovar pagamento: ' + error.message);
    }
}

// ==================== REJEITAR PAGAMENTO ====================
async function rejeitarPagamentoComprovante(pagamentoId, vendaId) {
    const motivo = prompt('❌ Motivo da rejeição (opcional):');
    if (motivo === null) return;
    
    if (!confirm('❌ Confirmar rejeição deste pagamento?')) return;
    
    try {
        console.log('📤 Rejeitando pagamento:', pagamentoId);
        
        const response = await fetch(`${API_URL}/pagamentos/${pagamentoId}/rejeitar`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo: motivo || 'Não informado' })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao rejeitar pagamento');
        }
        
        const vendaResponse = await fetch(`${API_URL}/vendas/${vendaId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejeitado' })
        });
        
        if (!vendaResponse.ok) {
            console.warn('⚠️ Erro ao atualizar status da venda:', vendaResponse.status);
        }
        
        alert('❌ Pagamento rejeitado.\n\nMotivo: ' + (motivo || 'Não informado'));
        
        await renderizarAnaliseComprovantes();
        await renderizarVendas();
        await carregarEstatisticas();
        await atualizarCarrinho();
        
    } catch (error) {
        console.error('❌ Erro ao rejeitar:', error);
        alert('❌ Erro ao rejeitar pagamento: ' + error.message);
    }
}

// ==================== FUNÇÕES GERAIS ====================
function mudarTab(tab) {
    console.log('📑 Mudando para tab:', tab);
    
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tab}`);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log('✅ Tab ativada:', tab);
    } else {
        console.error('❌ Tab não encontrada:', tab);
    }
    
    const targetBtn = document.querySelector(`[onclick*="mudarTab('${tab}')"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    
    if (tab === 'vendas') {
        renderizarVendas();
    }
    if (tab === 'admin') {
        console.log('🔄 Carregando admin...');
        renderizarAnaliseComprovantes();
        carregarEstatisticas();
        renderizarTabelaAdmin();
    }
}

function fecharModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
    }
    document.removeEventListener('keydown', bloquearDownloadImpressao);
    document.removeEventListener('contextmenu', bloquearCliqueDireito);
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
        document.removeEventListener('keydown', bloquearDownloadImpressao);
        document.removeEventListener('contextmenu', bloquearCliqueDireito);
    }
}

// ==================== VENDAS ====================
async function renderizarVendas() {
    const container = document.getElementById('lista-vendas');
    container.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-spinner fa-spin"></i> Carregando...</div>';
    
    try {
        const response = await fetch(`${API_URL}/vendas`);
        if (!response.ok) throw new Error('Erro ao carregar vendas');
        const todasVendas = await response.json();
        
        let vendas = [];
        if (clienteAtual) {
            vendas = todasVendas.filter(v => v.cliente.toLowerCase() === clienteAtual.toLowerCase());
            console.log(`👤 Mostrando ${vendas.length} compras do cliente: ${clienteAtual}`);
        } else {
            if (usuarioAdmin) {
                vendas = todasVendas;
                console.log('👑 Admin visualizando todas as vendas');
            } else {
                vendas = [];
                console.log('👤 Nenhum cliente definido');
            }
        }
        
        if (vendas.length === 0) {
            if (!clienteAtual) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                        <i class="fas fa-user" style="font-size: 3rem; display: block; margin-bottom: 15px; color: var(--secondary);"></i>
                        <h3>Identifique-se para ver suas compras</h3>
                        <p style="margin: 10px 0 20px 0;">Digite seu nome abaixo para ver seus livros comprados</p>
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                            <input type="text" id="input-cliente-login" placeholder="Digite seu nome" style="padding: 10px 20px; border: 2px solid var(--gray-300); border-radius: 8px; font-size: 16px;">
                            <button onclick="loginCliente()" class="btn-primary" style="padding: 10px 30px;">
                                <i class="fas fa-sign-in-alt"></i> Entrar
                            </button>
                        </div>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--gray-600);">
                        <i class="fas fa-shopping-bag" style="font-size: 3rem; display: block; margin-bottom: 15px;"></i>
                        <h3>Nenhuma compra encontrada</h3>
                        <p>Você ainda não comprou nenhum livro, ${clienteAtual}.</p>
                        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 15px;">
                            <button onclick="mudarTab('catalogo')" class="btn-primary">
                                <i class="fas fa-book"></i> Explorar Catálogo
                            </button>
                            <button onclick="logoutCliente()" class="btn-danger">
                                <i class="fas fa-sign-out-alt"></i> Sair
                            </button>
                        </div>
                    </div>
                `;
            }
            return;
        }
        
        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3 style="margin: 0; color: var(--primary-dark);">
                        <i class="fas fa-user"></i> ${clienteAtual}
                    </h3>
                    <p style="margin: 0; color: var(--gray-500); font-size: 14px;">
                        ${vendas.length} livro(s) comprado(s)
                    </p>
                </div>
                <button onclick="logoutCliente()" class="btn-danger" style="padding: 8px 20px;">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </button>
            </div>
            <div class="vendas-grid" style="display: flex; flex-direction: column; gap: 16px;">
        `;
        
        vendas.sort((a, b) => {
            if (a.status === 'pendente' && b.status !== 'pendente') return -1;
            if (a.status !== 'pendente' && b.status === 'pendente') return 1;
            return new Date(b.data_venda) - new Date(a.data_venda);
        });
        
        vendas.forEach(venda => {
            const statusClass = venda.status === 'aprovado' ? 'status-aprovado' : 
                               venda.status === 'rejeitado' ? 'status-rejeitado' : 'status-pendente';
            const statusIcon = venda.status === 'aprovado' ? '✅' : 
                              venda.status === 'rejeitado' ? '❌' : '⏳';
            
            const ehGratuito = venda.eh_gratuito || venda.total === 0;
            const podeBaixar = venda.status === 'aprovado' || ehGratuito;
            
            const statusTexto = venda.status === 'aprovado' ? 'Aprovado' : 
                               venda.status === 'rejeitado' ? 'Rejeitado' : 'Aguardando Aprovação';
            
            container.innerHTML += `
                <div class="card-livro" style="background: white; border-radius: 12px; padding: 20px; border: 1px solid var(--gray-200);">
                    <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 10px;">
                        <div>
                            <h3 style="margin: 0;">${venda.livro_titulo || 'Livro removido'}</h3>
                            <div style="color: var(--gray-600); font-size: 14px;"><i class="fas fa-user"></i> ${venda.cliente}</div>
                            ${ehGratuito ? '<span class="badge-free-small" style="background: #28a745; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px;"><i class="fas fa-gift"></i> Grátis</span>' : ''}
                        </div>
                        <div style="text-align: right;">
                            <span class="status-badge ${statusClass}" style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">${statusIcon} ${statusTexto}</span>
                            ${venda.status === 'rejeitado' ? '<div style="font-size: 11px; color: var(--danger); margin-top: 4px;">Pagamento rejeitado</div>' : ''}
                        </div>
                    </div>
                    <div style="display: flex; gap: 16px; margin: 10px 0; font-size: 13px; color: var(--gray-600);">
                        <span><i class="fas fa-hashtag"></i> ${venda.id}</span>
                        <span><i class="fas fa-box"></i> ${venda.quantidade} un.</span>
                        <span><i class="fas fa-credit-card"></i> ${venda.metodo || 'N/A'}</span>
                    </div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--secondary);">
                        ${ehGratuito ? '🎁 GRATUITO' : `Kz ${parseFloat(venda.total).toFixed(2)}`}
                    </div>
                    <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">
                        <i class="fas fa-calendar"></i> ${new Date(venda.data_venda).toLocaleString()}
                    </div>
                    
                    ${podeBaixar ? `
                        <button class="btn-download" onclick="baixarPDF('${venda.livro_id}')" style="margin-top: 12px; width: 100%; padding: 10px; background: var(--success); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-download"></i> Baixar Livro
                        </button>
                    ` : ''}
                    
                    ${venda.status === 'pendente' && !ehGratuito ? `
                        <div style="margin-top: 12px; padding: 12px; background: #fff3cd; border-radius: 8px; font-size: 13px; color: #856404; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-clock"></i> 
                            <span>⏳ Aguardando aprovação do pagamento.</span>
                        </div>
                    ` : ''}
                    
                    ${venda.status === 'rejeitado' && !ehGratuito ? `
                        <div style="margin-top: 12px; padding: 12px; background: #f8d7da; border-radius: 8px; font-size: 13px; color: #721c24; display: flex; align-items: center; gap: 8px;">
                            <i class="fas fa-times-circle"></i> 
                            <span>❌ Pagamento rejeitado. Entre em contato com o suporte.</span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        container.innerHTML += '</div>';
    } catch (error) {
        container.innerHTML = `<p style="color: var(--danger);">Erro ao carregar vendas: ${error.message}</p>`;
    }
}

function baixarPDF(livroId) {
    const livro = livros.find(l => l.id === livroId);
    if (!livro || !livro.arquivo_pdf) {
        alert('❌ Arquivo não encontrado!');
        return;
    }
    
    const modal = document.getElementById('modal-download');
    document.getElementById('download-conteudo').innerHTML = `
        <div style="text-align: center; padding: 30px;">
            <div style="font-size: 4rem; color: var(--success);">
                <i class="fas fa-check-circle"></i>
            </div>
            <h2 style="margin: 20px 0;">Download Liberado!</h2>
            <p>Pagamento aprovado! Baixe seu livro:</p>
            <h3 style="margin: 20px 0; color: var(--primary-dark);">"${livro.titulo}"</h3>
            <p style="color: var(--gray-600);">Autor: ${livro.autor}</p>
            <a href="/uploads/livros/${livro.arquivo_pdf}" download class="btn-success" style="display: inline-block; margin-top: 20px; padding: 15px 40px; text-decoration: none;">
                <i class="fas fa-download"></i> Baixar PDF
            </a>
        </div>
    `;
    modal.style.display = 'block';
}

// ==================== ESTATÍSTICAS ====================
async function carregarEstatisticas() {
    try {
        const response = await fetch(`${API_URL}/vendas/estatisticas/resumo`);
        if (!response.ok) throw new Error('Erro ao carregar estatísticas');
        const stats = await response.json();
        
        document.getElementById('total-livros').textContent = livros.length || 0;
        document.getElementById('total-vendas').textContent = stats.total_vendas || 0;
        document.getElementById('pendentes').textContent = stats.pendentes || 0;
        document.getElementById('total-faturado').textContent = `Kz ${(stats.total_faturado || 0).toFixed(2)}`;
    } catch (error) {
        console.error('Erro:', error);
    }
}

function atualizarEstatisticas() {
    carregarEstatisticas();
}

// ==================== CARRINHO ====================
async function atualizarCarrinho() {
    try {
        const response = await fetch(`${API_URL}/vendas`);
        if (!response.ok) return;
        const vendas = await response.json();
        const pendentes = vendas.filter(v => v.status === 'pendente');
        document.getElementById('carrinho-count').textContent = pendentes.length;
    } catch (error) {
        document.getElementById('carrinho-count').textContent = '0';
    }
}

function abrirCarrinho() {
    mudarTab('vendas');
}

// ==================== FORMULÁRIO ADMIN ====================
document.getElementById('form-livro').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const titulo = document.getElementById('livro-titulo').value;
    const autor = document.getElementById('livro-autor').value;
    const preco = parseFloat(document.getElementById('livro-preco').value);
    const quantidade = parseInt(document.getElementById('livro-quantidade').value);
    const categoria = document.getElementById('livro-categoria').value;
    const arquivoPDF = document.getElementById('livro-pdf').files[0];
    const ehGratuito = document.getElementById('livro-gratuito').checked;
    
    if (!titulo || !autor || !preco || !quantidade || !categoria) {
        alert('❌ Preencha todos os campos!');
        return;
    }
    
    try {
        let arquivo_pdf = null;
        if (arquivoPDF) {
            const formData = new FormData();
            formData.append('pdf', arquivoPDF);
            const uploadResponse = await fetch('/api/upload/pdf', {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();
            arquivo_pdf = uploadResult.filename;
        }
        
        await fetch(`${API_URL}/livros`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                titulo, autor, preco, quantidade, categoria, 
                arquivo_pdf, 
                eh_gratuito: ehGratuito || preco === 0 
            })
        });
        
        await carregarLivros();
        await carregarCategorias();
        renderizarTabelaAdmin();
        this.reset();
        alert('✅ Livro adicionado com sucesso!');
    } catch (error) {
        alert('❌ Erro: ' + error.message);
    }
});

// ==================== RECARREGAMENTO ====================
setInterval(() => {
    if (document.getElementById('tab-catalogo')?.classList.contains('active')) {
        carregarLivros();
    }
    if (document.getElementById('tab-vendas')?.classList.contains('active')) {
        renderizarVendas();
    }
    if (document.getElementById('tab-admin')?.classList.contains('active')) {
        renderizarAnaliseComprovantes();
        carregarEstatisticas();
        renderizarTabelaAdmin();
    }
    atualizarCarrinho();
}, 30000);

console.log('📚 Livraria Virtual carregada com sucesso!');
console.log('🔑 Admin: admin / admin123');
console.log('👤 Cliente: Digite seu nome em "Minhas Compras"');