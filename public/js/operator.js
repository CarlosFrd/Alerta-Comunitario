// ===== VARIÁVEIS DO OPERADOR =====
let operatorMap = null;
let markerClusterGroup = null;
const operatorReportMarkers = {};
let operatorReportsListener = null;
let selectedReportId = null;
let selectedReportIds = new Set(); // Para seleção múltipla
let allReports = [];
let sidebarCollapsed = false;

// ===== FUNÇÕES DO OPERADOR =====

function initOperatorMap() {
    console.log('🗺️ Inicializando mapa do operador...');

    const mapElement = document.getElementById('operator-map');
    if (!mapElement) {
        console.error('❌ Elemento #operator-map não encontrado!');
        return;
    }

    console.log('✅ Elemento do mapa encontrado, criando instância...');

    operatorMap = L.map('operator-map').setView([-8.0476, -34.8770], 13);

    console.log('✅ Mapa criado, adicionando tiles...');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(operatorMap);

    // Criar pane customizado para markers ficarem acima de tudo
    operatorMap.createPane('markersPane');
    operatorMap.getPane('markersPane').style.zIndex = 650; // Acima de overlayPane (400) e tooltipPane (600)

    // Inicializar MarkerCluster
    markerClusterGroup = L.markerClusterGroup({
        maxClusterRadius: 80,
        disableClusteringAtZoom: 16, // A partir do zoom 16, mostra markers individuais
        spiderfyOnMaxZoom: false, // Não usar spiderfy, apenas mostrar individuais
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            let className = 'marker-cluster-';

            if (count < 10) {
                className += 'small';
            } else if (count < 50) {
                className += 'medium';
            } else {
                className += 'large';
            }

            return L.divIcon({
                html: '<div><span>' + count + '</span></div>',
                className: 'marker-cluster ' + className,
                iconSize: L.point(40, 40)
            });
        }
    });

    operatorMap.addLayer(markerClusterGroup);

    console.log('✅ Tiles e cluster adicionados, aguardando carregamento...');

    operatorMap.whenReady(() => {
        console.log('✅ Mapa do operador pronto!');
        loadOperatorReports();
        loadRiskZones(operatorMap, true);
        initDrawControls();

        // Carregar marcadores de cidadãos em zonas de risco
        if (typeof loadCitizenSafetyMarkers === 'function') {
            loadCitizenSafetyMarkers(operatorMap);
        }
    });

    setTimeout(() => {
        operatorMap.invalidateSize();
        console.log('🔄 Mapa redimensionado');
    }, 250);
}

function loadOperatorReports() {
    console.log('🔥 Carregando relatos do operador...');

    operatorReportsListener = db.collection('reports')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            console.log('📊 Snapshot recebido. Total de documentos:', snapshot.size);

            allReports = [];

            snapshot.forEach((doc) => {
                const reportData = doc.data();
                allReports.push({
                    id: doc.id,
                    ...reportData
                });
                console.log('📄 Relato carregado:', doc.id, reportData);
            });

            console.log('📦 Total de relatos no array:', allReports.length);

            // Limpar markers antigos
            markerClusterGroup.clearLayers();
            for (const markerId in operatorReportMarkers) {
                delete operatorReportMarkers[markerId];
            }

            // Criar markers para cada report
            for (const report of allReports) {
                addOperatorReportMarker(report.id, report);
            }

            updateOperatorUI();

            console.log('🎯 Total de marcadores no mapa:', Object.keys(operatorReportMarkers).length);
        }, (error) => {
            console.error('❌ Erro ao carregar relatos do operador:', error);
        });
}

function addOperatorReportMarker(reportId, report) {
    if (!report.location || !operatorMap) {
        console.warn('⚠️ Não foi possível adicionar marcador:', reportId, {
            hasLocation: !!report.location,
            hasMap: !!operatorMap
        });
        return;
    }

    const { lat, lng } = report.location;

    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
        console.warn('⚠️ Coordenadas inválidas para:', reportId, { lat, lng });
        return;
    }

    const status = report.status || 'aberto';

    const statusColors = {
        'aberto': '#FBC02D',
        'confirmado': '#D32F2F',
        'atendimento': '#F57C00',
        'resolvido': '#388E3C'
    };

    const color = statusColors[status];

    console.log(`📍 Adicionando marcador: ${reportId} em ${lat}, ${lng}`);

    const marker = L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
        reportId: reportId, // Guardar ID no marker
        pane: 'markersPane' // Usar pane customizado com z-index alto
    });

    marker.bindPopup(() => createOperatorPopup(reportId, report));

    marker.on('click', (e) => {
        // Prevenir propagação
        L.DomEvent.stopPropagation(e);

        // Se Ctrl/Cmd está pressionado, alternar seleção
        if (e.originalEvent.ctrlKey || e.originalEvent.metaKey) {
            toggleReportSelection(reportId);

            // Se removeu a seleção e era o único selecionado, limpar selectedReportId
            if (!selectedReportIds.has(reportId)) {
                if (selectedReportId === reportId) {
                    selectedReportId = null;
                }
            }
        } else {
            // Limpar seleções anteriores e selecionar apenas este
            selectedReportIds.clear();
            selectedReportIds.add(reportId);
            selectReport(reportId);
        }

        updateMarkerStyles();
        updateCardStyles();
        updateBulkActionBar();
    });

    markerClusterGroup.addLayer(marker);
    operatorReportMarkers[reportId] = marker;

    console.log(`✅ Marcador adicionado: ${reportId}`);
}

