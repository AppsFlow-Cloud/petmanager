/**
 * app.js - Controlador Principal do Pet Manager
 * 
 * Responsabilidades:
 * - Orquestrar o estado global da aplicação em memória e persistir no IndexedDB.
 * - Gerenciar a navegação fluida entre telas (Dashboard, Animais, Ficha Detalhe, Alertas, Configurações).
 * - Controlar os eventos de envio de formulários (Animal, Vacinas, Vermífugos, Medicamentos, Cuidados, Adoção e Configurações).
 * - Realizar uploads de fotos locais (convertidas para DataURL base64 para persistência segura no IndexedDB).
 * - Aplicar filtros de pesquisa, espécie, situação, porte e urgência em tempo real.
 * - Executar backups (exportação e importação de JSON) e exclusão controlada com confirmação.
 */

import {
  getAllPets,
  getPetById,
  savePet,
  deletePet,
  clearAllPets,
  getSettings,
  saveSettings,
  exportDatabaseToJSON,
  importDatabaseFromJSON,
  generateUniqueId
} from './database.js';

import {
  renderDashboard,
  renderPetsList,
  renderPetDetail,
  renderAlertsView,
  extractHealthAlerts,
  openModal,
  closeModal,
  showConfirmModal
} from './ui.js';

/* ==========================================================================
   ESTADO GLOBAL DA APLICAÇÃO
   ========================================================================== */
let allPets = [];
let appSettings = { organizationName: 'Meu Abrigo / Controle Pet', alertDaysThreshold: 15 };
let currentActivePetId = null;
let currentActiveSection = 'section-dashboard';
let currentPetsViewMode = 'cards'; // 'cards' ou 'table'

// Filtros de Animais
const petFilters = {
  search: '',
  species: 'all',
  status: 'all',
  size: 'all',
  sex: 'all'
};

// Filtros de Alertas
const alertFilters = {
  type: 'all',
  urgency: 'all'
};

/* ==========================================================================
   INICIALIZAÇÃO DO APLICATIVO
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Carrega os dados reais persistidos no IndexedDB do dispositivo
    const [loadedPets, loadedSettings] = await Promise.all([
      getAllPets(),
      getSettings()
    ]);

    allPets = loadedPets;
    appSettings = loadedSettings;

    // Atualiza cabeçalho e configurações
    applySettingsToUI();

    // Inicializa listeners globais e navegação
    setupNavigation();
    setupFormListeners();
    setupFilterListeners();
    setupSettingsListeners();
    setupDelegatedCardListeners();

    // Renderiza a tela inicial (Dashboard)
    refreshAllViews();
  } catch (error) {
    console.error('Erro ao inicializar o Pet Manager:', error);
  }
});

/* ==========================================================================
   SINCRONIZAÇÃO E ATUALIZAÇÃO GERAL DE TELAS
   ========================================================================== */
function refreshAllViews() {
  const alerts = extractHealthAlerts(allPets, appSettings.alertDaysThreshold);

  // 1. Atualiza Dashboard
  renderDashboard(allPets, alerts);

  // 2. Atualiza Lista de Animais aplicando filtros
  applyAndRenderPetFilters();

  // 3. Atualiza Ficha de Detalhe se houver um animal aberto
  if (currentActivePetId) {
    const currentPet = allPets.find(p => p.id === currentActivePetId);
    if (currentPet) {
      renderPetDetail(currentPet);
    } else {
      // Se o animal aberto tiver sido excluído, volta para a lista
      navigateToSection('section-pets');
      currentActivePetId = null;
    }
  }

  // 4. Atualiza Central de Alertas
  applyAndRenderAlertFilters();
}

function applySettingsToUI() {
  const orgTitle = document.getElementById('header-org-name');
  if (orgTitle) orgTitle.textContent = appSettings.organizationName || 'Meu Abrigo / Controle Pet';

  const orgInput = document.getElementById('settings-org-input');
  if (orgInput) orgInput.value = appSettings.organizationName || '';

  const thresholdSelect = document.getElementById('settings-threshold-select');
  if (thresholdSelect) thresholdSelect.value = String(appSettings.alertDaysThreshold || 15);
}

/* ==========================================================================
   CONTROLE DE NAVEGAÇÃO ENTRE SEÇÕES
   ========================================================================== */
