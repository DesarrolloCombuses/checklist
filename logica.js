// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyACOeoU8xXUuzCYrPxONmeBgImfQd63UOA",
    authDomain: "basedatoscheck.firebaseapp.com",
    projectId: "basedatoscheck",
    storageBucket: "basedatoscheck.appspot.com",
    messagingSenderId: "580954254341",
    appId: "1:580954254341:web:684651c6c8f55449d8006c"
};

// Inicializar Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Variables globales
let vehiculosData = [];
let currentVerificacionId = null;
let qrScanner = null;

// Objeto de errores de Firebase
const firebaseErrors = {
    // Autenticación
    'auth/invalid-email': 'Correo electrónico inválido',
    'auth/user-disabled': 'Cuenta deshabilitada',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'El correo ya está registrado',
    'auth/operation-not-allowed': 'Operación no permitida',
    'auth/weak-password': 'Contraseña demasiado débil',
    'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
    // Firestore
    'permission-denied': 'No tienes permisos para esta operación',
    // Genérico
    'default': 'Ocurrió un error inesperado'
};

// Referencias a elementos del DOM
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const resetPasswordLink = document.getElementById('resetPasswordLink');
const logoutBtn = document.getElementById('logoutBtn');
const protectedContent = document.getElementById('protectedContent');
const userEmailSpan = document.getElementById('userEmail');
const alertContainer = document.getElementById('alertContainer');
const vehicleForm = document.getElementById('vehicleForm');
const estadoDisplay = document.getElementById('estadoDisplay');

// ================= FUNCIONES AUXILIARES =================

function showAlert(message, type = 'danger') {
    alertContainer.innerHTML = '';
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    alertContainer.appendChild(alertDiv);
    
    if (type !== 'success') {
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 5000);
    }
}

function getFirebaseError(error) {
    return firebaseErrors[error.code] || error.message || firebaseErrors['default'];
}

function showLoading(show = true) {
    const submitBtn = vehicleForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = show;
        submitBtn.innerHTML = show ? 
            '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...' : 
            '<i class="fas fa-save me-2"></i>Guardar Verificación';
    }
}

// ================= MANEJO DE VEHÍCULOS =================

async function cargarVehiculos() {
    try {
        const response = await fetch('vehiculos.json');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        vehiculosData = await response.json();
        if (!Array.isArray(vehiculosData)) throw new Error('Formato de datos inválido');
        
        vehiculosData.sort((a, b) => a.Placa.localeCompare(b.Placa));
        
        const selectPlaca = document.getElementById('placa');
        selectPlaca.innerHTML = '<option value="" selected disabled>Seleccione una placa</option>';
        
        vehiculosData.forEach(vehiculo => {
            const option = new Option(vehiculo.Placa, vehiculo.Placa);
            selectPlaca.add(option);
        });
        
        selectPlaca.addEventListener('change', (e) => {
            const vehiculo = vehiculosData.find(v => v.Placa === e.target.value);
            if (!vehiculo) return;
            
            document.getElementById('tipo').value = vehiculo.Tipo || '';
            document.getElementById('modelo').value = vehiculo.Modelo || '';
            document.getElementById('capacidad').value = vehiculo.Capacidad || '';
            document.getElementById('propietario').value = (vehiculo.Propietario || '').trim();
        });
        
    } catch (error) {
        console.error("Error cargando vehículos:", error);
        showAlert(`Error al cargar vehículos: ${error.message}`, 'danger');
    }
}

// ================= MANEJO DE CONDUCTORES =================

async function cargarConductores() {
    try {
        const conductoresSnapshot = await db.collection("personal").get();
        const conductorInput = document.getElementById('conductor');
        
        // Guardar nombres para validación QR
        window.conductoresRegistrados = [];
        
        conductoresSnapshot.forEach(doc => {
            const conductorData = doc.data();
            if (conductorData.nombre) {
                window.conductoresRegistrados.push(conductorData.nombre);
            }
        });
        
    } catch (error) {
        console.error("Error cargando conductores:", error);
        showAlert(`Error al cargar lista de conductores: ${error.message}`, 'danger');
    }
}

// ================= LECTOR QR PARA CONDUCTOR =================