function toggleReportSelection(reportId) {
    if (selectedReportIds.has(reportId)) {
        selectedReportIds.delete(reportId);
    } else {
        selectedReportIds.add(reportId);
    }
}

function updateMarkerStyles() {
    // Atualizar estilos dos markers baseado na seleção
    for (const reportId in operatorReportMarkers) {
        const marker = operatorReportMarkers[reportId];
        const isSelected = selectedReportIds.has(reportId);

        if (isSelected) {
            marker.setStyle({
                weight: 4,
                color: '#3b82f6'
            });
        } else {
            marker.setStyle({
                weight: 2,
                color: '#fff'
            });
        }
    }
}

function updateCardStyles() {
    // Atualizar estilos dos cards baseado na seleção
    document.querySelectorAll('.report-card').forEach(card => {
        const reportId = card.dataset.reportId;

        // Remover ambas as classes primeiro
        card.classList.remove('selected', 'multi-selected');

        // Adicionar classe apropriada se estiver selecionado
        if (selectedReportIds.has(reportId)) {
            card.classList.add('multi-selected');
        }
    });
}

function updateBulkActionBar() {
    const count = selectedReportIds.size;
    let bulkBar = document.getElementById('bulk-action-bar');

    if (count > 1) {
        if (!bulkBar) {
            // Criar barra de ação em lote
            bulkBar = document.createElement('div');
            bulkBar.id = 'bulk-action-bar';
            bulkBar.className = 'bulk-action-bar';
            bulkBar.innerHTML = `
                <div class="bulk-action-content">
                    <span id="bulk-count" class="bulk-count">0 selecionados</span>
                    <div class="bulk-actions">
                        <button class="bulk-btn bulk-btn-confirmar" onclick="updateBulkStatus('confirmado')">
                            Confirmar Todos
                        </button>
                        <button class="bulk-btn bulk-btn-atender" onclick="updateBulkStatus('atendimento')">
                            Atender Todos
                        </button>
                        <button class="bulk-btn bulk-btn-finalizar" onclick="updateBulkStatus('resolvido')">
                            Finalizar Todos
                        </button>
                        <button class="bulk-btn bulk-btn-cancel" onclick="clearBulkSelection()">
                            Cancelar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(bulkBar);
        }

        document.getElementById('bulk-count').textContent = `${count} selecionados`;
        bulkBar.classList.add('visible');
    } else {
        if (bulkBar) {
            bulkBar.classList.remove('visible');
        }
    }
}

function clearBulkSelection() {
    selectedReportIds.clear();
    selectedReportId = null;

    updateMarkerStyles();
    updateCardStyles();
    updateBulkActionBar();
}

async function updateBulkStatus(newStatus) {
    if (selectedReportIds.size === 0) return;

    const count = selectedReportIds.size;
    const confirmMsg = `Tem certeza que deseja atualizar ${count} relatos para "${newStatus}"?`;

    if (!confirm(confirmMsg)) return;

    try {
        const batch = db.batch();

        for (const reportId of selectedReportIds) {
            const reportRef = db.collection('reports').doc(reportId);

            if (newStatus === 'resolvido') {
                batch.delete(reportRef);
            } else {
                batch.update(reportRef, {
                    status: newStatus,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentUser.uid
                });
            }
        }

        await batch.commit();

        console.log(`✅ ${count} relatos atualizados para ${newStatus}`);
        alert(`✅ ${count} relatos atualizados com sucesso!`);

        clearBulkSelection();

    } catch (error) {
        console.error('❌ Erro ao atualizar em lote:', error);
        alert('Erro ao atualizar relatos. Tente novamente.');
    }
}

function createOperatorPopup(reportId, reportData) {
    const status = reportData.status || 'aberto';
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };

    const statusLabels = {
        'aberto': 'Aberto',
        'confirmado': 'Confirmado',
        'atendimento': 'Em Atendimento',
        'resolvido': 'Resolvido'
    };

    const typeIcon = typeIcons[reportData.type] || '❓';
    const typeName = reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1);
    const date = reportData.createdAt ? new Date(reportData.createdAt.toDate()).toLocaleString('pt-BR') : 'Agora';

    const popupDiv = document.createElement('div');
    popupDiv.className = 'operator-popup';
    popupDiv.innerHTML = `
        <div class="operator-popup-header">
            <div class="operator-popup-title">${typeIcon} ${typeName}</div>
            <span class="operator-popup-status popup-status-${status}">${statusLabels[status]}</span>
        </div>
        <p class="operator-popup-description">${reportData.description}</p>
        <div class="operator-popup-meta">
            <div>👤 ${reportData.userName}</div>
            <div>📅 ${date}</div>
        </div>
        <div class="operator-popup-hint">
            <small>💡 Dica: Use Ctrl+Click para selecionar múltiplos relatos</small>
        </div>
        <div class="operator-popup-actions">
            <button class="popup-action-btn btn-confirmar" data-action="confirmado" data-id="${reportId}" ${status === 'confirmado' || status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                Confirmar
            </button>
            <button class="popup-action-btn btn-atender" data-action="atendimento" data-id="${reportId}" ${status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                Atender
            </button>
            <button class="popup-action-btn btn-finalizar" data-action="resolvido" data-id="${reportId}" ${status === 'resolvido' ? 'disabled' : ''}>
                Finalizar
            </button>
        </div>
    `;

    popupDiv.querySelectorAll('.popup-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const id = btn.dataset.id;

            if (!btn.disabled) {
                await updateReportStatus(id, action);
            }
        });
    });

    return popupDiv;
}

async function updateReportStatus(reportId, newStatus) {
    try {
        if (newStatus === 'resolvido') {
            console.log(`🗑️ Finalizando e deletando report ${reportId}...`);

            await db.collection('reports').doc(reportId).delete();

            console.log('✅ Report finalizado e deletado!');
            alert('✅ Report finalizado e removido do mapa!');
        } else {
            console.log(`🔄 Atualizando report ${reportId} para ${newStatus}...`);

            await db.collection('reports').doc(reportId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.uid
            });

            console.log('✅ Report atualizado com sucesso!');
            alert(`✅ Report marcado como ${newStatus}!`);
        }

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        alert('Erro ao atualizar report. Tente novamente.');
    }
}

function updateOperatorUI() {
    const reportsList = document.getElementById('operator-reports-list');
    const totalReports = document.getElementById('total-reports');
    const statusFilter = document.getElementById('status-filter');

    if (!reportsList) return;

    const filterValue = statusFilter ? statusFilter.value : 'all';
    const filteredReports = filterValue === 'all'
        ? allReports
        : allReports.filter(r => (r.status || 'aberto') === filterValue);

    if (totalReports) {
        totalReports.textContent = `${allReports.length} total`;
    }

    reportsList.innerHTML = '';

    if (filteredReports.length === 0) {
        reportsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔭</div>
                <p>Nenhum relato encontrado</p>
            </div>
        `;
        return;
    }

    filteredReports.forEach(report => {
        const card = createReportCard(report);
        reportsList.appendChild(card);
    });
}

function createReportCard(report) {
    const status = report.status || 'aberto';
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };

    const typeIcon = typeIcons[report.type] || '❓';
    const typeName = report.type.charAt(0).toUpperCase() + report.type.slice(1);
    const date = report.createdAt ? new Date(report.createdAt.toDate()).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }) : 'Agora';

    const card = document.createElement('div');
    card.className = 'report-card';
    card.dataset.reportId = report.id;

    // As classes de seleção serão adicionadas por updateCardStyles()
    if (selectedReportIds.has(report.id)) {
        card.classList.add('multi-selected');
    }

    card.innerHTML = `
        <div class="report-card-content">
            <div class="report-card-header">
                <span class="report-type">${typeIcon} ${typeName}</span>
                <span class="report-status status-${status}"></span>
            </div>
            <p class="report-description">${report.description}</p>
            <div class="report-meta">
                <span>👤 ${report.userName}</span>
                <span>📅 ${date}</span>
            </div>
        </div>
    `;

    // Evento de click no card com suporte a Ctrl+Click
    card.addEventListener('click', (e) => {
        // Se Ctrl/Cmd está pressionado, alternar seleção múltipla
        if (e.ctrlKey || e.metaKey) {
            toggleReportSelection(report.id);

            // Se removeu a seleção e era o único selecionado, limpar selectedReportId
            if (!selectedReportIds.has(report.id)) {
                if (selectedReportId === report.id) {
                    selectedReportId = null;
                }
            }
        } else {
            // Limpar seleções anteriores e selecionar apenas este
            selectedReportIds.clear();
            selectedReportIds.add(report.id);
            selectReport(report.id);
        }

        updateMarkerStyles();
        updateBulkActionBar();
        updateCardStyles();
    });

    return card;
}

function selectReport(reportId) {
    selectedReportId = reportId;

    const report = allReports.find(r => r.id === reportId);
    if (report && report.location && operatorMap) {
        // Apenas centralizar sem alterar o zoom
        operatorMap.panTo([report.location.lat, report.location.lng]);

        if (operatorReportMarkers[reportId]) {
            operatorReportMarkers[reportId].openPopup();
        }
    }
}

// ===== CONTROLE DA SIDEBAR =====
function initSidebarToggle() {
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('dashboard-sidebar');

    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebarCollapsed = !sidebarCollapsed;
            sidebar.classList.toggle('collapsed');
            toggleBtn.classList.toggle('sidebar-collapsed');

            // Aguardar a animação e então redimensionar o mapa
            setTimeout(() => {
                if (operatorMap) {
                    operatorMap.invalidateSize();
                }
            }, 300);
        });
    }
}
