// ===== VARIÁVEIS DO MAPA (CIDADÃO) =====
let map = null;
let userMarker = null;
let currentUserLocation = null;
let reportsListener = null;
const reportMarkers = {};
const CLUSTERING_RADIUS = 100;  // 100 metros

// ===== FUNÇÕES AUXILIARES =====

/**
 * Calcula distância em metros entre dois pontos (Fórmula de Haversine)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Raio da Terra em metros
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distância em metros
}

/**
 * Encontra reports próximos (dentro de 100m) com status aberto/confirmado/atendimento
 */
async function findNearbyActiveReports(lat, lng) {
    try {
        console.log('🔍 ════════════════════════════════════════');
        console.log('🔍 INICIANDO BUSCA POR REPORTS PRÓXIMOS');
        console.log('🔍 Coordenadas de busca:', { lat, lng });
        console.log('🔍 Raio de busca:', CLUSTERING_RADIUS, 'metros');
        console.log('🔍 ════════════════════════════════════════');

        // IMPORTANTE: Buscar SEM filtro de status primeiro para debugar
        const snapshot = await db.collection('reports').get();
        console.log('📊 TOTAL DE REPORTS NA COLLECTION:', snapshot.size);

        const nearbyReports = [];

        snapshot.forEach(doc => {
            const report = doc.data();
            const docId = doc.id;
            const status = report.status;

            console.log('\n📄 Report:', docId);
            console.log('   Status:', status);
            console.log('   Dados:', {
                hasLocation: !!report.location,
                location: report.location,
                citizensCount: report.citizens ? report.citizens.length : 0
            });

            // Verificar se tem localização
            if (!report.location || !report.location.lat || !report.location.lng) {
                console.warn('   ⚠️ PULANDO: Sem localização válida');
                return;
            }

            // Calcular distância
            const distance = calculateDistance(
                lat,
                lng,
                report.location.lat,
                report.location.lng
            );

            console.log('   📏 Distância calculada:', distance.toFixed(2), 'metros');
            console.log('   ✓ Status está em [aberto, confirmado, atendimento]?',
                ['aberto', 'confirmado', 'atendimento'].includes(status));

            // Verificar se está no raio e tem status ativo
            if (distance <= CLUSTERING_RADIUS) {
                if (['aberto', 'confirmado', 'atendimento'].includes(status)) {
                    console.log('   ✅ ENCONTRADO! Adicionando à lista');
                    nearbyReports.push({
                        id: docId,
                        ...report
                    });
                } else {
                    console.log('   ❌ DESCARTADO: Status não está ativo');
                }
            } else {
                console.log('   ❌ DESCARTADO: Distância > 100m');
            }
        });

        console.log('\n🔍 ════════════════════════════════════════');
        console.log('🔍 RESULTADO: Total de reports próximos ativos:', nearbyReports.length);
        console.log('🔍 ════════════════════════════════════════\n');

        return nearbyReports;
    } catch (error) {
        console.error('❌ ERRO NA BUSCA:', error);
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
        return [];
    }
}

// ===== FUNÇÕES DO MAPA (CIDADÃO) =====

function initCitizenMap() {
    console.log('🗺️ Inicializando mapa do cidadão...');
    
    map = L.map('map').setView([-8.0476, -34.8770], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    getUserLocation();
    loadReports();
    loadRiskZones(map, false);
}

function getUserLocation() {
    if (!navigator.geolocation) {
        console.warn('⚠️ Geolocalização não suportada');
        alert('Seu navegador não suporta geolocalização.');
        return;
    }
    
    console.log('📍 Solicitando localização...');
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            console.log('✅ Localização obtida:', lat, lng);
            
            currentUserLocation = { lat, lng };
            map.setView([lat, lng], 15);
            
            if (userMarker) {
                map.removeLayer(userMarker);
            }
            
            const blueIcon = L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
            
            userMarker = L.marker([lat, lng], { icon: blueIcon })
                .addTo(map)
                .bindPopup('<b>📍 Você está aqui</b>')
                .openPopup();
        },
        (error) => {
            console.error('❌ Erro ao obter localização:', error);
            
            let errorMsg = 'Não foi possível obter sua localização.';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Você negou a permissão de localização. Para usar o recurso de relatos, permita o acesso à localização.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Localização indisponível no momento.';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Tempo esgotado ao tentar obter localização.';
                    break;
            }
            
            alert(errorMsg);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function loadReports() {
    console.log('🔥 Carregando relatos...');
    
    reportsListener = db.collection('reports')
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const reportData = change.doc.data();
                const reportId = change.doc.id;
                
                if (change.type === 'added') {
                    addReportMarker(reportId, reportData);
                } else if (change.type === 'modified') {
                    updateReportMarker(reportId, reportData);
                } else if (change.type === 'removed') {
                    removeReportMarker(reportId);
                }
            });
        }, (error) => {
            console.error('❌ Erro ao carregar relatos:', error);
        });
}

