/**
 * ui.js - Módulo de Interface e Renderização Visual do Pet Manager
 * 
 * Responsabilidades:
 * - Manipulação e atualização de elementos do DOM.
 * - Formatação amigável de datas, idades e dias restantes.
 * - Renderização do Dashboard (indicadores KPIs, últimos cadastrados, espécies e alertas).
 * - Renderização da lista de animais em Cards e em Tabela com badges de situação e alertas.
 * - Renderização da Ficha Completa do Animal (cabeçalho, vacinas, vermífugos, medicamentos, consultas e adoção).
 * - Renderização da Central de Alertas.
 * - Controle de exibição e fechamento dos modais de cadastro e confirmação.
 */

/* ==========================================================================
   UTILITÁRIOS DE FORMATAÇÃO E CÁLCULOS
   ========================================================================== */

/**
 * Converte data ISO (AAAA-MM-DD) para formato brasileiro (DD/MM/AAAA)
 * @param {string} dateStr Data em formato YYYY-MM-DD
 * @returns {string} Data formatada
 */
export function formatDateBR(dateStr) {
  if (!dateStr) return 'Não informada';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Calcula a quantidade de dias restantes a partir da data de hoje até a data alvo
 * @param {string} targetDateStr Data no formato YYYY-MM-DD
 * @returns {number} Dias restantes (negativo se já venceu)
 */
export function getDaysRemaining(targetDateStr) {
  if (!targetDateStr) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [y, m, d] = targetDateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);

  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Retorna texto amigável sobre o prazo (Ex: "Vencido há 3 dias", "Vence hoje", "Em 5 dias")
 * @param {string} targetDateStr Data alvo
 * @returns {string}
 */
export function getFriendlyRelativeDays(targetDateStr) {
  const days = getDaysRemaining(targetDateStr);
  if (days < 0) {
    const abs = Math.abs(days);
    return abs === 1 ? 'Venceu ontem' : `Venceu há ${abs} dias`;
  }
  if (days === 0) return 'Vence hoje!';
  if (days === 1) return 'Vence amanhã';
  return `Em ${days} dias`;
}

/**
 * Calcula a idade formatada a partir da data de nascimento ou usa o campo aproximado
 * @param {string} birthDate Data de nascimento (AAAA-MM-DD)
 * @param {string} approxAge Idade aproximada manual
 * @returns {string}
 */
export function calculateAge(birthDate, approxAge) {
  if (!birthDate) return approxAge || 'Não informada';
  const today = new Date();
  const [y, m, d] = birthDate.split('-').map(Number);
  const birth = new Date(y, m - 1, d);

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months--;
  }
  if (months < 0) {
    years--;
    months += 12;
  }

  if (years <= 0 && months <= 0) return 'Recém-nascido (< 1 mês)';
  if (years <= 0) return months === 1 ? '1 mês' : `${months} meses`;
  if (months === 0) return years === 1 ? '1 ano' : `${years} anos`;
  return `${years} ano(s) e ${months} m`;
}

/**
 * Retorna classes CSS de cores para os badges de situação
 * @param {string} status Situação cadastral do pet
 * @returns {string} Estilo inline de cor e borda
 */
function getStatusStyle(status) {
  switch (status) {
    case 'Disponível':
      return 'background-color: var(--emerald-50); color: var(--emerald-800); border: 1px solid var(--emerald-100);';
    case 'Em processo':
      return 'background-color: var(--amber-50); color: var(--amber-800); border: 1px solid var(--amber-100);';
    case 'Adotado':
      return 'background-color: var(--purple-50); color: var(--purple-800); border: 1px solid var(--purple-100);';
    case 'Em tratamento':
      return 'background-color: var(--rose-50); color: var(--rose-800); border: 1px solid var(--rose-200);';
    default:
      return 'background-color: var(--slate-100); color: var(--slate-700); border: 1px solid var(--slate-200);';
  }
}

/**
 * Analisa e extrai todos os alertas de saúde de todos os animais
 * @param {Array} pets Lista de animais
 * @param {number} threshold Dias de antecedência limite
 * @returns {Array} Lista de alertas ordenados por urgência
 */