function navigateToSection(sectionId) {
  currentActiveSection = sectionId;

  // Esconde todas as seções e mostra a ativa
  document.querySelectorAll('.app-section').forEach(sec => {
    sec.classList.remove('active');
  });
  const targetSection = document.getElementById(sectionId);
  if (targetSection) targetSection.classList.add('active');

  // Atualiza navegação Desktop
  const navMap = {
    'section-dashboard': 'nav-btn-dashboard',
    'section-pets': 'nav-btn-pets',
    'section-pet-detail': 'nav-btn-pets',
    'section-alerts': 'nav-btn-alerts',
    'section-settings': 'nav-btn-settings'
  };
  document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
  const activeDesktopBtn = document.getElementById(navMap[sectionId]);
  if (activeDesktopBtn) activeDesktopBtn.classList.add('active');

  // Atualiza navegação Mobile
  const mobMap = {
    'section-dashboard': 'mob-btn-dashboard',
    'section-pets': 'mob-btn-pets',
    'section-pet-detail': 'mob-btn-pets',
    'section-alerts': 'mob-btn-alerts',
    'section-settings': 'mob-btn-settings'
  };
  document.querySelectorAll('.nav-mobile-btn').forEach(btn => btn.classList.remove('active'));
  const activeMobBtn = document.getElementById(mobMap[sectionId]);
  if (activeMobBtn) activeMobBtn.classList.add('active');

  // Rola suavemente para o topo
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupNavigation() {
  // Brand Logo clica e vai para Dashboard
  document.getElementById('btn-nav-brand')?.addEventListener('click', () => navigateToSection('section-dashboard'));

  // Botoes Nav Desktop
  document.getElementById('nav-btn-dashboard')?.addEventListener('click', () => navigateToSection('section-dashboard'));
  document.getElementById('nav-btn-pets')?.addEventListener('click', () => navigateToSection('section-pets'));
  document.getElementById('nav-btn-alerts')?.addEventListener('click', () => navigateToSection('section-alerts'));
  document.getElementById('nav-btn-settings')?.addEventListener('click', () => navigateToSection('section-settings'));

  // Botoes Nav Mobile
  document.getElementById('mob-btn-dashboard')?.addEventListener('click', () => navigateToSection('section-dashboard'));
  document.getElementById('mob-btn-pets')?.addEventListener('click', () => navigateToSection('section-pets'));
  document.getElementById('mob-btn-alerts')?.addEventListener('click', () => navigateToSection('section-alerts'));
  document.getElementById('mob-btn-settings')?.addEventListener('click', () => navigateToSection('section-settings'));

  // Atalhos do Dashboard
  document.getElementById('hero-btn-add-pet')?.addEventListener('click', () => openPetFormModal());
  document.getElementById('hero-btn-view-pets')?.addEventListener('click', () => navigateToSection('section-pets'));
  document.getElementById('btn-quick-new-pet')?.addEventListener('click', () => openPetFormModal());
  document.getElementById('kpi-card-total')?.addEventListener('click', () => navigateToSection('section-pets'));
  document.getElementById('kpi-card-vaccines')?.addEventListener('click', () => {
    alertFilters.type = 'Vacina';
    document.getElementById('filter-alert-type').value = 'Vacina';
    navigateToSection('section-alerts');
    applyAndRenderAlertFilters();
  });
  document.getElementById('kpi-card-dewormers')?.addEventListener('click', () => {
    alertFilters.type = 'Vermífugo';
    document.getElementById('filter-alert-type').value = 'Vermífugo';
    navigateToSection('section-alerts');
    applyAndRenderAlertFilters();
  });
  document.getElementById('kpi-card-medications')?.addEventListener('click', () => {
    alertFilters.type = 'Medicamento';
    document.getElementById('filter-alert-type').value = 'Medicamento';
    navigateToSection('section-alerts');
    applyAndRenderAlertFilters();
  });
  document.getElementById('kpi-card-adoptions')?.addEventListener('click', () => {
    petFilters.status = 'Adotado';
    document.getElementById('filter-status').value = 'Adotado';
    navigateToSection('section-pets');
    applyAndRenderPetFilters();
  });
  document.getElementById('btn-dash-view-all-alerts')?.addEventListener('click', () => navigateToSection('section-alerts'));
  document.getElementById('btn-dash-view-all-pets')?.addEventListener('click', () => navigateToSection('section-pets'));

  // Abertura de modal a partir de botões de adicionar
  document.getElementById('btn-open-add-pet-modal')?.addEventListener('click', () => openPetFormModal());
  document.getElementById('btn-back-to-pets')?.addEventListener('click', () => navigateToSection('section-pets'));

  // Alternância de Abas dentro da Ficha de Detalhes do Animal
  setupDetailTabs();
}

function setupDetailTabs() {
  const tabButtons = [
    { btnId: 'tab-btn-vaccines', contentId: 'tab-content-vaccines' },
    { btnId: 'tab-btn-dewormers', contentId: 'tab-content-dewormers' },
    { btnId: 'tab-btn-medications', contentId: 'tab-content-medications' },
    { btnId: 'tab-btn-care', contentId: 'tab-content-care' },
    { btnId: 'tab-btn-adoption', contentId: 'tab-content-adoption' }
  ];

  tabButtons.forEach(tab => {
    const btn = document.getElementById(tab.btnId);
    if (btn) {
      btn.addEventListener('click', () => {
        tabButtons.forEach(t => {
          document.getElementById(t.btnId)?.classList.remove('active');
          const content = document.getElementById(t.contentId);
          if (content) content.style.display = 'none';
        });
        btn.classList.add('active');
        const activeContent = document.getElementById(tab.contentId);
        if (activeContent) activeContent.style.display = 'block';
      });
    }
  });

  // Mostrar/ocultar campos do adotante conforme select de status
  const adoptStatusSelect = document.getElementById('adoption-status-select');
  const adopterFieldsGroup = document.getElementById('adopter-fields-group');
  adoptStatusSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (adopterFieldsGroup) {
      adopterFieldsGroup.style.display = (val === 'Em processo' || val === 'Adotado') ? 'block' : 'none';
    }
  });
}