function addReportMarker(reportId, reportData) {
    if (!reportData.location || !map) return;
    
    const { lat, lng } = reportData.location;
    
    const status = reportData.status || 'aberto';
    const statusColors = {
        'aberto': 'red',
        'confirmado': 'red',
        'atendimento': 'orange',
        'resolvido': 'green'
    };
    
    const markerColor = statusColors[status] || 'red';
    
    const typeIcons = {
        'alagamento': '🌊',
        'deslizamento': '⛰️',
        'incendio': '🔥',
        'acidente': '🚗',
        'outro': '❓'
    };
    
    const markerIcon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
    
    const typeIcon = typeIcons[reportData.type] || '❓';
    const typeName = reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1);
    const date = reportData.createdAt ? new Date(reportData.createdAt.toDate()).toLocaleString('pt-BR') : 'Agora';
    
    const statusLabels = {
        'aberto': '🟡 Aberto',
        'confirmado': '🔴 Confirmado',
        'atendimento': '🟠 Em Atendimento',
        'resolvido': '🟢 Resolvido'
    };
    
    const statusLabel = statusLabels[status] || '🟡 Aberto';

    // Verificar se há múltiplos cidadãos (agrupamento)
    const citizens = reportData.citizens || [];
    const isClustered = citizens.length > 1;

    let citizensHtml = '';
    if (isClustered) {
        // Mostrar lista de cidadãos
        citizensHtml = `
            <div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                <p style="margin: 0 0 6px 0; font-weight: 600; color: #1e293b; font-size: 0.85rem;">👥 ${citizens.length} cidadão(s) reportou/reportaram:</p>
                <ul style="margin: 0; padding-left: 16px; list-style: disc;">
                    ${citizens.map(citizen => `
                        <li style="margin: 4px 0; font-size: 0.8rem; color: #64748b;">
                            <strong>${citizen.userName || 'Cidadão'}</strong>: ${citizen.description}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    } else if (citizens.length === 1) {
        // Mostrar dados do único cidadão
        citizensHtml = `
            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 0.85rem;">${citizens[0].description}</p>
        `;
    }

    const popupContent = `
        <div style="min-width: 250px;">
            <h3 style="margin: 0 0 8px 0; color: #1e293b;">${typeIcon} ${typeName}</h3>
            <div style="margin: 0 0 8px 0;">
                <span style="background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${statusLabel}</span>
                ${isClustered ? `<span style="background: #3b82f6; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; margin-left: 4px;">🔗 Agrupamento</span>` : ''}
            </div>
            ${citizensHtml}
            <p style="margin: 0; color: #94a3b8; font-size: 0.75rem;">📅 ${date}</p>
        </div>
    `;

    marker.bindPopup(popupContent);
    reportMarkers[reportId] = marker;
    
    console.log('✅ Marcador adicionado:', reportId);
}

function updateReportMarker(reportId, reportData) {
    if (reportMarkers[reportId]) {
        removeReportMarker(reportId);
        addReportMarker(reportId, reportData);
    }
}

function removeReportMarker(reportId) {
    if (reportMarkers[reportId]) {
        map.removeLayer(reportMarkers[reportId]);
        delete reportMarkers[reportId];
        console.log('🗑️ Marcador removido:', reportId);
    }
}

// ===== FUNÇÕES DO MODAL =====

