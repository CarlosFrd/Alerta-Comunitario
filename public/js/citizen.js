// ===== VARIÁVEIS DO MAPA (CIDADÃO) =====
let map = null;
let userMarker = null;
let currentUserLocation = null;
let reportsListener = null;
const reportMarkers = {};

// ===== FUNÇÕES DO MAPA (CIDADÃO) =====

function initCitizenMap() {
    console.log('🗺️ Inicializando mapa do cidadão...');

    map = L.map('map').setView([-8.0476, -34.8770], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Criar pane customizado para markers ficarem acima de tudo
    map.createPane('markersPane');
    map.getPane('markersPane').style.zIndex = 650;

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

            userMarker = L.marker([lat, lng], {
                icon: blueIcon,
                pane: 'markersPane' // Usar pane customizado
            })
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

    const marker = L.marker([lat, lng], {
        icon: markerIcon,
        pane: 'markersPane' // Usar pane customizado com z-index alto
    }).addTo(map);

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

    const popupContent = `
        <div style="min-width: 250px;">
            <h3 style="margin: 0 0 8px 0; color: #1e293b;">${typeIcon} ${typeName}</h3>
            <div style="margin: 0 0 8px 0;">
                <span style="background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${statusLabel}</span>
            </div>
            <p style="margin: 0 0 4px 0; color: #64748b; font-size: 0.85rem;">${reportData.description}</p>
            <p style="margin: 0; color: #94a3b8; font-size: 0.75rem;">👤 ${reportData.userName || 'Cidadão'}</p>
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
    console.log('📝 Abrindo modal de relato');

    if (!currentUser) {
        console.error('❌ Usuário não logado!');
        alert('Você precisa estar logado para abrir um relato.');
        return;
    }

    // Verificar se o usuário já tem um relato ativo
    try {
        const activeReports = await db.collection('reports')
            .where('userId', '==', currentUser.uid)
            .where('status', 'in', ['aberto', 'confirmado', 'atendimento'])
            .get();

        if (!activeReports.empty) {
            console.log('⚠️ Usuário já possui um relato ativo');
            alert('❌ Você já tem um relato ativo! Aguarde até que seja finalizado por um operador antes de enviar outro.');
            return;
        }
    } catch (error) {
        console.error('❌ Erro ao verificar relatos ativos:', error);
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
    if (!navigator.geolocation) {
        alert('Geolocalização não disponível.');
        return;
    }

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

            console.log('✅ Localização obtida:', currentUserLocation);

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
        // Verificar se usuário já tem um relato ativo
        console.log('🔍 Verificando relatórios ativos do usuário...');
        const userActiveReports = await db.collection('reports')
            .where('userId', '==', currentUser.uid)
            .where('status', 'in', ['aberto', 'confirmado', 'atendimento'])
            .get();

        if (!userActiveReports.empty) {
            console.log('⚠️ Usuário já tem um relato ativo');
            alert('❌ Você já tem um relato ativo! Aguarde até que seja finalizado por um operador antes de enviar outro.');
            closeReportModal();
            return;
        }

        console.log('✅ Usuário não tem relatórios ativos. Criando novo report...');

        // Criar novo report individual
        const reportData = {
            type: type,
            description: description,
            location: {
                lat: currentUserLocation.lat,
                lng: currentUserLocation.lng
            },
            status: 'aberto',
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Cidadão',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('📦 Dados do novo report:', reportData);
        const newReportRef = await db.collection('reports').add(reportData);
        console.log('✅ Novo report criado com ID:', newReportRef.id);
        alert('Relato enviado com sucesso! ✅');

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