/* ==========================================================================
   DELEGAÇÃO DE EVENTOS DE CLIQUES (CARDS, TABELAS E ALERTAS)
   ========================================================================== */
function setupDelegatedCardListeners() {
  // Cliques em itens dinâmicos do documento
  document.addEventListener('click', (e) => {
    // 1. Abrir perfil do animal por clique no card, imagem ou botão "Ver Ficha"
    const viewTrigger = e.target.closest('[data-pet-id]');
    if (viewTrigger && !e.target.closest('.icon-action-btn')) {
      const petId = viewTrigger.getAttribute('data-pet-id');
      if (petId) {
        openPetDetailPage(petId);
      }
      return;
    }

    // 2. Botão de Editar Animal
    const editPetBtn = e.target.closest('.edit-pet-btn');
    if (editPetBtn) {
      const petId = editPetBtn.getAttribute('data-pet-id');
      if (petId) openPetFormModal(petId);
      return;
    }

    // 3. Botão de Excluir Animal
    const deletePetBtn = e.target.closest('.delete-pet-btn');
    if (deletePetBtn) {
      const petId = deletePetBtn.getAttribute('data-pet-id');
      if (petId) confirmDeletePet(petId);
      return;
    }

    // 4. Ações no cabeçalho do detalhe
    if (e.target.closest('#btn-edit-current-pet')) {
      if (currentActivePetId) openPetFormModal(currentActivePetId);
      return;
    }
    if (e.target.closest('#btn-delete-current-pet')) {
      if (currentActivePetId) confirmDeletePet(currentActivePetId);
      return;
    }

    // 5. Botões de adicionar cuidados na ficha
    if (e.target.closest('#btn-add-vaccine')) {
      openVaccineModal();
      return;
    }
    if (e.target.closest('#btn-add-dewormer')) {
      openDewormerModal();
      return;
    }
    if (e.target.closest('#btn-add-medication')) {
      openMedicationModal();
      return;
    }
    if (e.target.closest('#btn-add-care')) {
      openCareModal();
      return;
    }

    // 6. Edição e Exclusão de Cuidados Vinculados
    const editVacBtn = e.target.closest('.edit-vaccine-btn');
    if (editVacBtn) {
      openVaccineModal(editVacBtn.getAttribute('data-vaccine-id'));
      return;
    }
    const delVacBtn = e.target.closest('.delete-vaccine-btn');
    if (delVacBtn) {
      confirmDeleteCareItem('vac', delVacBtn.getAttribute('data-vaccine-id'));
      return;
    }

    const editDewBtn = e.target.closest('.edit-dewormer-btn');
    if (editDewBtn) {
      openDewormerModal(editDewBtn.getAttribute('data-dewormer-id'));
      return;
    }
    const delDewBtn = e.target.closest('.delete-dewormer-btn');
    if (delDewBtn) {
      confirmDeleteCareItem('dew', delDewBtn.getAttribute('data-dewormer-id'));
      return;
    }

    const editMedBtn = e.target.closest('.edit-medication-btn');
    if (editMedBtn) {
      openMedicationModal(editMedBtn.getAttribute('data-medication-id'));
      return;
    }
    const delMedBtn = e.target.closest('.delete-medication-btn');
    if (delMedBtn) {
      confirmDeleteCareItem('med', delMedBtn.getAttribute('data-medication-id'));
      return;
    }

    const editCareBtn = e.target.closest('.edit-care-btn');
    if (editCareBtn) {
      openCareModal(editCareBtn.getAttribute('data-care-id'));
      return;
    }
    const delCareBtn = e.target.closest('.delete-care-btn');
    if (delCareBtn) {
      confirmDeleteCareItem('care', delCareBtn.getAttribute('data-care-id'));
      return;
    }

    // 7. Botão do empty state para adicionar primeiro animal
    if (e.target.closest('#btn-empty-add-first-pet')) {
      openPetFormModal();
      return;
    }
    if (e.target.closest('#btn-reset-filters')) {
      resetPetFilters();
      return;
    }
  });
}

function openPetDetailPage(petId) {
  const pet = allPets.find(p => p.id === petId);
  if (!pet) return;
  currentActivePetId = petId;
  renderPetDetail(pet);
  navigateToSection('section-pet-detail');
}

/* ==========================================================================
   FILTROS E BUSCA
   ========================================================================== */