async function openReportModal() {
    console.log('📝 ═════════════════════════════════════════════');
    console.log('📝 ABRINDO MODAL DE RELATO');
    console.log('📝 currentUser:', currentUser ? `${currentUser.uid} (${currentUser.displayName})` : 'NÃO DEFINIDO');
    console.log('📝 ═════════════════════════════════════════════');

    // Verificar se o usuário está logado
    if (!currentUser) {
        console.error('❌ Usuário não logado!');
        alert('Você precisa estar logado para abrir um relato.');
        return;
    }

    // Verificar se o cidadão já tem um relato ativo
    try {
        console.log('🔍 Buscando relatórios ativos...');
        const activeReports = await db.collection('reports')
            .where('status', 'in', ['aberto', 'confirmado', 'atendimento'])
            .get();

        console.log(`📊 ${activeReports.size} relatórios ativos encontrados`);

        // Verificar se o usuário atual está em algum dos relatórios ativos
        let hasActiveReport = false;
        let foundInReportId = null;

        activeReports.forEach(doc => {
            const report = doc.data();
            const citizens = report.citizens || [];
            console.log(`   📄 Verificando relatório ${doc.id}: ${citizens.length} cidadãos`);

            citizens.forEach((citizen, index) => {
                console.log(`      👤 [${index}] userId: ${citizen.userId}`);
            });

            const userFound = citizens.some(c => {
                const matches = c.userId === currentUser.uid;
                if (matches) {
                    console.log(`      ✓ USUÁRIO ENCONTRADO NO RELATÓRIO ${doc.id}!`);
                }
                return matches;
            });

            if (userFound) {
                hasActiveReport = true;
                foundInReportId = doc.id;
            }
        });

        if (hasActiveReport) {
            console.log(`⚠️ Cidadão já possui um relato ativo (${foundInReportId})`);
            alert('❌ Você já tem um relato ativo! Aguarde até que seja finalizado por um operador antes de enviar outro.');
            return;
        } else {
            console.log('✅ Cidadão NÃO possui relatórios ativos');
        }
    } catch (error) {
        console.error('❌ ERRO ao verificar relatos ativos:', error);
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
    }

    if (!currentUserLocation) {
        getUserLocationForReport();
    } else {
        const modal = document.getElementById('report-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    const form = document.getElementById('report-form');
    
    if (modal) {
        modal.classList.add('hidden');
    }
    
    if (form) {
        form.reset();
    }
}

async function getUserLocationForReport() {
    console.log('📍 ═════════════════════════════════════════════');
    console.log('📍 OBTENDO LOCALIZAÇÃO PARA RELATO');
    console.log('📍 ═════════════════════════════════════════════');

    if (!navigator.geolocation) {
        alert('Geolocalização não disponível.');
        return;
    }

    // Verificar se o cidadão já tem um relato ativo
    try {
        console.log('🔍 Buscando relatórios ativos (segunda verificação)...');
        const activeReports = await db.collection('reports')
            .where('status', 'in', ['aberto', 'confirmado', 'atendimento'])
            .get();

        console.log(`📊 ${activeReports.size} relatórios ativos encontrados`);

        // Verificar se o usuário atual está em algum dos relatórios ativos
        let hasActiveReport = false;
        let foundInReportId = null;

        activeReports.forEach(doc => {
            const report = doc.data();
            const citizens = report.citizens || [];
            console.log(`   📄 Verificando relatório ${doc.id}: ${citizens.length} cidadãos`);

            const userFound = citizens.some(c => {
                const matches = c.userId === currentUser.uid;
                if (matches) {
                    console.log(`      ✓ USUÁRIO ENCONTRADO NO RELATÓRIO ${doc.id}!`);
                }
                return matches;
            });

            if (userFound) {
                hasActiveReport = true;
                foundInReportId = doc.id;
            }
        });

        if (hasActiveReport) {
            console.log(`⚠️ Cidadão já possui um relato ativo (${foundInReportId})`);
            alert('❌ Você já tem um relato ativo! Aguarde até que seja finalizado por um operador antes de enviar outro.');
            return;
        } else {
            console.log('✅ Cidadão NÃO possui relatórios ativos');
        }
    } catch (error) {
        console.error('❌ ERRO ao verificar relatos ativos:', error);
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
    }

    console.log('📍 Obtendo localização para relato...');

    const locationText = document.getElementById('location-text');
    if (locationText) {
        locationText.textContent = 'Obtendo localização...';
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentUserLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            console.log('✅ Localização atualizada:', currentUserLocation);

            if (locationText) {
                locationText.textContent = 'Usando sua localização atual';
            }

            const modal = document.getElementById('report-modal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        },
        (error) => {
            console.error('❌ Erro ao obter localização:', error);
            alert('Não foi possível obter sua localização. Verifique as permissões.');

            if (locationText) {
                locationText.textContent = 'Localização não disponível';
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function submitReport(type, description) {
    console.log('═══ INICIANDO submitReport ═══');
    console.log('Tipo:', type);
    console.log('Descrição:', description);
    console.log('Localização do usuário:', currentUserLocation);

    if (!currentUserLocation) {
        console.error('❌ Localização não disponível');
        alert('Localização não disponível. Tente novamente.');
        return;
    }

    if (!currentUser) {
        console.error('❌ Usuário não logado');
        alert('Você precisa estar logado para enviar um relato.');
        return;
    }

    try {
        // ========== VERIFICAÇÃO CRÍTICA: RELATÓRIOS ATIVOS ==========
        console.log('🚨 PASSO 0: VERIFICAÇÃO CRÍTICA - Buscando relatórios ativos do usuário...');
        const userActiveReports = await db.collection('reports')
            .where('status', 'in', ['aberto', 'confirmado', 'atendimento'])
            .get();

        let userAlreadyHasReport = false;
        let existingReportId = null;

        userActiveReports.forEach(doc => {
            const report = doc.data();
            const citizens = report.citizens || [];
            const userInReport = citizens.some(c => c.userId === currentUser.uid);

            if (userInReport) {
                console.log('🚨 ENCONTRADO: Usuário já está em relatório:', doc.id);
                userAlreadyHasReport = true;
                existingReportId = doc.id;
            }
        });

        if (userAlreadyHasReport) {
            console.error(`❌ OPERAÇÃO BLOQUEADA: Usuário já tem relatório ativo (${existingReportId})`);
            alert('❌ VOCÊ JÁ TEM UM RELATÓRIO ATIVO! Aguarde a finalização antes de enviar outro.');
            closeReportModal();
            return;
        }

        console.log('✅ PASSO 0: Usuário não tem relatórios ativos. Prosseguindo...');
        // ============================================================

        console.log('📤 PASSO 1: Verificando se há relatos próximos...');

        // Buscar reports próximos (em 100m)
        const nearbyReports = await findNearbyActiveReports(
            currentUserLocation.lat,
            currentUserLocation.lng
        );

        console.log('📍 PASSO 2: Relatos próximos encontrados:', nearbyReports.length);

        if (nearbyReports.length > 0) {
            console.log('🔄 PASSO 3A: HÁ REPORTS PRÓXIMOS - UNINDO');

            // Há um report próximo - ADICIONAR este novo relato a ele
            const existingReport = nearbyReports[0];
            console.log('🔗 Report existente:', existingReport.id);
            console.log('📋 Citizens atuais:', existingReport.citizens);

            // Se o report existente não tem array de cidadãos, criar
            const citizens = existingReport.citizens || [];
            console.log('👥 Número de cidadãos antes:', citizens.length);

            // Adicionar novo cidadão ao array
            citizens.push({
                userId: currentUser.uid,
                userName: currentUser.displayName || 'Cidadão',
                type: type,
                description: description,
                createdAt: new Date().toLocaleString('pt-BR')
            });

            console.log('👥 Número de cidadãos depois:', citizens.length);

            // Se não tem tipos, criar array e adicionar
            const types = existingReport.types || [];
            if (!types.includes(type)) {
                types.push(type);
            }

            console.log('📝 Atualizando report:', existingReport.id);
            console.log('📦 Dados a enviar:', { citizens, types });

            // Atualizar o report existente com as novas informações
            await db.collection('reports').doc(existingReport.id).update({
                citizens: citizens,
                types: types,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Report atualizado com sucesso!');
            alert(`✅ Seu relato foi adicionado ao agrupamento de incidentes! (Total: ${citizens.length})`);

        } else {
            console.log('🔄 PASSO 3B: SEM REPORTS PRÓXIMOS - CRIANDO NOVO');

            const reportData = {
                type: type,
                types: [type],  // Array de tipos
                location: {
                    lat: currentUserLocation.lat,
                    lng: currentUserLocation.lng
                },
                status: 'aberto',
                citizens: [
                    {
                        userId: currentUser.uid,
                        userName: currentUser.displayName || 'Cidadão',
                        type: type,
                        description: description,
                        createdAt: new Date().toLocaleString('pt-BR')
                    }
                ],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            console.log('📦 Dados do novo report:', reportData);
            const newReportRef = await db.collection('reports').add(reportData);
            console.log('✅ Novo report criado com ID:', newReportRef.id);
            alert('Relato enviado com sucesso! ✅');
        }

        closeReportModal();
        console.log('═══ submitReport FINALIZADO COM SUCESSO ═══\n');

    } catch (error) {
        console.error('═══ ERRO EM submitReport ═══');
        console.error('❌ Erro:', error);
        console.error('Código:', error.code);
        console.error('Mensagem:', error.message);
        console.error('═══════════════════════════\n');
        alert('Erro ao enviar relato. Tente novamente.');
    }
}