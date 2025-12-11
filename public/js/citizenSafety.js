// ===== SISTEMA DE SEGURANÇA DO CIDADÃO EM ZONAS DE RISCO =====

let citizenSafetyListener = null;
let citizenRiskZonesListener = null; // Renomeado para evitar conflito com riskZones.js
let currentZoneCheck = null;
const checkedZones = new Set(); // Zonas que já foram verificadas nesta sessão
let activeRiskZones = []; // Cache das zonas de risco ativas
let lastKnownLocation = null; // Última localização conhecida

// ===== INICIALIZAR LISTENER DE ZONAS DE RISCO PARA CIDADÃO =====
function initCitizenRiskZoneListener() {
    if (!currentUser || currentUserRole !== 'cidadao') {
        return;
    }

    console.log('🔥 Iniciando listener de zonas de risco para cidadão...');

    // Escutar mudanças nas zonas de risco em tempo real
    citizenRiskZonesListener = db.collection('alerts')
        .where('active', '==', true)
        .onSnapshot((snapshot) => {
            console.log(`📊 Zonas de risco atualizadas: ${snapshot.size}`);

            // Atualizar cache de zonas
            activeRiskZones = [];
            snapshot.forEach((doc) => {
                activeRiskZones.push({
                    id: doc.id,
                    data: doc.data()
                });
            });

            // Verificar se cidadão está em alguma zona agora
            if (lastKnownLocation) {
                checkCitizenInRiskZone(lastKnownLocation);
            }
        }, (error) => {
            console.error('❌ Erro ao escutar zonas de risco:', error);
        });
}