function setupFilterListeners() {
  const inputSearch = document.getElementById('input-search-pets');
  const selSpecies = document.getElementById('filter-species');
  const selStatus = document.getElementById('filter-status');
  const selSize = document.getElementById('filter-size');
  const selSex = document.getElementById('filter-sex');
  const btnClearFilters = document.getElementById('btn-clear-filters');

  inputSearch?.addEventListener('input', (e) => {
    petFilters.search = e.target.value.toLowerCase().trim();
    applyAndRenderPetFilters();
  });

  selSpecies?.addEventListener('change', (e) => {
    petFilters.species = e.target.value;
    applyAndRenderPetFilters();
  });

  selStatus?.addEventListener('change', (e) => {
    petFilters.status = e.target.value;
    applyAndRenderPetFilters();
  });

  selSize?.addEventListener('change', (e) => {
    petFilters.size = e.target.value;
    applyAndRenderPetFilters();
  });

  selSex?.addEventListener('change', (e) => {
    petFilters.sex = e.target.value;
    applyAndRenderPetFilters();
  });

  btnClearFilters?.addEventListener('click', resetPetFilters);

  // Alternância Cards / Tabela
  const btnCards = document.getElementById('btn-toggle-cards');
  const btnTable = document.getElementById('btn-toggle-table');
  const cardsContainer = document.getElementById('pets-cards-container');
  const tableContainer = document.getElementById('pets-table-container');

  btnCards?.addEventListener('click', () => {
    currentPetsViewMode = 'cards';
    btnCards.classList.add('active');
    btnTable.classList.remove('active');
    if (cardsContainer) cardsContainer.style.display = 'grid';
    if (tableContainer) tableContainer.style.display = 'none';
  });

  btnTable?.addEventListener('click', () => {
    currentPetsViewMode = 'table';
    btnTable.classList.add('active');
    btnCards.classList.remove('active');
    if (cardsContainer) cardsContainer.style.display = 'none';
    if (tableContainer) tableContainer.style.display = 'block';
  });

  // Filtros na Central de Alertas
  document.getElementById('filter-alert-type')?.addEventListener('change', (e) => {
    alertFilters.type = e.target.value;
    applyAndRenderAlertFilters();
  });

  document.getElementById('filter-alert-urgency')?.addEventListener('change', (e) => {
    alertFilters.urgency = e.target.value;
    applyAndRenderAlertFilters();
  });
}

function resetPetFilters() {
  petFilters.search = '';
  petFilters.species = 'all';
  petFilters.status = 'all';
  petFilters.size = 'all';
  petFilters.sex = 'all';

  const inputSearch = document.getElementById('input-search-pets');
  const selSpecies = document.getElementById('filter-species');
  const selStatus = document.getElementById('filter-status');
  const selSize = document.getElementById('filter-size');
  const selSex = document.getElementById('filter-sex');
  if (inputSearch) inputSearch.value = '';
  if (selSpecies) selSpecies.value = 'all';
  if (selStatus) selStatus.value = 'all';
  if (selSize) selSize.value = 'all';
  if (selSex) selSex.value = 'all';

  applyAndRenderPetFilters();
}

function applyAndRenderPetFilters() {
  const isFiltered = petFilters.search !== '' ||
                     petFilters.species !== 'all' ||
                     petFilters.status !== 'all' ||
                     petFilters.size !== 'all' ||
                     petFilters.sex !== 'all';

  const btnClear = document.getElementById('btn-clear-filters');
  if (btnClear) btnClear.style.display = isFiltered ? 'inline-block' : 'none';

  const filtered = allPets.filter(pet => {
    // Busca por texto
    if (petFilters.search) {
      const term = petFilters.search;
      const matchName = pet.name.toLowerCase().includes(term);
      const matchBreed = (pet.breed || '').toLowerCase().includes(term);
      const matchNotes = (pet.notes || '').toLowerCase().includes(term);
      const matchColor = (pet.color || '').toLowerCase().includes(term);
      const matchAdopter = (pet.adopter?.name || '').toLowerCase().includes(term);
      if (!matchName && !matchBreed && !matchNotes && !matchColor && !matchAdopter) return false;
    }

    // Espécie
    if (petFilters.species !== 'all' && pet.species !== petFilters.species) return false;

    // Situação
    if (petFilters.status !== 'all' && pet.status !== petFilters.status) return false;

    // Porte
    if (petFilters.size !== 'all' && pet.size !== petFilters.size) return false;

    // Sexo
    if (petFilters.sex !== 'all' && pet.sex !== petFilters.sex) return false;

    return true;
  });

  renderPetsList(filtered, allPets);
}

function applyAndRenderAlertFilters() {
  const allAlerts = extractHealthAlerts(allPets, appSettings.alertDaysThreshold);

  const filtered = allAlerts.filter(alert => {
    if (alertFilters.type !== 'all' && alert.type !== alertFilters.type) return false;
    if (alertFilters.urgency !== 'all' && alert.urgency !== alertFilters.urgency) return false;
    return true;
  });

  renderAlertsView(filtered, allAlerts);
}

/* ==========================================================================
   FORMULÁRIOS E PERSISTÊNCIA (ANIMAIS E CUIDADOS)
   ========================================================================== */