function initQRScanner() {
    const scanBtn = document.getElementById('scanQRBtn');
    const cancelBtn = document.getElementById('cancelScanBtn');
    const qrScannerDiv = document.getElementById('qrScanner');
    const qrVideo = document.getElementById('qrVideo');
    const conductorInput = document.getElementById('conductor');

    scanBtn?.addEventListener('click', () => {
        qrScannerDiv.style.display = 'block';
        conductorInput.blur();
        
        if (!qrScanner) {
            qrScanner = new Instascan.Scanner({ video: qrVideo });
            
            qrScanner.addListener('scan', function(content) {
                if (window.conductoresRegistrados.includes(content)) {
                    conductorInput.value = content;
                    showAlert('Conductor identificado: ' + content, 'success');
                } else {
                    showAlert('Código QR no válido o conductor no registrado', 'warning');
                }
                stopQRScanner();
            });
            
            Instascan.Camera.getCameras().then(function(cameras) {
                if (cameras.length > 0) {
                    qrScanner.start(cameras[0]);
                } else {
                    showAlert('No se encontraron cámaras disponibles', 'danger');
                    qrScannerDiv.style.display = 'none';
                }
            }).catch(function(e) {
                console.error(e);
                showAlert('Error al acceder a la cámara: ' + e.message, 'danger');
                qrScannerDiv.style.display = 'none';
            });
        }
    });
    
    cancelBtn?.addEventListener('click', stopQRScanner);
}

function stopQRScanner() {
    const qrScannerDiv = document.getElementById('qrScanner');
    qrScannerDiv.style.display = 'none';
    
    if (qrScanner) {
        qrScanner.stop();
    }
}

// ================= VALIDACIÓN DE FORMULARIO =================

function validarCheckboxes() {
    let valido = true;
    
    document.querySelectorAll('.cumple').forEach(checkbox => {
        const row = checkbox.closest('tr');
        const observaciones = row.querySelector('.observaciones').value;
        
        if (!checkbox.checked && observaciones.trim() === '') {
            row.classList.add('table-danger');
            valido = false;
        } else {
            row.classList.remove('table-danger');
        }
    });
    
    return valido;
}

function validarFormularioVehiculo() {
    const conductor = document.getElementById('conductor').value.trim();
    const kilometraje = document.getElementById('kilometraje').value.trim();
    
    // Validar conductor (no vacío)
    if (!conductor) {
        showAlert('Debe ingresar el nombre del conductor');
        return false;
    }
    
    // Validar kilometraje (número positivo)
    if (!/^\d+$/.test(kilometraje)) {
        showAlert('El kilometraje debe ser un número positivo');
        return false;
    }
    
    return true;
}

function configurarValidacionEnTiempoReal() {
    document.querySelectorAll('.cumple').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const row = this.closest('tr');
            const observaciones = row.querySelector('.observaciones');
            
            if (!this.checked && observaciones.value.trim() === '') {
                row.classList.add('table-danger');
            } else {
                row.classList.remove('table-danger');
            }
        });
    });

    document.querySelectorAll('.observaciones').forEach(input => {
        input.addEventListener('input', function() {
            const row = this.closest('tr');
            const checkbox = row.querySelector('.cumple');
            
            if (!checkbox.checked && this.value.trim() !== '') {
                row.classList.remove('table-danger');
            }
        });
    });
}

// ================= AUTENTICACIÓN =================

auth.onAuthStateChanged(user => {
    if (user) {
        document.querySelector('.auth-card').style.display = 'none';
        protectedContent.style.display = 'block';
        userEmailSpan.textContent = user.email;
        
        const now = new Date();
        document.getElementById('fechaReporte').value = now.toLocaleDateString();
        
        const nextDate = new Date();
        nextDate.setDate(now.getDate() + 30);
        document.getElementById('fechaProx').value = nextDate.toLocaleDateString();
        
        document.getElementById('evaluador').value = user.email;
        
        // Establecer estado inicial
        if (estadoDisplay) estadoDisplay.textContent = 'Pendiente para revisión';
        
        cargarVehiculos();
        cargarConductores();
        initQRScanner();
    } else {
        document.querySelector('.auth-card').style.display = 'block';
        protectedContent.style.display = 'none';
    }
});

