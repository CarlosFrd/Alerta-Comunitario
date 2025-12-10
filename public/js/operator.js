// ===== VARIÁVEIS DO OPERADOR =====
let operatorMap = null;
const operatorReportMarkers = {};
let operatorReportsListener = null;
let selectedReportId = null;
let allReports = [];
let groupedReports = {};  // Reports agrupados por groupId

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

    console.log('✅ Tiles adicionados, aguardando carregamento...');

    operatorMap.whenReady(() => {
        console.log('✅ Mapa do operador pronto!');
        loadOperatorReports();
        loadRiskZones(operatorMap, true);
        initDrawControls();
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
            for (const markerId in operatorReportMarkers) {
                operatorMap.removeLayer(operatorReportMarkers[markerId]);
                delete operatorReportMarkers[markerId];
            }

            // Cada report agora é um agrupamento de incidentes
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

    // Contar quantos cidadãos reportaram este incidente
    const citizenCount = (report.citizens && report.citizens.length) || 1;

    // Usar raio maior se há múltiplos cidadãos
    const radius = citizenCount > 1 ? 16 : 12;

    console.log(`📍 Adicionando marcador: ${reportId}, Cidadãos: ${citizenCount}, em ${lat}, ${lng}`);

    const marker = L.circleMarker([lat, lng], {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
    });

    // Se há múltiplos cidadãos, exibir número no centro
    if (citizenCount > 1) {
        const label = L.divIcon({
            html: `<div style="font-weight: bold; font-size: 12px; color: white; text-align: center; line-height: 32px;">${citizenCount}</div>`,
            iconSize: [32, 32],
            className: 'cluster-label'
        });
        L.marker([lat, lng], { icon: label }).addTo(operatorMap);
    }

    marker.bindPopup(() => createOperatorGroupPopup(reportId, report));

    marker.on('click', () => {
        selectReport(reportId);
    });

    marker.addTo(operatorMap);
    operatorReportMarkers[reportId] = marker;

    console.log(`✅ Marcador adicionado: ${citizenCount} cidadão(s) reportou/reportaram este incidente`);
}

function createOperatorGroupPopup(reportId, report) {
    const popupDiv = document.createElement('div');
    popupDiv.className = 'operator-popup';

    const status = report.status || 'aberto';
    const citizens = report.citizens || [];
    const types = report.types || [report.type];

    const statusLabels = {
        'aberto': 'Aberto',
        'confirmado': 'Confirmado',
        'atendimento': 'Em Atendimento',
        'resolvido': 'Resolvido'
    };

    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };

    // Se há apenas 1 cidadão
    if (citizens.length === 1) {
        const citizen = citizens[0];
        const typeIcon = typeIcons[citizen.type] || '❓';
        const typeName = citizen.type.charAt(0).toUpperCase() + citizen.type.slice(1);

        popupDiv.innerHTML = `
            <div class="operator-popup-header">
                <div class="operator-popup-title">${typeIcon} ${typeName}</div>
                <span class="operator-popup-status popup-status-${status}">${statusLabels[status]}</span>
            </div>
            <p class="operator-popup-description">${citizen.description}</p>
            <div class="operator-popup-meta">
                <div>👤 ${citizen.userName}</div>
                <div>📅 ${citizen.createdAt}</div>
            </div>
            <div class="operator-popup-actions">
                <button class="popup-action-btn btn-confirmar" data-action="confirmado" data-report-id="${reportId}" ${status === 'confirmado' || status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                    Confirmar
                </button>
                <button class="popup-action-btn btn-atender" data-action="atendimento" data-report-id="${reportId}" ${status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                    Atender
                </button>
                <button class="popup-action-btn btn-finalizar" data-action="resolvido" data-report-id="${reportId}" ${status === 'resolvido' ? 'disabled' : ''}>
                    Finalizar
                </button>
            </div>
        `;
    } else {
        // Se há múltiplos cidadãos
        let citizensList = '';
        citizens.forEach((citizen, index) => {
            const typeIcon = typeIcons[citizen.type] || '❓';
            const typeName = citizen.type.charAt(0).toUpperCase() + citizen.type.slice(1);

            citizensList += `
                <div style="background: #f1f5f9; border-left: 4px solid #FBC02D; padding: 12px; margin: 8px 0; border-radius: 4px;">
                    <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">
                        ${typeIcon} ${typeName}
                    </div>
                    <p style="margin: 4px 0; color: #64748b; font-size: 13px;">${citizen.description}</p>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        👤 ${citizen.userName} | 📅 ${citizen.createdAt}
                    </div>
                </div>
            `;
        });

        popupDiv.innerHTML = `
            <div class="operator-popup-header">
                <div class="operator-popup-title">📍 Agrupamento de Incidentes</div>
                <span class="operator-popup-status popup-status-${status}">${statusLabels[status]}</span>
            </div>
            <div style="background: #f0f9ff; padding: 8px; border-radius: 4px; margin-bottom: 12px; text-align: center;">
                <span style="font-weight: 600; color: #0369a1;">${citizens.length} cidadão(s) reportou/reportaram</span>
            </div>
            <div style="max-height: 300px; overflow-y: auto; padding: 8px 0;">
                ${citizensList}
            </div>
            <div class="operator-popup-actions" style="margin-top: 12px;">
                <button class="popup-action-btn btn-confirmar" data-action="confirmado" data-report-id="${reportId}" ${status === 'confirmado' || status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                    Confirmar TODOS
                </button>
                <button class="popup-action-btn btn-atender" data-action="atendimento" data-report-id="${reportId}" ${status === 'atendimento' || status === 'resolvido' ? 'disabled' : ''}>
                    Atender TODOS
                </button>
                <button class="popup-action-btn btn-finalizar" data-action="resolvido" data-report-id="${reportId}" ${status === 'resolvido' ? 'disabled' : ''}>
                    Finalizar TODOS
                </button>
            </div>
        `;
    }

    popupDiv.querySelectorAll('.popup-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const action = btn.dataset.action;
            const rId = btn.dataset.reportId;

            if (!btn.disabled) {
                await updateReportStatus(rId, action);
            }
        });
    });

    return popupDiv;
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
        // Se o status é "resolvido", deletar o agrupamento completo
        if (newStatus === 'resolvido') {
            console.log(`🗑️ Finalizando e deletando agrupamento ${reportId}...`);

            await db.collection('reports').doc(reportId).delete();

            console.log('✅ Agrupamento de incidentes finalizado e deletado!');
            alert('✅ Agrupamento de incidentes finalizado e removido do mapa!');
        } else {
            // Para outros status, apenas atualizar
            console.log(`🔄 Atualizando agrupamento ${reportId} para ${newStatus}...`);

            await db.collection('reports').doc(reportId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.uid
            });

            console.log('✅ Agrupamento atualizado com sucesso!');
            alert(`✅ Agrupamento marcado como ${newStatus}!`);
        }

    } catch (error) {
        console.error('❌ Erro ao atualizar status:', error);
        alert('Erro ao atualizar agrupamento. Tente novamente.');
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
    if (selectedReportId === report.id) {
        card.classList.add('selected');
    }
    
    card.innerHTML = `
        <div class="report-card-header">
            <span class="report-type">${typeIcon} ${typeName}</span>
            <span class="report-status status-${status}"></span>
        </div>
        <p class="report-description">${report.description}</p>
        <div class="report-meta">
            <span>👤 ${report.userName}</span>
            <span>📅 ${date}</span>
        </div>
    `;
    
    card.addEventListener('click', () => {
        selectReport(report.id);
    });
    
    return card;
}