function setupFormListeners() {
  // 1. Fechamento de Modais
  const closePairs = [
    { btnId: 'modal-pet-close', cancelBtnId: 'btn-cancel-pet', modalId: 'modal-pet' },
    { btnId: 'modal-vaccine-close', cancelBtnId: 'btn-cancel-vaccine', modalId: 'modal-vaccine' },
    { btnId: 'modal-dewormer-close', cancelBtnId: 'btn-cancel-dewormer', modalId: 'modal-dewormer' },
    { btnId: 'modal-medication-close', cancelBtnId: 'btn-cancel-medication', modalId: 'modal-medication' },
    { btnId: 'modal-care-close', cancelBtnId: 'btn-cancel-care', modalId: 'modal-care' },
    { btnId: 'confirm-close', cancelBtnId: 'btn-cancel-confirm', modalId: 'modal-confirm' }
  ];

  closePairs.forEach(p => {
    document.getElementById(p.btnId)?.addEventListener('click', () => closeModal(p.modalId));
    document.getElementById(p.cancelBtnId)?.addEventListener('click', () => closeModal(p.modalId));
  });

  // Fecha clicando no backdrop escuro
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });

  // Campo personalizado para outra espécie
  const speciesSelect = document.getElementById('pet-species-select');
  const customSpeciesWrap = document.getElementById('custom-species-wrap');
  speciesSelect?.addEventListener('change', (e) => {
    if (customSpeciesWrap) {
      customSpeciesWrap.style.display = e.target.value === 'Outro' ? 'block' : 'none';
    }
  });

  // Leitura de foto e conversão para base64
  const photoFileInput = document.getElementById('pet-photo-file');
  const photoUrlHidden = document.getElementById('pet-photo-url');
  photoFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (photoUrlHidden) photoUrlHidden.value = loadEvt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // 2. Submissão do Formulário de Animal (Cadastrar ou Editar)
  document.getElementById('form-pet')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const petId = document.getElementById('pet-form-id').value;
    const name = document.getElementById('pet-name-input').value.trim();
    const species = document.getElementById('pet-species-select').value;
    const customSpecies = document.getElementById('pet-custom-species-input').value.trim();
    const breed = document.getElementById('pet-breed-input').value.trim();
    const sex = document.getElementById('pet-sex-select').value;
    const size = document.getElementById('pet-size-select').value;
    const birthDate = document.getElementById('pet-birth-input').value;
    const approximateAge = document.getElementById('pet-approx-age-input').value.trim();
    const color = document.getElementById('pet-color-input').value.trim();
    const photoUrl = document.getElementById('pet-photo-url').value;
    const notes = document.getElementById('pet-notes-input').value.trim();

    if (!name) return;

    const timestamp = new Date().toISOString();

    if (petId) {
      // EDITAR ANIMAL EXISTENTE
      const existing = allPets.find(p => p.id === petId);
      if (existing) {
        const updatedPet = {
          ...existing,
          name,
          species,
          customSpecies: species === 'Outro' ? customSpecies : undefined,
          breed,
          sex,
          size,
          birthDate,
          approximateAge,
          color,
          photoUrl: photoUrl || existing.photoUrl,
          notes,
          updatedAt: timestamp
        };

        await savePet(updatedPet);
        allPets = allPets.map(p => (p.id === petId ? updatedPet : p));
      }
    } else {
      // CADASTRAR NOVO ANIMAL
      const newPet = {
        id: generateUniqueId('pet'),
        name,
        species,
        customSpecies: species === 'Outro' ? customSpecies : undefined,
        breed,
        sex,
        size,
        birthDate,
        approximateAge,
        color,
        photoUrl: photoUrl || undefined,
        notes,
        status: 'Disponível',
        vaccines: [],
        dewormers: [],
        medications: [],
        otherCare: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await savePet(newPet);
      allPets.unshift(newPet);
      currentActivePetId = newPet.id;
    }

    closeModal('modal-pet');
    refreshAllViews();
  });

  // 3. Submissão do Formulário de Vacinas
  document.getElementById('form-vaccine')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActivePetId) return;

    const vacId = document.getElementById('vaccine-id').value;
    const name = document.getElementById('vac-name').value.trim();
    const applicationDate = document.getElementById('vac-date').value;
    const nextDoseDate = document.getElementById('vac-next-date').value || undefined;
    const batch = document.getElementById('vac-batch').value.trim() || undefined;
    const veterinarian = document.getElementById('vac-vet').value.trim() || undefined;
    const notes = document.getElementById('vac-notes').value.trim() || undefined;

    const pet = allPets.find(p => p.id === currentActivePetId);
    if (!pet) return;

    let updatedVaccines = [...(pet.vaccines || [])];
    if (vacId) {
      updatedVaccines = updatedVaccines.map(v => (v.id === vacId ? { ...v, name, applicationDate, nextDoseDate, batch, veterinarian, notes } : v));
    } else {
      updatedVaccines.unshift({
        id: generateUniqueId('vac'),
        name,
        applicationDate,
        nextDoseDate,
        batch,
        veterinarian,
        notes
      });
    }

    pet.vaccines = updatedVaccines;
    pet.updatedAt = new Date().toISOString();
    await savePet(pet);

    closeModal('modal-vaccine');
    refreshAllViews();
  });

  // 4. Submissão do Formulário de Vermífugos
  document.getElementById('form-dewormer')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActivePetId) return;

    const dewId = document.getElementById('dewormer-id').value;
    const productName = document.getElementById('dew-product').value.trim();
    const applicationDate = document.getElementById('dew-date').value;
    const nextApplicationDate = document.getElementById('dew-next-date').value || undefined;
    const weightVal = document.getElementById('dew-weight').value;
    const weight = weightVal ? parseFloat(weightVal) : undefined;
    const dosage = document.getElementById('dew-dose').value.trim() || undefined;

    const pet = allPets.find(p => p.id === currentActivePetId);
    if (!pet) return;

    let updatedDewormers = [...(pet.dewormers || [])];
    if (dewId) {
      updatedDewormers = updatedDewormers.map(d => (d.id === dewId ? { ...d, productName, applicationDate, nextApplicationDate, weight, dosage } : d));
    } else {
      updatedDewormers.unshift({
        id: generateUniqueId('dew'),
        productName,
        applicationDate,
        nextApplicationDate,
        weight,
        dosage
      });
    }

    pet.dewormers = updatedDewormers;
    pet.updatedAt = new Date().toISOString();
    await savePet(pet);

    closeModal('modal-dewormer');
    refreshAllViews();
  });

  // 5. Submissão do Formulário de Medicamentos
  document.getElementById('form-medication')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActivePetId) return;

    const medId = document.getElementById('medication-id').value;
    const medicationName = document.getElementById('med-name').value.trim();
    const dosage = document.getElementById('med-dosage').value.trim();
    const frequency = document.getElementById('med-freq').value.trim();
    const startDate = document.getElementById('med-start-date').value;
    const endDate = document.getElementById('med-end-date').value || undefined;
    const status = document.getElementById('med-status').value;

    const pet = allPets.find(p => p.id === currentActivePetId);
    if (!pet) return;

    let updatedMeds = [...(pet.medications || [])];
    if (medId) {
      updatedMeds = updatedMeds.map(m => (m.id === medId ? { ...m, medicationName, dosage, frequency, startDate, endDate, status } : m));
    } else {
      updatedMeds.unshift({
        id: generateUniqueId('med'),
        medicationName,
        dosage,
        frequency,
        startDate,
        endDate,
        status
      });
    }

    pet.medications = updatedMeds;
    pet.updatedAt = new Date().toISOString();
    await savePet(pet);

    closeModal('modal-medication');
    refreshAllViews();
  });

  // 6. Submissão de Procedimentos e Consultas
  document.getElementById('form-care')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActivePetId) return;

    const careId = document.getElementById('care-id').value;
    const category = document.getElementById('care-category').value;
    const title = document.getElementById('care-title').value.trim();
    const date = document.getElementById('care-date').value;
    const veterinarian = document.getElementById('care-vet').value.trim() || undefined;
    const notes = document.getElementById('care-notes').value.trim() || undefined;

    const pet = allPets.find(p => p.id === currentActivePetId);
    if (!pet) return;

    let updatedCare = [...(pet.otherCare || [])];
    if (careId) {
      updatedCare = updatedCare.map(c => (c.id === careId ? { ...c, category, title, date, veterinarian, notes } : c));
    } else {
      updatedCare.unshift({
        id: generateUniqueId('care'),
        category,
        title,
        date,
        veterinarian,
        notes
      });
    }

    pet.otherCare = updatedCare;
    pet.updatedAt = new Date().toISOString();
    await savePet(pet);

    closeModal('modal-care');
    refreshAllViews();
  });

  // 7. Submissão do Status de Adoção e Adotante
  document.getElementById('form-adoption-status')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentActivePetId) return;

    const pet = allPets.find(p => p.id === currentActivePetId);
    if (!pet) return;

    const status = document.getElementById('adoption-status-select').value;
    let adopter = undefined;

    if (status === 'Em processo' || status === 'Adotado') {
      adopter = {
        name: document.getElementById('adopter-name').value.trim(),
        phone: document.getElementById('adopter-phone').value.trim(),
        email: document.getElementById('adopter-email').value.trim(),
        address: document.getElementById('adopter-address').value.trim(),
        notes: document.getElementById('adopter-notes').value.trim()
      };
    }

    pet.status = status;
    pet.adopter = adopter;
    pet.updatedAt = new Date().toISOString();

    await savePet(pet);
    refreshAllViews();
    alert('Situação de adoção atualizada com sucesso!');
  });
}