export function extractHealthAlerts(pets, threshold = 15) {
  const alerts = [];

  pets.forEach(pet => {
    // 1. Vacinas
    (pet.vaccines || []).forEach(vac => {
      if (vac.nextDoseDate) {
        const days = getDaysRemaining(vac.nextDoseDate);
        let urgency = null;
        if (days < 0) urgency = 'overdue';
        else if (days <= 7) urgency = 'urgent';
        else if (days <= threshold) urgency = 'upcoming';

        if (urgency) {
          alerts.push({
            id: `vac_${vac.id}`,
            petId: pet.id,
            petName: pet.name,
            petSpecies: pet.species,
            petPhoto: pet.photoUrl,
            type: 'Vacina',
            title: `Vacina: ${vac.name}`,
            targetDate: vac.nextDoseDate,
            daysRemaining: days,
            urgency,
            description: days < 0 ? `Dose atrasada de ${vac.name}` : `Próxima dose de ${vac.name}`
          });
        }
      }
    });

    // 2. Vermífugos
    (pet.dewormers || []).forEach(dew => {
      if (dew.nextApplicationDate) {
        const days = getDaysRemaining(dew.nextApplicationDate);
        let urgency = null;
        if (days < 0) urgency = 'overdue';
        else if (days <= 7) urgency = 'urgent';
        else if (days <= threshold) urgency = 'upcoming';

        if (urgency) {
          alerts.push({
            id: `dew_${dew.id}`,
            petId: pet.id,
            petName: pet.name,
            petSpecies: pet.species,
            petPhoto: pet.photoUrl,
            type: 'Vermífugo',
            title: `Vermífugo: ${dew.productName}`,
            targetDate: dew.nextApplicationDate,
            daysRemaining: days,
            urgency,
            description: days < 0 ? `Aplicação atrasada (${dew.productName})` : `Nova dose (${dew.productName})`
          });
        }
      }
    });

    // 3. Medicamentos Ativos
    (pet.medications || []).forEach(med => {
      if (med.status === 'Ativo' && med.endDate) {
        const days = getDaysRemaining(med.endDate);
        let urgency = null;
        if (days < 0) urgency = 'overdue';
        else if (days <= 5) urgency = 'urgent';
        else if (days <= threshold) urgency = 'upcoming';

        if (urgency) {
          alerts.push({
            id: `med_${med.id}`,
            petId: pet.id,
            petName: pet.name,
            petSpecies: pet.species,
            petPhoto: pet.photoUrl,
            type: 'Medicamento',
            title: `Medicamento: ${med.medicationName}`,
            targetDate: med.endDate,
            daysRemaining: days,
            urgency,
            description: days < 0 ? `Término previsto expirou` : `Ciclo ativo finaliza em breve`
          });
        }
      }
    });
  });

  // Ordena pelo prazo mais urgente (menores dias restantes primeiro)
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/* ==========================================================================
   RENDERIZAÇÃO DO DASHBOARD
   ========================================================================== */

/**
 * Atualiza os indicadores de topo e resumos do Dashboard
 * @param {Array} pets Lista de animais
 * @param {Array} alerts Lista de alertas extraídos
 */
export function renderDashboard(pets, alerts) {
  // Contadores gerais
  const total = pets.length;
  const available = pets.filter(p => p.status === 'Disponível').length;
  const inProcess = pets.filter(p => p.status === 'Em processo').length;
  const adopted = pets.filter(p => p.status === 'Adotado').length;
  const inTreatment = pets.filter(p => p.status === 'Em tratamento').length;

  const overdueCount = alerts.filter(a => a.urgency === 'overdue').length;
  const vaccineAlertsCount = alerts.filter(a => a.type === 'Vacina').length;
  const dewormerAlertsCount = alerts.filter(a => a.type === 'Vermífugo').length;

  let activeMedsCount = 0;
  pets.forEach(p => {
    activeMedsCount += (p.medications || []).filter(m => m.status === 'Ativo').length;
  });

  // 1. Atualizar KPIs do Dashboard
  const elTotal = document.getElementById('kpi-val-total');
  if (elTotal) elTotal.textContent = total;

  const elVac = document.getElementById('kpi-val-vaccines');
  const elVacSub = document.getElementById('kpi-val-vaccines-sub');
  const elVacDesc = document.getElementById('kpi-val-vaccines-desc');
  if (elVac) elVac.textContent = vaccineAlertsCount;
  if (elVacSub) elVacSub.textContent = overdueCount > 0 ? `(${overdueCount} atrasada)` : 'em alerta';
  if (elVacDesc) elVacDesc.textContent = overdueCount > 0 ? 'Atenção necessária' : 'Controle em dia';

  const elDew = document.getElementById('kpi-val-dewormers');
  if (elDew) elDew.textContent = dewormerAlertsCount;

  const elMeds = document.getElementById('kpi-val-meds');
  if (elMeds) elMeds.textContent = activeMedsCount;

  const elAdopted = document.getElementById('kpi-val-adopted');
  const elAvailable = document.getElementById('kpi-val-available');
  if (elAdopted) elAdopted.textContent = adopted;
  if (elAvailable) elAvailable.textContent = `${available} disponíveis para adoção`;

  // Badge de alerta na navegação do topo
  const navBadge = document.getElementById('nav-alerts-badge');
  if (navBadge) {
    if (alerts.length > 0) {
      navBadge.style.display = 'inline-block';
      navBadge.textContent = alerts.length;
    } else {
      navBadge.style.display = 'none';
    }
  }

  // 2. Status de Adoção e Situação
  const stAvail = document.getElementById('stat-count-available');
  const stProc = document.getElementById('stat-count-process');
  const stAdopt = document.getElementById('stat-count-adopted');
  const stTreat = document.getElementById('stat-count-treatment');
  if (stAvail) stAvail.textContent = available;
  if (stProc) stProc.textContent = inProcess;
  if (stAdopt) stAdopt.textContent = adopted;
  if (stTreat) stTreat.textContent = inTreatment;

  // 3. Alertas de Saúde Próximos no Dashboard (Top 5)
  const dashAlertsContainer = document.getElementById('dash-alerts-container');
  if (dashAlertsContainer) {
    if (alerts.length === 0) {
      dashAlertsContainer.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <svg class="empty-state-icon" style="color: var(--emerald-600);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div class="empty-state-title">Tudo em dia!</div>
          <div class="empty-state-text">Nenhuma vacina ou vermífugo pendente ou atrasado no momento.</div>
        </div>
      `;
    } else {
      const topAlerts = alerts.slice(0, 5);
      let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';

      topAlerts.forEach(alert => {
        const isOverdue = alert.urgency === 'overdue';
        const badgeColor = isOverdue
          ? 'background-color: var(--rose-50); color: var(--rose-700); border: 1px solid var(--rose-200);'
          : 'background-color: var(--amber-50); color: var(--amber-700); border: 1px solid var(--amber-100);';

        html += `
          <div class="alert-item-card" data-pet-id="${alert.petId}" style="padding: 12px 16px; margin: 0;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <div style="width: 42px; height: 42px; border-radius: var(--radius-md); background: var(--slate-100); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${alert.petPhoto 
                  ? `<img src="${alert.petPhoto}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" stroke-width="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>`}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 13px; font-weight: 800; color: var(--slate-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${alert.petName} <span style="font-size: 11px; font-weight: 500; color: var(--slate-500);">(${alert.petSpecies})</span>
                </div>
                <div style="font-size: 12px; font-weight: 700; color: var(--slate-700);">${alert.title}</div>
                <div style="font-size: 11px; color: var(--slate-500);">${formatDateBR(alert.targetDate)}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; align-self: flex-end;">
              <span style="font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: var(--radius-full); ${badgeColor}">
                ${getFriendlyRelativeDays(alert.targetDate)}
              </span>
            </div>
          </div>
        `;
      });

      html += '</div>';
      dashAlertsContainer.innerHTML = html;
    }
  }

  // 4. Últimos Cadastrados (Top 4)
  const dashRecentContainer = document.getElementById('dash-recent-pets-container');
  if (dashRecentContainer) {
    if (pets.length === 0) {
      dashRecentContainer.innerHTML = `
        <p style="font-size: 12px; color: var(--slate-500); text-align: center; padding: 24px 0;">
          Nenhum animal cadastrado ainda.
        </p>
      `;
    } else {
      const recents = pets.slice(0, 4);
      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';

      recents.forEach(pet => {
        html += `
          <div class="dash-recent-item" data-pet-id="${pet.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-radius: var(--radius-md); cursor: pointer; transition: background-color 0.15s ease;">
            <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
              <div style="width: 38px; height: 38px; border-radius: var(--radius-md); background: var(--slate-100); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                ${pet.photoUrl 
                  ? `<img src="${pet.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" stroke-width="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>`}
              </div>
              <div style="min-width: 0;">
                <div style="font-size: 13px; font-weight: 800; color: var(--slate-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${pet.name}
                </div>
                <div style="font-size: 11px; color: var(--slate-500);">${pet.species} • ${pet.sex}</div>
              </div>
            </div>
            <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); ${getStatusStyle(pet.status)}">
              ${pet.status}
            </span>
          </div>
        `;
      });

      html += '</div>';
      dashRecentContainer.innerHTML = html;
    }
  }

  // 5. Distribuição por Espécie
  const dashSpeciesContainer = document.getElementById('dash-species-container');
  if (dashSpeciesContainer) {
    const speciesList = [
      { label: 'Cachorros', count: pets.filter(p => p.species === 'Cachorro').length, color: '#4f46e5' },
      { label: 'Gatos', count: pets.filter(p => p.species === 'Gato').length, color: '#0d9488' },
      { label: 'Aves', count: pets.filter(p => p.species === 'Ave').length, color: '#d97706' },
      { label: 'Outros', count: pets.filter(p => p.species === 'Outro').length, color: '#9333ea' }
    ];

    let html = '';
    speciesList.forEach(sp => {
      const pct = total > 0 ? Math.round((sp.count / total) * 100) : 0;
      html += `
        <div>
          <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 4px;">
            <span>${sp.label}</span>
            <span style="color: var(--slate-500);">${sp.count} (${pct}%)</span>
          </div>
          <div style="height: 8px; width: 100%; background: var(--slate-100); border-radius: var(--radius-full); overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: ${sp.color}; border-radius: var(--radius-full); transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    });
    dashSpeciesContainer.innerHTML = html;
  }
}

/* ==========================================================================
   RENDERIZAÇÃO DA LISTA DE ANIMAIS (CARDS & TABELA)
   ========================================================================== */

/**
 * Renderiza os animais filtrados em formato Cards e formato Tabela
 * @param {Array} filteredPets Lista de animais filtrados
 * @param {Array} allPets Lista total de animais cadastrados
 */
export function renderPetsList(filteredPets, allPets) {
  const cardsContainer = document.getElementById('pets-cards-container');
  const tableTbody = document.getElementById('pets-table-tbody');
  const countIndicator = document.getElementById('pets-count-indicator');

  if (countIndicator) {
    countIndicator.textContent = `Exibindo ${filteredPets.length} de ${allPets.length} animal(is)`;
  }

  // 1. Estado sem nenhum animal no sistema
  if (allPets.length === 0) {
    const emptyHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>
        <h2 class="empty-state-title">Nenhum animal cadastrado ainda</h2>
        <p class="empty-state-text">
          Cadastre seu primeiro animal para iniciar o acompanhamento de vacinas, vermífugos, remédios e controle de adoções.
        </p>
        <button id="btn-empty-add-first-pet" class="btn-primary" style="display: inline-flex; align-items: center; gap: 8px;">
          + Cadastrar Primeiro Animal
        </button>
      </div>
    `;
    if (cardsContainer) cardsContainer.innerHTML = emptyHTML;
    if (tableTbody) {
      tableTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--slate-500);">Nenhum animal cadastrado ainda.</td></tr>`;
    }
    return;
  }

  // 2. Estado de busca sem resultados
  if (filteredPets.length === 0) {
    const noResultsHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 20px;">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <h2 class="empty-state-title">Nenhum animal encontrado</h2>
        <p class="empty-state-text">Tente alterar os termos da busca ou limpar os filtros aplicados.</p>
        <button id="btn-reset-filters" class="btn-secondary">Limpar Filtros de Busca</button>
      </div>
    `;
    if (cardsContainer) cardsContainer.innerHTML = noResultsHTML;
    if (tableTbody) {
      tableTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--slate-500);">Nenhum animal encontrado com os filtros atuais.</td></tr>`;
    }
    return;
  }

  // 3. Renderizar CARDS
  if (cardsContainer) {
    let cardsHTML = '';
    filteredPets.forEach(pet => {
      // Contagem de alertas pendentes deste animal específico
      let overdueCount = 0;
      (pet.vaccines || []).forEach(v => {
        if (v.nextDoseDate && getDaysRemaining(v.nextDoseDate) < 0) overdueCount++;
      });
      (pet.dewormers || []).forEach(d => {
        if (d.nextApplicationDate && getDaysRemaining(d.nextApplicationDate) < 0) overdueCount++;
      });

      cardsHTML += `
        <div class="pet-card" id="card-pet-${pet.id}">
          <div class="pet-card-image-wrap" data-pet-id="${pet.id}">
            ${pet.photoUrl 
              ? `<img src="${pet.photoUrl}" alt="${pet.name}" class="pet-card-img" />`
              : `<div style="color: var(--slate-300); display: flex; flex-direction: column; align-items: center;">
                   <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>
                   <span style="font-size: 11px; font-weight: 600; color: var(--slate-400); margin-top: 4px;">Sem foto</span>
                 </div>`}
            <span class="badge-status" style="${getStatusStyle(pet.status)}">${pet.status}</span>
            ${overdueCount > 0 
              ? `<span class="badge-alert-pill">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                   ${overdueCount} atrasada(s)
                 </span>`
              : ''}
          </div>

          <div class="pet-card-body">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <h3 class="pet-card-name" data-pet-id="${pet.id}">${pet.name}</h3>
                <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-sm); ${pet.sex === 'Macho' ? 'background: #eff6ff; color: #1d4ed8;' : 'background: #fdf2f8; color: #db2777;'}">
                  ${pet.sex}
                </span>
              </div>
              <div class="pet-meta-row">
                ${pet.species === 'Outro' && pet.customSpecies ? pet.customSpecies : pet.species} • ${pet.breed || 'SRD'} • Porte ${pet.size}
              </div>
              <div class="pet-age-text">
                Idade: <strong>${calculateAge(pet.birthDate, pet.approximateAge)}</strong>
              </div>

              ${pet.adopter && pet.status !== 'Disponível'
                ? `<div style="margin-top: 10px; padding: 6px 10px; background-color: var(--emerald-50); border-radius: var(--radius-sm); font-size: 11px; font-weight: 700; color: var(--emerald-800); display: flex; align-items: center; gap: 6px;">
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--emerald-600)" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                     Adotante: ${pet.adopter.name}
                   </div>`
                : ''}

              <div class="pet-care-summary">
                <span>${pet.vaccines?.length || 0} Vacinas</span>
                <span>•</span>
                <span>${pet.dewormers?.length || 0} Vermífugos</span>
                <span>•</span>
                <span>${pet.medications?.length || 0} Remédios</span>
              </div>
            </div>

            <div class="pet-card-footer">
              <button class="btn-view-profile" data-pet-id="${pet.id}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                Ver Ficha e Cuidados
              </button>
              <button class="icon-action-btn edit-pet-btn" data-pet-id="${pet.id}" title="Editar Animal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-pet-btn" data-pet-id="${pet.id}" title="Excluir Animal">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    });
    cardsContainer.innerHTML = cardsHTML;
  }

  // 4. Renderizar TABELA
  if (tableTbody) {
    let rowsHTML = '';
    filteredPets.forEach(pet => {
      let overdueCount = 0;
      (pet.vaccines || []).forEach(v => {
        if (v.nextDoseDate && getDaysRemaining(v.nextDoseDate) < 0) overdueCount++;
      });
      (pet.dewormers || []).forEach(d => {
        if (d.nextApplicationDate && getDaysRemaining(d.nextApplicationDate) < 0) overdueCount++;
      });

      rowsHTML += `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px; cursor: pointer;" data-pet-id="${pet.id}">
              <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--slate-100); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${pet.photoUrl 
                  ? `<img src="${pet.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
                  : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" stroke-width="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>`}
              </div>
              <div>
                <strong style="color: var(--slate-900);">${pet.name}</strong>
                ${pet.adopter ? `<div style="font-size: 11px; color: var(--emerald-700);">Tutor: ${pet.adopter.name}</div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <div><strong>${pet.species === 'Outro' && pet.customSpecies ? pet.customSpecies : pet.species}</strong></div>
            <div style="font-size: 11px; color: var(--slate-500);">${pet.breed || 'SRD'}</div>
          </td>
          <td>${pet.sex} • Porte ${pet.size}</td>
          <td>${calculateAge(pet.birthDate, pet.approximateAge)}</td>
          <td>
            <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); ${getStatusStyle(pet.status)}">
              ${pet.status}
            </span>
          </td>
          <td>
            <div style="font-size: 11px; color: var(--slate-500); display: flex; align-items: center; gap: 6px;">
              <span>${pet.vaccines?.length || 0} vac.</span>
              <span>•</span>
              <span>${pet.dewormers?.length || 0} verm.</span>
              ${overdueCount > 0 ? `<span style="background: var(--rose-100); color: var(--rose-700); font-weight: 800; padding: 1px 6px; border-radius: 4px;">${overdueCount} atrasada(s)</span>` : ''}
            </div>
          </td>
          <td style="text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
              <button class="icon-action-btn view-pet-btn" data-pet-id="${pet.id}" title="Ver Ficha">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="icon-action-btn edit-pet-btn" data-pet-id="${pet.id}" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-pet-btn" data-pet-id="${pet.id}" title="Excluir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });
    tableTbody.innerHTML = rowsHTML;
  }
}

/* ==========================================================================
   RENDERIZAÇÃO DA FICHA COMPLETA DO ANIMAL
   ========================================================================== */

/**
 * Renderiza todos os dados e histórico do animal na tela de detalhes
 * @param {Object} pet Objeto completo do animal
 */
export function renderPetDetail(pet) {
  if (!pet) return;

  // 1. Cabeçalho
  const elName = document.getElementById('detail-pet-name');
  const elMeta = document.getElementById('detail-pet-meta');
  const elNotes = document.getElementById('detail-pet-notes');
  const elPhoto = document.getElementById('detail-pet-photo');
  const elPlaceholder = document.getElementById('detail-pet-placeholder');
  const elStatusBadge = document.getElementById('detail-status-badge');
  const elAgeBadge = document.getElementById('detail-age-badge');

  if (elName) elName.textContent = pet.name;
  if (elMeta) {
    const sp = pet.species === 'Outro' && pet.customSpecies ? pet.customSpecies : pet.species;
    elMeta.textContent = `${sp} • ${pet.breed || 'SRD'} • ${pet.sex} • Porte ${pet.size}`;
  }
  if (elNotes) elNotes.textContent = pet.notes || 'Nenhuma observação geral cadastrada.';

  if (elPhoto && elPlaceholder) {
    if (pet.photoUrl) {
      elPhoto.src = pet.photoUrl;
      elPhoto.style.display = 'block';
      elPlaceholder.style.display = 'none';
    } else {
      elPhoto.style.display = 'none';
      elPlaceholder.style.display = 'block';
    }
  }

  if (elStatusBadge) {
    elStatusBadge.textContent = pet.status;
    elStatusBadge.style.cssText = `position: static; ${getStatusStyle(pet.status)}`;
  }
  if (elAgeBadge) {
    elAgeBadge.textContent = `Idade: ${calculateAge(pet.birthDate, pet.approximateAge)}`;
  }

  // Atualizar contadores das abas
  const cVac = document.getElementById('count-tab-vaccines');
  const cDew = document.getElementById('count-tab-dewormers');
  const cMed = document.getElementById('count-tab-meds');
  const cCare = document.getElementById('count-tab-care');
  if (cVac) cVac.textContent = pet.vaccines?.length || 0;
  if (cDew) cDew.textContent = pet.dewormers?.length || 0;
  if (cMed) cMed.textContent = pet.medications?.length || 0;
  if (cCare) cCare.textContent = pet.otherCare?.length || 0;

  // 2. Histórico de Vacinas
  const vaccinesContainer = document.getElementById('vaccines-list-container');
  if (vaccinesContainer) {
    if (!pet.vaccines || pet.vaccines.length === 0) {
      vaccinesContainer.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <div class="empty-state-title">Nenhuma vacina registrada</div>
          <div class="empty-state-text">Clique em "+ Registrar Vacina" acima para adicionar a primeira dose.</div>
        </div>
      `;
    } else {
      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
      pet.vaccines.forEach(vac => {
        let alertPill = '';
        if (vac.nextDoseDate) {
          const days = getDaysRemaining(vac.nextDoseDate);
          if (days < 0) {
            alertPill = `<span style="font-size: 11px; font-weight: 800; background: var(--rose-100); color: var(--rose-700); padding: 3px 8px; border-radius: var(--radius-full);">Reforço atrasado (${Math.abs(days)}d)</span>`;
          } else if (days <= 15) {
            alertPill = `<span style="font-size: 11px; font-weight: 800; background: var(--amber-100); color: var(--amber-700); padding: 3px 8px; border-radius: var(--radius-full);">Reforço em ${days}d</span>`;
          }
        }

        html += `
          <div class="card-panel" style="padding: 16px; margin: 0; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14px; color: var(--slate-900);">${vac.name}</strong>
                ${alertPill}
              </div>
              <div style="font-size: 12px; color: var(--slate-500); margin-top: 4px;">
                Aplicada em: <strong style="color: var(--slate-700);">${formatDateBR(vac.applicationDate)}</strong>
                ${vac.nextDoseDate ? ` • Próximo Reforço: <strong style="color: var(--slate-700);">${formatDateBR(vac.nextDoseDate)}</strong>` : ''}
              </div>
              ${vac.batch || vac.veterinarian ? `<div style="font-size: 11px; color: var(--slate-400); margin-top: 2px;">${vac.batch ? `Lote: ${vac.batch}` : ''} ${vac.veterinarian ? `• Vet: ${vac.veterinarian}` : ''}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="icon-action-btn edit-vaccine-btn" data-vaccine-id="${vac.id}" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-vaccine-btn" data-vaccine-id="${vac.id}" title="Excluir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      vaccinesContainer.innerHTML = html;
    }
  }

  // 3. Histórico de Vermífugos
  const dewormersContainer = document.getElementById('dewormers-list-container');
  if (dewormersContainer) {
    if (!pet.dewormers || pet.dewormers.length === 0) {
      dewormersContainer.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <div class="empty-state-title">Nenhum vermífugo registrado</div>
          <div class="empty-state-text">Clique em "+ Registrar Vermífugo" acima para cadastrar a primeira aplicação.</div>
        </div>
      `;
    } else {
      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
      pet.dewormers.forEach(dew => {
        let alertPill = '';
        if (dew.nextApplicationDate) {
          const days = getDaysRemaining(dew.nextApplicationDate);
          if (days < 0) {
            alertPill = `<span style="font-size: 11px; font-weight: 800; background: var(--rose-100); color: var(--rose-700); padding: 3px 8px; border-radius: var(--radius-full);">Dose atrasada (${Math.abs(days)}d)</span>`;
          } else if (days <= 15) {
            alertPill = `<span style="font-size: 11px; font-weight: 800; background: var(--amber-100); color: var(--amber-700); padding: 3px 8px; border-radius: var(--radius-full);">Dose em ${days}d</span>`;
          }
        }

        html += `
          <div class="card-panel" style="padding: 16px; margin: 0; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14px; color: var(--slate-900);">${dew.productName}</strong>
                ${alertPill}
              </div>
              <div style="font-size: 12px; color: var(--slate-500); margin-top: 4px;">
                Aplicado em: <strong style="color: var(--slate-700);">${formatDateBR(dew.applicationDate)}</strong>
                ${dew.nextApplicationDate ? ` • Próxima Dose: <strong style="color: var(--slate-700);">${formatDateBR(dew.nextApplicationDate)}</strong>` : ''}
              </div>
              ${dew.weight || dew.dosage ? `<div style="font-size: 11px; color: var(--slate-400); margin-top: 2px;">${dew.weight ? `Peso: ${dew.weight} kg` : ''} ${dew.dosage ? `• Dose: ${dew.dosage}` : ''}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="icon-action-btn edit-dewormer-btn" data-dewormer-id="${dew.id}" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-dewormer-btn" data-dewormer-id="${dew.id}" title="Excluir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      dewormersContainer.innerHTML = html;
    }
  }

  // 4. Medicamentos
  const medicationsContainer = document.getElementById('medications-list-container');
  if (medicationsContainer) {
    if (!pet.medications || pet.medications.length === 0) {
      medicationsContainer.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <div class="empty-state-title">Nenhum medicamento registrado</div>
          <div class="empty-state-text">Clique em "+ Registrar Medicamento" acima para acompanhar dosagens e horários.</div>
        </div>
      `;
    } else {
      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
      pet.medications.forEach(med => {
        html += `
          <div class="card-panel" style="padding: 16px; margin: 0; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 14px; color: var(--slate-900);">${med.medicationName}</strong>
                <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-full); ${med.status === 'Ativo' ? 'background: var(--amber-100); color: var(--amber-800);' : 'background: var(--slate-100); color: var(--slate-600);'}">
                  ${med.status}
                </span>
              </div>
              <div style="font-size: 12px; color: var(--slate-600); margin-top: 4px;">
                Dose: <strong>${med.dosage}</strong> • Freq: <strong>${med.frequency}</strong>
              </div>
              <div style="font-size: 11px; color: var(--slate-500); margin-top: 2px;">
                Início: ${formatDateBR(med.startDate)} ${med.endDate ? `• Término: ${formatDateBR(med.endDate)}` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="icon-action-btn edit-medication-btn" data-medication-id="${med.id}" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-medication-btn" data-medication-id="${med.id}" title="Excluir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      medicationsContainer.innerHTML = html;
    }
  }

  // 5. Consultas e Cuidados Extras
  const careContainer = document.getElementById('care-list-container');
  if (careContainer) {
    if (!pet.otherCare || pet.otherCare.length === 0) {
      careContainer.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <div class="empty-state-title">Nenhum procedimento registrado</div>
          <div class="empty-state-text">Clique em "+ Registrar Procedimento" para salvar castração, exames ou cirurgias.</div>
        </div>
      `;
    } else {
      let html = '<div style="display: flex; flex-direction: column; gap: 10px;">';
      pet.otherCare.forEach(care => {
        html += `
          <div class="card-panel" style="padding: 16px; margin: 0; display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 10px; font-weight: 800; background: var(--primary-light); color: var(--primary); padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                  ${care.category}
                </span>
                <strong style="font-size: 14px; color: var(--slate-900);">${care.title}</strong>
              </div>
              <div style="font-size: 12px; color: var(--slate-500); margin-top: 4px;">
                Data: <strong style="color: var(--slate-700);">${formatDateBR(care.date)}</strong>
                ${care.veterinarian ? ` • Responsável: ${care.veterinarian}` : ''}
              </div>
              ${care.notes ? `<div style="font-size: 12px; color: var(--slate-600); margin-top: 6px; background: var(--slate-50); padding: 8px; border-radius: var(--radius-sm);">${care.notes}</div>` : ''}
            </div>
            <div style="display: flex; gap: 4px;">
              <button class="icon-action-btn edit-care-btn" data-care-id="${care.id}" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button class="icon-action-btn delete delete-care-btn" data-care-id="${care.id}" title="Excluir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      careContainer.innerHTML = html;
    }
  }

  // 6. Formulário de Adoção
  const adoptStatusSelect = document.getElementById('adoption-status-select');
  const adopterFieldsGroup = document.getElementById('adopter-fields-group');
  const adopterName = document.getElementById('adopter-name');
  const adopterPhone = document.getElementById('adopter-phone');
  const adopterEmail = document.getElementById('adopter-email');
  const adopterAddress = document.getElementById('adopter-address');
  const adopterNotes = document.getElementById('adopter-notes');

  if (adoptStatusSelect) {
    adoptStatusSelect.value = pet.status;
    const isAdoptedOrProcess = pet.status === 'Em processo' || pet.status === 'Adotado';
    if (adopterFieldsGroup) {
      adopterFieldsGroup.style.display = isAdoptedOrProcess ? 'block' : 'none';
    }
  }

  if (pet.adopter) {
    if (adopterName) adopterName.value = pet.adopter.name || '';
    if (adopterPhone) adopterPhone.value = pet.adopter.phone || '';
    if (adopterEmail) adopterEmail.value = pet.adopter.email || '';
    if (adopterAddress) adopterAddress.value = pet.adopter.address || '';
    if (adopterNotes) adopterNotes.value = pet.adopter.notes || '';
  } else {
    if (adopterName) adopterName.value = '';
    if (adopterPhone) adopterPhone.value = '';
    if (adopterEmail) adopterEmail.value = '';
    if (adopterAddress) adopterAddress.value = '';
    if (adopterNotes) adopterNotes.value = '';
  }
}

/* ==========================================================================
   RENDERIZAÇÃO DA CENTRAL DE ALERTAS
   ========================================================================== */

/**
 * Renderiza a listagem completa de alertas na seção Alertas
 * @param {Array} filteredAlerts Alertas após aplicação de filtros
 * @param {Array} allAlerts Todos os alertas existentes
 */
export function renderAlertsView(filteredAlerts, allAlerts) {
  // Contadores do topo da seção
  const elOverdue = document.getElementById('alert-summary-overdue');
  const elUrgent = document.getElementById('alert-summary-urgent');
  const elUpcoming = document.getElementById('alert-summary-upcoming');

  if (elOverdue) elOverdue.textContent = allAlerts.filter(a => a.urgency === 'overdue').length;
  if (elUrgent) elUrgent.textContent = allAlerts.filter(a => a.urgency === 'urgent').length;
  if (elUpcoming) elUpcoming.textContent = allAlerts.filter(a => a.urgency === 'upcoming').length;

  const listContainer = document.getElementById('alerts-full-list-container');
  if (!listContainer) return;

  if (filteredAlerts.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state" style="padding: 48px 20px;">
        <svg class="empty-state-icon" style="color: var(--emerald-600);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h2 class="empty-state-title">Nenhum alerta pendente</h2>
        <p class="empty-state-text">Todos os animais cadastrados estão com suas doses e cuidados em dia para os filtros selecionados.</p>
      </div>
    `;
    return;
  }

  let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
  filteredAlerts.forEach(alert => {
    const isOverdue = alert.urgency === 'overdue';
    const isUrgent = alert.urgency === 'urgent';
    const badgeStyle = isOverdue
      ? 'background: var(--rose-50); color: var(--rose-700); border: 1px solid var(--rose-200);'
      : isUrgent
      ? 'background: var(--amber-50); color: var(--amber-700); border: 1px solid var(--amber-100);'
      : 'background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;';

    html += `
      <div class="alert-item-card" data-pet-id="${alert.petId}">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 52px; height: 52px; border-radius: var(--radius-md); background: var(--slate-100); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${alert.petPhoto 
              ? `<img src="${alert.petPhoto}" style="width: 100%; height: 100%; object-fit: cover;" />`
              : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" stroke-width="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 20.04A3.5 3.5 0 0 1 5.5 15Z"/></svg>`}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 15px; color: var(--slate-900);">${alert.petName}</strong>
              <span style="font-size: 11px; color: var(--slate-500);">(${alert.petSpecies})</span>
              <span style="font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: var(--radius-full); ${badgeStyle}">
                ${isOverdue ? 'Atrasado' : isUrgent ? 'Próximos 7 dias' : 'Programado'}
              </span>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-top: 2px;">
              ${alert.title}
            </div>
            <div style="font-size: 12px; color: var(--slate-500);">
              Data Prevista: <strong>${formatDateBR(alert.targetDate)}</strong> • <span style="font-weight: 700; color: var(--slate-800);">${getFriendlyRelativeDays(alert.targetDate)}</span>
            </div>
          </div>
        </div>

        <div>
          <button class="link-action" data-pet-id="${alert.petId}">
            Abrir Ficha do Pet →
          </button>
        </div>
      </div>
    `;
  });
  html += '</div>';

  listContainer.innerHTML = html;
}

/* ==========================================================================
   CONTROLE DE MODAIS
   ========================================================================== */

/**
 * Abre um modal pelo ID do elemento
 * @param {string} modalId ID do elemento backdrop do modal
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Fecha um modal pelo ID do elemento
 * @param {string} modalId ID do elemento backdrop do modal
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

/**
 * Abre o modal reutilizável de confirmação com título, mensagem e callback
 * @param {string} title Título do aviso
 * @param {string} message Mensagem descritiva
 * @param {Function} onConfirm Callback executado ao clicar em Confirmar
 */
export function showConfirmModal(title, message, onConfirm) {
  const titleEl = document.getElementById('confirm-title');
  const msgEl = document.getElementById('confirm-message');
  const confirmBtn = document.getElementById('btn-execute-confirm');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;

  if (confirmBtn) {
    // Clona o botão para remover listeners de chamadas anteriores
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.addEventListener('click', () => {
      closeModal('modal-confirm');
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  openModal('modal-confirm');
}