// ===== FUNÇÕES DE VALIDAÇÃO DE CPF =====

/**
 * Remove caracteres especiais do CPF (deixa só números)
 */
function cleanCPF(cpf) {
    return cpf.replace(/\D/g, '');
}

/**
 * Valida se um CPF é válido usando o algoritmo oficial da Receita Federal
 */
function isValidCPF(cpf) {
    cpf = cleanCPF(cpf);

    // Verifica se tem 11 dígitos
    if (cpf.length !== 11) {
        return false;
    }

    // Verifica se todos os dígitos são iguais (CPFs inválidos como 111.111.111-11)
    if (/^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    // Calcula o primeiro dígito verificador
    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }

    if (remainder !== parseInt(cpf.substring(9, 10))) {
        return false;
    }

    // Calcula o segundo dígito verificador
    sum = 0;

    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;

    if (remainder === 10 || remainder === 11) {
        remainder = 0;
    }

    if (remainder !== parseInt(cpf.substring(10, 11))) {
        return false;
    }

    return true;
}

/**
 * Formata o CPF para o padrão 000.000.000-00
 */
function formatCPF(cpf) {
    cpf = cleanCPF(cpf);

    if (cpf.length <= 3) {
        return cpf;
    } else if (cpf.length <= 6) {
        return cpf.slice(0, 3) + '.' + cpf.slice(3);
    } else if (cpf.length <= 9) {
        return cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6);
    } else {
        return cpf.slice(0, 3) + '.' + cpf.slice(3, 6) + '.' + cpf.slice(6, 9) + '-' + cpf.slice(9, 11);
    }
}

// ===== FUNÇÕES DE AUTENTICAÇÃO =====

async function registerUser(email, password, name, role, cpf) {
    try {
        // Validar CPF
        if (!cpf || !isValidCPF(cpf)) {
            console.log('❌ CPF inválido:', cpf);
            return { success: false, error: 'CPF inválido. Verifique e tente novamente.' };
        }

        // Limpar CPF para armazenar apenas números
        const cleanedCPF = cleanCPF(cpf);

        console.log('📤 Criando usuário com email:', email);

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        console.log('✅ Usuário criado no Firebase Auth:', user.uid);

        await user.updateProfile({
            displayName: name
        });

        console.log('📝 Salvando dados do usuário no Firestore...');

        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            name: name,
            email: email,
            cpf: cleanedCPF,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Usuário registrado com sucesso:', user.uid);
        return { success: true, user: user, role: role };
    } catch (error) {
        console.error('❌ Erro no registro:', error);
        console.error('Código do erro:', error.code);
        console.error('Mensagem do erro:', error.message);

        // Se o erro for do Firestore, tenta extrair a mensagem melhor
        if (error.code && error.code.includes('permission')) {
            return { success: false, error: 'Erro de permissão ao salvar dados. Verifique as regras do Firestore.' };
        }

        return { success: false, error: getErrorMessage(error.code) };
    }
}

async function loginUser(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
            throw new Error('Dados do usuário não encontrados no banco de dados.');
        }

        const userData = userDoc.data();
        console.log('✅ Login bem-sucedido:', user.uid, '| Role:', userData.role);
        
        return { success: true, user: user, role: userData.role, userData: userData };
    } catch (error) {
        console.error('❌ Erro no login:', error);
        return { success: false, error: getErrorMessage(error.code) };
    }
}

async function logoutUser() {
    try {
        await auth.signOut();
        console.log('✅ Logout realizado');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
    }
}

async function getUserData(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('❌ Erro ao buscar dados do usuário:', error);
        return null;
    }
}

// ===== FUNÇÕES DE NAVEGAÇÃO =====

function redirectBasedOnRole(role) {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (role === 'operador') {
        if (currentPage !== 'operador.html') {
            window.location.href = 'operador.html';
        }
    } else if (role === 'cidadao') {
        if (currentPage !== 'index.html' && currentPage !== '') {
            window.location.href = 'index.html';
        }
    }
}

async function checkPagePermission() {
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'operador.html') {
        const user = auth.currentUser;
        
        if (!user) {
            showAccessDenied();
            return false;
        }
        
        const userData = await getUserData(user.uid);
        
        if (!userData || userData.role !== 'operador') {
            showAccessDenied();
            return false;
        }
        
        return true;
    }
    
    return true;
}

function showAccessDenied() {
    const loadingScreen = document.getElementById('loading-screen');
    const operatorPanel = document.getElementById('operator-panel');
    const accessDenied = document.getElementById('access-denied');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (operatorPanel) operatorPanel.classList.add('hidden');
    if (accessDenied) accessDenied.classList.remove('hidden');
}

// ===== OBSERVER DE AUTENTICAÇÃO =====

auth.onAuthStateChanged(async (user) => {
    console.log('🔄 Estado de autenticação alterado');
    
    if (user) {
        console.log('👤 Usuário logado:', user.email);
        currentUser = user;
        
        const userData = await getUserData(user.uid);
        
        if (userData) {
            currentUserRole = userData.role;
            console.log('🎭 Role do usuário:', currentUserRole);
            
            const currentPage = window.location.pathname.split('/').pop();
            
            if (currentPage === 'operador.html') {
                const hasPermission = await checkPagePermission();
                if (hasPermission) {
                    setupOperatorPage(user, userData);
                }
            } else if (currentPage === 'index.html' || currentPage === '') {
                setupIndexPage(user, userData);
            }
        }
    } else {
        console.log('👤 Nenhum usuário logado');
        currentUser = null;
        currentUserRole = null;
        
        const currentPage = window.location.pathname.split('/').pop();
        
        if (currentPage === 'operador.html') {
            window.location.href = 'index.html';
        }
    }
});

// ===== CONFIGURAÇÃO DAS PÁGINAS =====

function setupIndexPage(user, userData) {
    const authArea = document.getElementById('auth-area');
    const citizenArea = document.getElementById('citizen-area');
    
    if (userData.role === 'cidadao') {
        if (authArea) authArea.classList.add('hidden');
        if (citizenArea) citizenArea.classList.remove('hidden');
        
        const userNameDisplay = document.getElementById('user-name-display');
        
        if (userNameDisplay) userNameDisplay.textContent = userData.name;
        
        initCitizenMap();
        
    } else if (userData.role === 'operador') {
        redirectBasedOnRole('operador');
    }
}

function setupOperatorPage(user, userData) {
    const loadingScreen = document.getElementById('loading-screen');
    const operatorPanel = document.getElementById('operator-panel');
    const operatorName = document.getElementById('operator-name');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (operatorPanel) operatorPanel.classList.remove('hidden');
    if (operatorName) operatorName.textContent = userData.name;
    
    initOperatorMap();
}