/* ==========================================================================
   MODAIS DE CUIDADOS (PREENCHIMENTO DE DADOS PARA ADIÇÃO OU EDIÇÃO)
   ========================================================================== */
function openPetFormModal(petId = null) {
  const form = document.getElementById('form-pet');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-pet-title');
  const idInput = document.getElementById('pet-form-id');
  const photoUrlHidden = document.getElementById('pet-photo-url');
  const customSpeciesWrap = document.getElementById('custom-species-wrap');

  if (petId) {
    const pet = allPets.find(p => p.id === petId);
    if (!pet) return;

    if (titleEl) titleEl.textContent = `Editar Animal: ${pet.name}`;
    if (idInput) idInput.value = pet.id;
    document.getElementById('pet-name-input').value = pet.name || '';
    document.getElementById('pet-species-select').value = pet.species || 'Cachorro';

    if (customSpeciesWrap) {
      customSpeciesWrap.style.display = pet.species === 'Outro' ? 'block' : 'none';
      document.getElementById('pet-custom-species-input').value = pet.customSpecies || '';
    }

    document.getElementById('pet-breed-input').value = pet.breed || '';
    document.getElementById('pet-sex-select').value = pet.sex || 'Macho';
    document.getElementById('pet-size-select').value = pet.size || 'Médio';
    document.getElementById('pet-birth-input').value = pet.birthDate || '';
    document.getElementById('pet-approx-age-input').value = pet.approximateAge || '';
    document.getElementById('pet-color-input').value = pet.color || '';
    document.getElementById('pet-notes-input').value = pet.notes || '';
    if (photoUrlHidden) photoUrlHidden.value = pet.photoUrl || '';
  } else {
    if (titleEl) titleEl.textContent = 'Cadastrar Novo Animal';
    if (idInput) idInput.value = '';
    if (photoUrlHidden) photoUrlHidden.value = '';
    if (customSpeciesWrap) customSpeciesWrap.style.display = 'none';
  }

  openModal('modal-pet');
}