// ===== VERIFICAR SE CIDADÃO ESTÁ EM ZONA DE RISCO =====
async function checkCitizenInRiskZone(location) {
    if (!currentUser || !location) {
        return;
    }

    // Salvar última localização conhecida
    lastKnownLocation = location;

    console.log('🔍 Verificando se cidadão está em zona de risco...');

    try {
        const point = turf.point([location.lng, location.lat]);

        for (const zone of activeRiskZones) {
            const zoneData = zone.data;
            const zoneId = zone.id;

            let geometry = zoneData.geometry;
            if (typeof geometry === 'string') {
                geometry = JSON.parse(geometry);
            }

            // Verificar se o ponto está dentro da zona
            const polygon = turf.polygon(geometry.coordinates);
            const isInside = turf.booleanPointInPolygon(point, polygon);

            if (isInside) {
                console.log(`⚠️ Cidadão detectado na zona de risco: ${zoneId}`);

                // Verificar se já existe um status para este usuário nesta zona
                const existingStatus = await db.collection('citizenSafety')
                    .where('userId', '==', currentUser.uid)
                    .where('zoneId', '==', zoneId)
                    .limit(1)
                    .get();

                if (existingStatus.empty) {
                    // Criar novo registro pendente
                    await createCitizenSafetyStatus(zoneId, location);
                    // Mostrar pergunta ao cidadão
                    showSafetyQuestion(zoneId, zoneData.description);
                } else {
                    // Já existe um status para esta zona
                    const statusDoc = existingStatus.docs[0];
                    const statusData = statusDoc.data();

                    if (statusData.status === 'pending') {
                        // Ainda pendente, mostrar pergunta novamente se não está em checkedZones
                        if (!checkedZones.has(zoneId)) {
                            showSafetyQuestion(zoneId, zoneData.description);
                            checkedZones.add(zoneId);
                        }
                    } else if (statusData.status === 'safe') {
                        // Já respondeu que está seguro, não perguntar novamente
                        console.log(`✅ Cidadão já respondeu 'seguro' para zona ${zoneId}`);
                    } else if (statusData.status === 'unsafe') {
                        // Já respondeu que precisa de ajuda
                        console.log(`⚠️ Cidadão já respondeu 'precisa de ajuda' para zona ${zoneId}`);
                    }

                    // Atualizar localização sempre que estiver na zona
                    await db.collection('citizenSafety').doc(statusDoc.id).update({
                        location: {
                            lat: location.lat,
                            lng: location.lng
                        },
                        lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                return; // Apenas verificar uma zona por vez
            }
        }

        // Se não está em nenhuma zona, verificar se há status antigos para limpar
        const oldStatuses = await db.collection('citizenSafety')
            .where('userId', '==', currentUser.uid)
            .get();

        for (const statusDoc of oldStatuses.docs) {
            const statusData = statusDoc.data();
            const zoneId = statusData.zoneId;

            // Verificar se esta zona ainda existe no cache de zonas ativas
            const zoneStillExists = activeRiskZones.find(z => z.id === zoneId);

            if (!zoneStillExists) {
                // Zona foi deletada, remover status
                await db.collection('citizenSafety').doc(statusDoc.id).delete();
                console.log(`✅ Zona ${zoneId} foi deletada, status removido`);
                continue;
            }

            // Verificar se ainda está dentro desta zona
            const zoneData = zoneStillExists.data;
            let geometry = zoneData.geometry;
            if (typeof geometry === 'string') {
                geometry = JSON.parse(geometry);
            }

            const polygon = turf.polygon(geometry.coordinates);
            const isStillInside = turf.booleanPointInPolygon(point, polygon);

            if (!isStillInside) {
                // Saiu da zona, remover status
                await db.collection('citizenSafety').doc(statusDoc.id).delete();
                console.log(`✅ Cidadão saiu da zona ${zoneId}, status removido`);
            }
        }

    } catch (error) {
        console.error('❌ Erro ao verificar zona de risco:', error);
    }
}

// ===== CRIAR STATUS DE SEGURANÇA =====
async function createCitizenSafetyStatus(zoneId, location) {
    try {
        const statusData = {
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Cidadão',
            zoneId: zoneId,
            status: 'pending', // pending, safe, unsafe
            location: {
                lat: location.lat,
                lng: location.lng
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('citizenSafety').add(statusData);
        console.log('✅ Status de segurança criado');
    } catch (error) {
        console.error('❌ Erro ao criar status de segurança:', error);
    }
}

// ===== MOSTRAR PERGUNTA DE SEGURANÇA =====
function showSafetyQuestion(zoneId, zoneDescription) {
    // Verificar se já existe um modal aberto
    if (document.getElementById('safety-question-modal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'safety-question-modal';
    modal.className = 'safety-modal';
    modal.innerHTML = `
        <div class="safety-modal-overlay"></div>
        <div class="safety-modal-content">
            <div class="safety-modal-header">
                <span class="safety-icon">⚠️</span>
                <h2>Você está em uma Zona de Risco</h2>
            </div>
            <div class="safety-modal-body">
                <p class="safety-zone-description">${zoneDescription || 'Área de Risco - Alerta Oficial'}</p>
                <p class="safety-question">Você está seguro?</p>
            </div>
            <div class="safety-modal-actions">
                <button class="safety-btn safety-btn-yes" data-zone="${zoneId}">
                    ✅ Sim, estou seguro
                </button>
                <button class="safety-btn safety-btn-no" data-zone="${zoneId}">
                    🆘 Não, preciso de ajuda
                </button>
            </div>
            <p class="safety-note">Sua resposta será enviada às autoridades</p>
        </div>
    `;

    document.body.appendChild(modal);

    // Event listeners
    const btnYes = modal.querySelector('.safety-btn-yes');
    const btnNo = modal.querySelector('.safety-btn-no');

    btnYes.addEventListener('click', () => handleSafetyResponse(zoneId, 'safe'));
    btnNo.addEventListener('click', () => handleSafetyResponse(zoneId, 'unsafe'));

    // Animar entrada
    setTimeout(() => modal.classList.add('active'), 10);
}

// ===== LIDAR COM RESPOSTA DE SEGURANÇA =====
async function handleSafetyResponse(zoneId, status) {
    console.log(`📝 Resposta de segurança: ${status} para zona ${zoneId}`);

    try {
        // Buscar status existente
        const existingStatus = await db.collection('citizenSafety')
            .where('userId', '==', currentUser.uid)
            .where('zoneId', '==', zoneId)
            .limit(1)
            .get();

        if (!existingStatus.empty) {
            const statusDoc = existingStatus.docs[0];

            // Atualizar o status (seja 'safe' ou 'unsafe')
            await db.collection('citizenSafety').doc(statusDoc.id).update({
                status: status,
                respondedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            if (status === 'safe') {
                console.log('✅ Status "seguro" registrado - não será perguntado novamente nesta zona');
            } else {
                console.log('⚠️ Status "não seguro" registrado - marcador vermelho criado');
            }
        }

        // Fechar modal
        closeSafetyModal();

        // Mostrar feedback
        const message = status === 'safe'
            ? 'Obrigado! Tenha cuidado. Não perguntaremos novamente nesta área.'
            : 'Ajuda foi solicitada. Aguarde assistência.';

        showSafetyFeedback(message, status === 'safe' ? 'success' : 'warning');

    } catch (error) {
        console.error('❌ Erro ao salvar resposta:', error);
        alert('Erro ao registrar resposta. Tente novamente.');
    }
}

// ===== FECHAR MODAL =====
function closeSafetyModal() {
    const modal = document.getElementById('safety-question-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// ===== MOSTRAR FEEDBACK =====
function showSafetyFeedback(message, type) {
    const feedback = document.createElement('div');
    feedback.className = `safety-feedback safety-feedback-${type}`;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => feedback.classList.add('active'), 10);
    setTimeout(() => {
        feedback.classList.remove('active');
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

// ===== CARREGAR MARCADORES DE CIDADÃOS (APENAS OPERADOR) =====
function loadCitizenSafetyMarkers(operatorMap) {
    if (!operatorMap) {
        console.error('❌ Mapa do operador não fornecido');
        return;
    }

    console.log('👥 Carregando marcadores de cidadãos...');

    const citizenMarkers = {};

    citizenSafetyListener = db.collection('citizenSafety')
        .onSnapshot((snapshot) => {
            console.log(`📊 Status de cidadãos: ${snapshot.size}`);

            snapshot.docChanges().forEach((change) => {
                const statusData = change.doc.data();
                const statusId = change.doc.id;

                if (change.type === 'added' || change.type === 'modified') {
                    // Remover marcador antigo se existir
                    if (citizenMarkers[statusId]) {
                        operatorMap.removeLayer(citizenMarkers[statusId]);
                        delete citizenMarkers[statusId];
                    }

                    // Só mostrar marcador se status for 'pending' ou 'unsafe'
                    // Se for 'safe', não mostrar (cidadão está seguro)
                    if (statusData.status === 'safe') {
                        console.log(`✅ Status 'safe' - não exibir marcador para ${statusData.userName}`);
                        return;
                    }

                    // Criar novo marcador
                    const color = statusData.status === 'unsafe' ? '#D32F2F' : '#FBC02D';
                    const icon = statusData.status === 'unsafe' ? '🆘' : '⚠️';

                    const marker = L.circleMarker(
                        [statusData.location.lat, statusData.location.lng],
                        {
                            radius: 8,
                            fillColor: color,
                            color: '#fff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8,
                            pane: 'markersPane'
                        }
                    );

                    const statusLabel = {
                        'pending': 'Sem resposta',
                        'unsafe': 'Precisa de ajuda'
                    };

                    marker.bindPopup(`
                        <div style="min-width: 200px;">
                            <h3 style="margin: 0 0 8px 0; color: ${color}; display: flex; align-items: center; gap: 8px;">
                                <span>${icon}</span>
                                <span>CIDADÃO EM ZONA DE RISCO</span>
                            </h3>
                            <p style="margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 600;">
                                👤 ${statusData.userName}
                            </p>
                            <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: ${color};">
                                Status: ${statusLabel[statusData.status]}
                            </p>
                            <p style="margin: 0; font-size: 0.75rem; color: #94a3b8;">
                                📅 ${statusData.createdAt ? new Date(statusData.createdAt.toDate()).toLocaleString('pt-BR') : 'Agora'}
                            </p>
                        </div>
                    `);

                    marker.addTo(operatorMap);
                    citizenMarkers[statusId] = marker;

                } else if (change.type === 'removed') {
                    // Remover marcador
                    if (citizenMarkers[statusId]) {
                        operatorMap.removeLayer(citizenMarkers[statusId]);
                        delete citizenMarkers[statusId];
                    }
                }
            });
        }, (error) => {
            console.error('❌ Erro ao carregar marcadores de cidadãos:', error);
        });
}