function viewReportDetail(reportId) {
    // Encontrar o report no array allReports
    const report = allReports.find(r => r.id === reportId);

    if (!report) {
        console.error('❌ Report não encontrado:', reportId);
        return;
    }

    // Fechar popup anterior
    operatorMap.closePopup();

    // Encontrar o grupo ao qual este report pertence
    for (const groupId in groupedReports) {
        const reportsInGroup = groupedReports[groupId];
        if (reportsInGroup.find(r => r.id === reportId)) {
            // Abrir o popup com apenas este report
            const marker = operatorReportMarkers[groupId];
            if (marker) {
                const singleReportPopup = createOperatorGroupPopup(groupId, [report]);
                marker.setPopupContent(singleReportPopup);
                marker.openPopup();
            }
            break;
        }
    }

    selectReport(reportId);
}

function selectReport(reportId) {
    selectedReportId = reportId;
    
    document.querySelectorAll('.report-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const cards = document.querySelectorAll('.report-card');
    const selectedIndex = allReports.findIndex(r => r.id === reportId);
    if (selectedIndex >= 0 && cards[selectedIndex]) {
        cards[selectedIndex].classList.add('selected');
    }
    
    const report = allReports.find(r => r.id === reportId);
    if (report && report.location && operatorMap) {
        operatorMap.setView([report.location.lat, report.location.lng], 16);
        
        if (operatorReportMarkers[reportId]) {
            operatorReportMarkers[reportId].openPopup();
        }
    }
}