function openVaccineModal(vacId = null) {
  const form = document.getElementById('form-vaccine');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-vaccine-title');
  const idInput = document.getElementById('vaccine-id');

  if (vacId && currentActivePetId) {
    const pet = allPets.find(p => p.id === currentActivePetId);
    const vac = pet?.vaccines?.find(v => v.id === vacId);
    if (vac) {
      if (titleEl) titleEl.textContent = 'Editar Vacina';
      if (idInput) idInput.value = vac.id;
      document.getElementById('vac-name').value = vac.name || '';
      document.getElementById('vac-date').value = vac.applicationDate || '';
      document.getElementById('vac-next-date').value = vac.nextDoseDate || '';
      document.getElementById('vac-batch').value = vac.batch || '';
      document.getElementById('vac-vet').value = vac.veterinarian || '';
      document.getElementById('vac-notes').value = vac.notes || '';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Registrar Vacina';
    if (idInput) idInput.value = '';
    document.getElementById('vac-date').value = new Date().toISOString().split('T')[0];
  }

  openModal('modal-vaccine');
}

function openDewormerModal(dewId = null) {
  const form = document.getElementById('form-dewormer');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-dewormer-title');
  const idInput = document.getElementById('dewormer-id');

  if (dewId && currentActivePetId) {
    const pet = allPets.find(p => p.id === currentActivePetId);
    const dew = pet?.dewormers?.find(d => d.id === dewId);
    if (dew) {
      if (titleEl) titleEl.textContent = 'Editar Vermífugo';
      if (idInput) idInput.value = dew.id;
      document.getElementById('dew-product').value = dew.productName || '';
      document.getElementById('dew-date').value = dew.applicationDate || '';
      document.getElementById('dew-next-date').value = dew.nextApplicationDate || '';
      document.getElementById('dew-weight').value = dew.weight || '';
      document.getElementById('dew-dose').value = dew.dosage || '';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Registrar Vermífugo';
    if (idInput) idInput.value = '';
    document.getElementById('dew-date').value = new Date().toISOString().split('T')[0];
  }

  openModal('modal-dewormer');
}

function openMedicationModal(medId = null) {
  const form = document.getElementById('form-medication');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-medication-title');
  const idInput = document.getElementById('medication-id');

  if (medId && currentActivePetId) {
    const pet = allPets.find(p => p.id === currentActivePetId);
    const med = pet?.medications?.find(m => m.id === medId);
    if (med) {
      if (titleEl) titleEl.textContent = 'Editar Medicamento';
      if (idInput) idInput.value = med.id;
      document.getElementById('med-name').value = med.medicationName || '';
      document.getElementById('med-dosage').value = med.dosage || '';
      document.getElementById('med-freq').value = med.frequency || '';
      document.getElementById('med-start-date').value = med.startDate || '';
      document.getElementById('med-end-date').value = med.endDate || '';
      document.getElementById('med-status').value = med.status || 'Ativo';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Registrar Medicamento';
    if (idInput) idInput.value = '';
    document.getElementById('med-start-date').value = new Date().toISOString().split('T')[0];
  }

  openModal('modal-medication');
}

function openCareModal(careId = null) {
  const form = document.getElementById('form-care');
  if (form) form.reset();

  const titleEl = document.getElementById('modal-care-title');
  const idInput = document.getElementById('care-id');

  if (careId && currentActivePetId) {
    const pet = allPets.find(p => p.id === currentActivePetId);
    const care = pet?.otherCare?.find(c => c.id === careId);
    if (care) {
      if (titleEl) titleEl.textContent = 'Editar Procedimento';
      if (idInput) idInput.value = care.id;
      document.getElementById('care-category').value = care.category || 'Consulta';
      document.getElementById('care-title').value = care.title || '';
      document.getElementById('care-date').value = care.date || '';
      document.getElementById('care-vet').value = care.veterinarian || '';
      document.getElementById('care-notes').value = care.notes || '';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Registrar Cuidado / Procedimento';
    if (idInput) idInput.value = '';
    document.getElementById('care-date').value = new Date().toISOString().split('T')[0];
  }

  openModal('modal-care');
}

/* ==========================================================================
   EXCLUSÃO COM CONFIRMAÇÃO
   ========================================================================== */
function confirmDeletePet(petId) {
  const pet = allPets.find(p => p.id === petId);
  const name = pet ? pet.name : 'este animal';

  showConfirmModal(
    'Excluir Animal',
    `Tem certeza que deseja excluir permanentemente o cadastro de ${name} e todo o seu histórico de vacinas, vermífugos e tratamentos? Esta ação não pode ser desfeita.`,
    async () => {
      await deletePet(petId);
      allPets = allPets.filter(p => p.id !== petId);
      if (currentActivePetId === petId) {
        currentActivePetId = null;
        navigateToSection('section-pets');
      }
      refreshAllViews();
    }
  );
}

function confirmDeleteCareItem(type, itemId) {
  if (!currentActivePetId) return;
  const pet = allPets.find(p => p.id === currentActivePetId);
  if (!pet) return;

  const typeLabels = {
    vac: 'registro de vacina',
    dew: 'registro de vermífugo',
    med: 'medicamento',
    care: 'procedimento'
  };

  showConfirmModal(
    'Excluir Registro',
    `Deseja realmente remover este ${typeLabels[type] || 'registro'} da ficha do animal?`,
    async () => {
      if (type === 'vac') {
        pet.vaccines = (pet.vaccines || []).filter(v => v.id !== itemId);
      } else if (type === 'dew') {
        pet.dewormers = (pet.dewormers || []).filter(d => d.id !== itemId);
      } else if (type === 'med') {
        pet.medications = (pet.medications || []).filter(m => m.id !== itemId);
      } else if (type === 'care') {
        pet.otherCare = (pet.otherCare || []).filter(c => c.id !== itemId);
      }
      pet.updatedAt = new Date().toISOString();
      await savePet(pet);
      refreshAllViews();
    }
  );
}

/* ==========================================================================
   CONFIGURAÇÕES, BACKUPS E LIMPEZA TOTAL
   ========================================================================== */
function setupSettingsListeners() {
  // Salvar preferências
  document.getElementById('form-settings-general')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const orgName = document.getElementById('settings-org-input').value.trim();
    const threshold = parseInt(document.getElementById('settings-threshold-select').value, 10);

    appSettings.organizationName = orgName || 'Meu Abrigo / Controle Pet';
    appSettings.alertDaysThreshold = isNaN(threshold) ? 15 : threshold;

    await saveSettings(appSettings);
    applySettingsToUI();
    refreshAllViews();

    const feedback = document.getElementById('settings-save-feedback');
    if (feedback) {
      feedback.style.display = 'inline';
      setTimeout(() => { feedback.style.display = 'none'; }, 3000);
    }
  });

  // Exportar Backup JSON
  document.getElementById('btn-export-backup')?.addEventListener('click', async () => {
    try {
      const jsonStr = await exportDatabaseToJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateTag = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `backup_petmanager_${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Falha ao exportar backup:', err);
      alert('Não foi possível gerar o arquivo de backup.');
    }
  });

  // Importar Backup JSON
  const triggerImportBtn = document.getElementById('btn-trigger-import');
  const importFileInput = document.getElementById('input-import-file');
  const importStatusBox = document.getElementById('import-status-box');

  triggerImportBtn?.addEventListener('click', () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const success = await importDatabaseFromJSON(event.target.result);
        if (success) {
          allPets = await getAllPets();
          appSettings = await getSettings();
          applySettingsToUI();
          refreshAllViews();

          if (importStatusBox) {
            importStatusBox.style.display = 'block';
            importStatusBox.style.backgroundColor = 'var(--emerald-50)';
            importStatusBox.style.color = 'var(--emerald-800)';
            importStatusBox.textContent = 'Backup restaurado com sucesso! Seus animais e configurações foram carregados.';
          }
        } else {
          throw new Error('Arquivo JSON inválido.');
        }
      } catch (err) {
        if (importStatusBox) {
          importStatusBox.style.display = 'block';
          importStatusBox.style.backgroundColor = 'var(--rose-50)';
          importStatusBox.style.color = 'var(--rose-800)';
          importStatusBox.textContent = 'Falha ao importar: o arquivo selecionado não é um backup compatível do Pet Manager.';
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reseta input
  });

  // Limpeza Total do Banco
  document.getElementById('btn-clear-database')?.addEventListener('click', () => {
    showConfirmModal(
      'Limpar Absolutamente Todos os Dados',
      'Tem certeza que deseja apagar todos os animais cadastrados, histórico de vacinas, vermífugos, remédios e anotações do armazenamento deste dispositivo? Esta ação é irreversível.',
      async () => {
        await clearAllPets();
        allPets = [];
        currentActivePetId = null;
        refreshAllViews();
        navigateToSection('section-dashboard');
      }
    );
  });
}