loginForm?.addEventListener('submit', e => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => showAlert('Inicio de sesión exitoso', 'success'))
        .catch(error => showAlert(getFirebaseError(error)));
});

registerForm?.addEventListener('submit', e => {
    e.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showAlert('Las contraseñas no coinciden');
        return;
    }
    
    if (password.length < 6) {
        showAlert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            showAlert('Registro exitoso. Bienvenido!', 'success');
            new bootstrap.Tab(document.getElementById('login-tab')).show();
            registerForm.reset();
        })
        .catch(error => showAlert(getFirebaseError(error)));
});

resetPasswordLink?.addEventListener('click', e => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    
    if (!email) {
        showAlert('Ingresa tu correo electrónico');
        return;
    }
    
    auth.sendPasswordResetEmail(email)
        .then(() => showAlert('Correo de recuperación enviado', 'success'))
        .catch(error => showAlert(getFirebaseError(error)));
});

logoutBtn?.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            showAlert('Sesión cerrada correctamente', 'success');
            document.getElementById('loginForm').reset();
        })
        .catch(error => showAlert(getFirebaseError(error)));
});

// ================= GUARDADO EN FIRESTORE =================

vehicleForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
        showAlert('Debes iniciar sesión para guardar', 'danger');
        return;
    }
    
    if (!validarFormularioVehiculo()) {
        return;
    }
    
    const placa = document.getElementById('placa').value;
    const conductor = document.getElementById('conductor').value;
    const kilometraje = document.getElementById('kilometraje').value;
    
    if (!placa || !conductor || !kilometraje) {
        showAlert('Placa, conductor y kilometraje son obligatorios', 'danger');
        return;
    }
    
    if (!validarCheckboxes()) {
        showAlert('Debes ingresar observaciones para los ítems que no cumplen', 'danger');
        return;
    }

    showLoading(true);
    
    try {
        const verificacion = {
            placa: placa,
            tipo: document.getElementById('tipo').value,
            modelo: document.getElementById('modelo').value,
            capacidad: document.getElementById('capacidad').value,
            kilometraje: kilometraje,
            propietario: document.getElementById('propietario').value,
            conductor: conductor,
            fechaReporte: document.getElementById('fechaReporte').value,
            evaluador: document.getElementById('evaluador').value,
            fechaProx: document.getElementById('fechaProx').value,
            estado: "Pendiente para revisión",
            documentos: [],
            equipos: [],
            fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
            creadoPor: auth.currentUser.email,
            userId: auth.currentUser.uid
        };

        document.querySelectorAll('input[name="documentos"]').forEach(checkbox => {
            const row = checkbox.closest('tr');
            verificacion.documentos.push({
                item: row.cells[0].textContent,
                cumple: checkbox.checked,
                observaciones: row.querySelector('.observaciones').value
            });
        });

        document.querySelectorAll('input[name="equipos"]').forEach(checkbox => {
            const row = checkbox.closest('tr');
            verificacion.equipos.push({
                item: row.cells[0].textContent,
                cumple: checkbox.checked,
                observaciones: row.querySelector('.observaciones').value
            });
        });

        const docRef = await db.collection("verificaciones").add(verificacion);
        currentVerificacionId = docRef.id;
        
        showAlert('Verificación guardada correctamente con estado: Pendiente para revisión', 'success');
        vehicleForm.reset();
        document.getElementById('conductor').value = '';
        document.getElementById('kilometraje').value = '';
        
        const now = new Date();
        document.getElementById('fechaReporte').value = now.toLocaleDateString();
        const nextDate = new Date();
        nextDate.setDate(now.getDate() + 30);
        document.getElementById('fechaProx').value = nextDate.toLocaleDateString();

    } catch (error) {
        console.error("Error al guardar:", error);
        showAlert('Error al guardar: ' + error.message, 'danger');
    } finally {
        showLoading(false);
    }
});

// ================= INICIALIZACIÓN =================

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('placa')) {
        cargarVehiculos();
        configurarValidacionEnTiempoReal();
    }
    
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.classList.toggle('fa-eye-slash');
            icon.classList.toggle('fa-eye');
        });
    });
});