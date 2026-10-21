/**
 * database.js - Módulo de Persistência Local (IndexedDB) do Pet Manager
 * 
 * Responsabilidades:
 * - Conectar ao IndexedDB nativo do navegador (PetManagerDB).
 * - Criar e versionar object stores ('pets' e 'settings').
 * - CRUD completo de animais (criar, ler por id, listar, atualizar e excluir).
 * - Gerenciamento de preferências do sistema.
 * - Exportação e importação de backups completos em JSON.
 * - Geração de IDs únicos para animais e registros vinculados.
 */

const DB_NAME = 'PetManagerDB';
const DB_VERSION = 1;
const STORE_PETS = 'pets';
const STORE_SETTINGS = 'settings';

export const DEFAULT_SETTINGS = {
  organizationName: 'Meu Abrigo / Controle Pet',
  alertDaysThreshold: 15
};

/**
 * Gera um ID único para qualquer entidade (animais, vacinas, vermífugos, medicamentos, etc.)
 * @param {string} prefix Prefixo indicativo (ex: 'pet', 'vac', 'dew', 'med', 'care')
 * @returns {string} Identificador único
 */
export function generateUniqueId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Abre ou inicializa a conexão com o banco de dados IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB não é suportado pelo seu navegador/dispositivo.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Object Store de Animais (identificados pela chave única 'id')
      if (!db.objectStoreNames.contains(STORE_PETS)) {
        const petStore = db.createObjectStore(STORE_PETS, { keyPath: 'id' });
        petStore.createIndex('name', 'name', { unique: false });
        petStore.createIndex('species', 'species', { unique: false });
        petStore.createIndex('status', 'status', { unique: false });
        petStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Object Store de Configurações
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Recupera todos os animais cadastrados no IndexedDB
 * @returns {Promise<Array>} Lista de animais ordenada do mais recente para o mais antigo
 */
export async function getAllPets() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PETS], 'readonly');
      const store = tx.objectStore(STORE_PETS);
      const request = store.getAll();

      request.onsuccess = () => {
        const pets = request.result || [];
        // Ordena por data de criação (mais recente primeiro)
        pets.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        resolve(pets);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Erro ao listar animais do IndexedDB:', err);
    return [];
  }
}

/**
 * Consulta um animal específico pelo seu ID
 * @param {string} petId Identificador do animal
 * @returns {Promise<Object|null>}
 */
export async function getPetById(petId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PETS], 'readonly');
      const store = tx.objectStore(STORE_PETS);
      const request = store.get(petId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Erro ao buscar animal no IndexedDB:', err);
    return null;
  }
}

/**
 * Salva ou atualiza um animal no IndexedDB
 * @param {Object} pet Objeto completo do animal com seu ID
 * @returns {Promise<void>}
 */
export async function savePet(pet) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PETS], 'readwrite');
    const store = tx.objectStore(STORE_PETS);
    const request = store.put(pet);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove um animal e todos os seus vínculos do banco de dados
 * @param {string} petId Identificador do animal a excluir
 * @returns {Promise<void>}
 */
export async function deletePet(petId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PETS], 'readwrite');
    const store = tx.objectStore(STORE_PETS);
    const request = store.delete(petId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Limpa todos os animais da base de dados local
 * @returns {Promise<void>}
 */
export async function clearAllPets() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PETS], 'readwrite');
    const store = tx.objectStore(STORE_PETS);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Salva uma coleção inteira de animais (usado ao importar backups)
 * @param {Array} pets Lista de animais a persistir
 * @returns {Promise<void>}
 */
export async function saveAllPetsBatch(pets) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PETS], 'readwrite');
    const store = tx.objectStore(STORE_PETS);

    const clearReq = store.clear();

    clearReq.onsuccess = () => {
      if (!pets || pets.length === 0) {
        resolve();
        return;
      }

      let count = 0;
      let hasError = false;

      pets.forEach((pet) => {
        const putReq = store.put(pet);
        putReq.onsuccess = () => {
          count++;
          if (count === pets.length && !hasError) {
            resolve();
          }
        };
        putReq.onerror = () => {
          hasError = true;
          reject(putReq.error);
        };
      });
    };

    clearReq.onerror = () => reject(clearReq.error);
  });
}

/**
 * Lê as configurações gerais salvas no IndexedDB
 * @returns {Promise<Object>}
 */
export async function getSettings() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction([STORE_SETTINGS], 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get('app_config');

      request.onsuccess = () => {
        if (request.result && request.result.data) {
          resolve({ ...DEFAULT_SETTINGS, ...request.result.data });
        } else {
          resolve(DEFAULT_SETTINGS);
        }
      };

      request.onerror = () => resolve(DEFAULT_SETTINGS);
    });
  } catch (err) {
    console.error('Erro ao ler configurações do IndexedDB:', err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Salva as configurações no IndexedDB
 * @param {Object} settings Objeto com as preferências atualizadas
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SETTINGS], 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.put({ key: 'app_config', data: settings });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Erro ao salvar configurações no IndexedDB:', err);
  }
}

/**
 * Exporta toda a base de dados (animais e configurações) para uma string formatada em JSON
 * @returns {Promise<string>}
 */
export async function exportDatabaseToJSON() {
  const [pets, settings] = await Promise.all([getAllPets(), getSettings()]);
  const exportPayload = {
    app: 'PetManager',
    version: '1.0',
    storage: 'IndexedDB',
    exportedAt: new Date().toISOString(),
    settings,
    pets
  };
  return JSON.stringify(exportPayload, null, 2);
}

/**
 * Importa e restaura uma base de dados a partir de uma string JSON
 * @param {string} jsonString Conteúdo lido do arquivo de backup
 * @returns {Promise<boolean>} Retorna true se a importação foi bem-sucedida
 */
export async function importDatabaseFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || !Array.isArray(data.pets)) {
      return false;
    }

    // Restaura os animais no IndexedDB
    await saveAllPetsBatch(data.pets);

    // Restaura as configurações se presentes
    if (data.settings) {
      await saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
    }

    return true;
  } catch (err) {
    console.error('Falha ao processar arquivo de backup JSON:', err);
    return false;
  }
}